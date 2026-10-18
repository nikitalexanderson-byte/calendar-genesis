import test from 'node:test';
import assert from 'node:assert/strict';
import { editableSharedViewDefinition, repairSharedViewContext } from '../app/shared-saved-view-model.ts';

const definition = () => ({version:1,title:'Personal week',filter:{projectIds:['project-a'],priority:[0,3],approvalPending:false},sort:'priority',relative:'this-week',calendarMode:'lunar',calendarContext:{version:2,timeZone:'Europe/Moscow',gregorianYearStart:'march'}});

test('a saved filter preserves neutral priority, explicit false, selected projects and calendar context', () => {
  const value=definition(),before=JSON.stringify(value);
  assert.equal(editableSharedViewDefinition(value),true);
  assert.equal(JSON.stringify(value),before);
  assert.equal(editableSharedViewDefinition({...value,filter:[]}),true);
});

test('missing or damaged context and malformed selections cannot become an editable empty view', () => {
  const value=definition();
  for(const patch of [{calendarContext:null},{calendarContext:undefined},{calendarContext:{}},{calendarContext:{...value.calendarContext,version:1}},{filter:null},{filter:['project-a']},{filter:{projectIds:[null]}},{filter:{priority:['3']}},{filter:{approvalPending:'false'}},{sort:'unknown'},{relative:'last-week'}]) {
    assert.equal(editableSharedViewDefinition({...value,...patch}),false,JSON.stringify(patch));
  }
});

test('an invalid typed zone or date remains available for explicit correction without mutation', () => {
  const value={...definition(),calendarContext:{version:2,timeZone:'Bad/Zone',gregorianYearStart:'january'},filter:{dueFrom:'bad-date'}};
  const before=JSON.stringify(value);
  assert.equal(editableSharedViewDefinition(value),true);
  assert.equal(JSON.stringify(value),before);
});

test('explicit context repair keeps the original filter and relative period and cannot repair lost conditions', () => {
  const source=definition(),damaged={...source,calendarContext:undefined};
  const repaired=repairSharedViewContext(damaged,source.calendarContext);
  assert.deepEqual(repaired.filter,source.filter);
  assert.equal(repaired.relative,source.relative);
  assert.equal(damaged.calendarContext,undefined);
  assert.equal(repairSharedViewContext({...damaged,relative:undefined},source.calendarContext),null);
  assert.equal(repairSharedViewContext({...damaged,filter:null},source.calendarContext),null);
});

test('custom field conditions survive editing and calendar repair with explicit zero and false', () => {
  const original={...definition(),sort:'custom:field-a:desc',filter:{customFields:[{fieldId:'field-a',op:'eq',value:0},{fieldId:'field-b',op:'eq',value:false},{fieldId:'field-c',op:'missing'}]}};
  const serialized=JSON.stringify(original);
  assert.equal(editableSharedViewDefinition(original),true);
  assert.equal(JSON.stringify(original),serialized);
  const repaired=repairSharedViewContext({...original,calendarContext:undefined},original.calendarContext);
  assert.deepEqual(repaired.filter,original.filter);
  assert.equal(repaired.sort,original.sort);
  for(const customFields of [null,{},[{fieldId:'field-a',op:'run-code'}],[{fieldId:null,op:'eq'}]])assert.equal(editableSharedViewDefinition({...original,filter:{customFields}}),false);
});
