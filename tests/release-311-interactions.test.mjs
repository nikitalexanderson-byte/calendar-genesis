import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapAdviceText } from '../app/advice-share.ts';
import { sharedMovePreview } from '../app/shared-move-preview.ts';

test('export wraps full multilingual advice without losing words or long Unicode sequences', () => {
  for (const value of ['Полный текст без сокращений', '打开世界展开新的思考', 'A veryveryverylongword and a second paragraph.\nSource attribution']) {
    const lines=wrapAdviceText(value,12,text=>Array.from(text).length);
    assert.ok(lines.every(line=>Array.from(line).length<=12));
    assert.equal(lines.join('').replace(/\s/g,''),value.replace(/\s/g,''));
  }
});

const task={id:'task',projectId:'source',statusId:'todo',title:'Preserved task',revision:7,attachments:[{name:'kept'}]};
const snapshot={project:{id:'source'},tasks:[task],taskPage:{tasks:[task],total:8,statusCounts:{todo:5,done:3}}};
test('the destination status renders while transport is still pending, with matching counters',()=>{
  const result=sharedMovePreview(snapshot,{task:{...task,statusId:'done',pending:true}});
  assert.equal(result.tasks[0].statusId,'done');assert.equal(result.tasks[0].pending,true);
  assert.deepEqual(result.taskPage.statusCounts,{todo:4,done:4});
  assert.equal(result.taskPage.total,8);assert.equal(snapshot.tasks[0].statusId,'todo');
  assert.deepEqual(result.tasks[0].attachments,task.attachments);
});
test('cross-project previews remove the source once without injecting into unrelated authorized queries',()=>{
  const move={...task,projectId:'destination',pending:true};
  const result=sharedMovePreview(snapshot,{task:move});
  assert.equal(result.tasks.length,0);assert.equal(result.taskPage.total,7);
  const unrelated={...snapshot,tasks:[],project:{id:'other'}};
  assert.equal(sharedMovePreview(unrelated,{task:move}),unrelated);
  assert.equal(sharedMovePreview(null,{task:move}),null);
});
test('clearing a rejected preview restores the unchanged source snapshot',()=>{
  assert.equal(sharedMovePreview(snapshot,{}),snapshot);
  assert.equal(snapshot.taskPage.statusCounts.todo,5);
});

test('a newer synchronized row supersedes a queued preview',()=>{
  const actual={...task,statusId:'done',revision:9};
  const base={...snapshot,tasks:[actual]};
  assert.deepEqual(sharedMovePreview(base,{task:{...task,statusId:'todo',pending:true}}).tasks,[actual]);
});
