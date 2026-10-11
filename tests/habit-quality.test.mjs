import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,existsSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname,resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(resolve(root,"package.json"));const ts=require("typescript");const cache=new Map();
function load(path){
  if(path.endsWith("?raw"))return readFileSync(path.slice(0,-4),"utf8");
  if(!extname(path))path += ".ts";
  if(path.endsWith(".json"))return JSON.parse(readFileSync(path,"utf8"));
  if(cache.has(path))return cache.get(path).exports;
  const loaded={exports:{}};cache.set(path,loaded);
  const source=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{module:loaded,exports:loaded.exports,process:{env:{}},crypto:globalThis.crypto,Date,Math,Map,Set,Intl,URL,TextEncoder,TextDecoder,
    require:id=>id.startsWith(".")&&existsSync(resolve(dirname(path),id.split("?")[0])+(extname(id.split("?")[0]) ? "" : ".ts")) ? load(resolve(dirname(path),id)) : require(id)}, {filename:path});
  return loaded.exports;
}
const habits=load(resolve(root,"app/habits.ts"));
test("Confirmed quality survives reload and cannot be changed or award repeated XP",()=>{
  const today="2026-10-10";
  let workspace=habits.normalizeHabitWorkspace({habits:[{id:"habit",title:"Test",createdDate:today,kind:"positive",qualityScale:"ten",scoringMode:"quality-ten"}]},"profane");
  const habit=workspace.habits[0];
  workspace=habits.updateHabitCompletion(workspace,habit,today,{completed:true,qualityValue:8,qualityConfirmedAt:"2026-10-10T09:00:00Z"},today);
  const original=workspace.habitCompletions[0];assert.equal(original.score,8);
  workspace=habits.normalizeHabitWorkspace(JSON.parse(JSON.stringify(workspace)),"profane");
  workspace=habits.updateHabitCompletion(workspace,habit,today,{qualityValue:10,qualityConfirmedAt:null},today);
  assert.equal(workspace.habitCompletions[0].qualityValue,8);
  assert.equal(workspace.habitCompletions[0].qualityConfirmedAt,original.qualityConfirmedAt);
  workspace=habits.updateHabitCompletion(workspace,habit,today,{completed:false},today);
  assert.equal(workspace.habitCompletions[0].score,0);
  workspace=habits.updateHabitCompletion(workspace,habit,today,{completed:true,qualityValue:1},today);
  assert.equal(workspace.habitCompletions[0].score,8);
  assert.equal(workspace.habitCompletions[0].xpAwarded,original.xpAwarded);
  assert.strictEqual(habits.updateHabitCompletion(workspace,habit,"2026-10-09",{completed:true},today),workspace);
});
