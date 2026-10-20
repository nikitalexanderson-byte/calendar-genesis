import test from 'node:test';
import assert from 'node:assert/strict';
import { uiVisibility, visibleCalendarModes, visibleCalendarMode, viewIsVisible } from '../app/ui-visibility.ts';
import { projectViewOrder, moveProjectView, defaultProjectView, sameLayoutValue } from '../app/project-view-order.ts';

test('the sacred layer hides its entry points without changing saved calendar or menu choices', () => {
  const original = uiVisibility({enabledCalendars:['sacred','lunar'],hiddenMenuItems:['tasks'],hiddenSubmenus:['calendar.year']});
  const hidden = uiVisibility({...original,sacredFeaturesEnabled:false});
  assert.equal(viewIsVisible('stoicheion',hidden),false);
  assert.equal(viewIsVisible('theokyklos',hidden),false);
  assert.equal(viewIsVisible('calendar',hidden),true);
  assert.equal(viewIsVisible('habits',hidden),true);
  assert.deepEqual(visibleCalendarModes(hidden),['profane']);
  assert.equal(visibleCalendarMode('sacred',hidden),'profane');
  assert.equal(visibleCalendarMode('lunar',hidden),'profane');
  assert.deepEqual(hidden.enabledCalendars,original.enabledCalendars);
  assert.deepEqual(hidden.hiddenMenuItems,original.hiddenMenuItems);
  assert.deepEqual(uiVisibility({...hidden,sacredFeaturesEnabled:true}),original);
});

test('disabling sacred features temporarily uses Gregorian for every saved calendar combination', () => {
  for (const enabledCalendars of [['profane','sacred','lunar'],['lunar'],['sacred','lunar'],['profane']]) {
    const saved = uiVisibility({enabledCalendars,sacredFeaturesEnabled:false});
    assert.deepEqual(visibleCalendarModes(saved),['profane']);
    for (const mode of ['profane','sacred','lunar']) assert.equal(visibleCalendarMode(mode,saved),'profane');
    assert.deepEqual(saved.enabledCalendars,enabledCalendars);
    assert.deepEqual(visibleCalendarModes({...saved,sacredFeaturesEnabled:true}),enabledCalendars);
  }
});

test('a sacred-only account gets a temporary civil display and recovers its original calendar', () => {
  const saved = uiVisibility({enabledCalendars:['sacred'],sacredFeaturesEnabled:false});
  assert.deepEqual(visibleCalendarModes(saved),['profane']);
  assert.equal(visibleCalendarMode('sacred',saved),'profane');
  assert.deepEqual(saved.enabledCalendars,['sacred']);
  assert.equal(visibleCalendarMode('sacred',{...saved,sacredFeaturesEnabled:true}),'sacred');
  assert.equal(uiVisibility().sacredFeaturesEnabled,true);
});

test('account project view order sets the default without changing legacy project layout',()=>{
  assert.equal(defaultProjectView(null,false,'board'),'board');
  assert.equal(defaultProjectView(null,true,'board'),'list');
  const saved=uiVisibility({sharedProjectViewOrder:['board','list','gantt','calendar']});
  assert.equal(defaultProjectView(saved.sharedProjectViewOrder,true,'list'),'board');
  assert.deepEqual(saved.sharedProjectViewOrder,['board','list','gantt','calendar']);
  const moved=moveProjectView(saved.sharedProjectViewOrder,'calendar','board');
  assert.deepEqual(moved,['calendar','board','list','gantt']);
  assert.equal(defaultProjectView(moved,false,'board'),'calendar');
  assert.equal(sameLayoutValue(moved,[...moved]),true);assert.equal(sameLayoutValue(moved,saved.sharedProjectViewOrder),false);
  assert.equal(saved.sharedProjectViewOrder[0],'board');
});

test('malformed project orders never hide views or change old account defaults',()=>{
  for(const value of [null,undefined,[],['board'],['board','board','calendar','gantt'],['board','list','calendar','unknown'],['board','list','calendar',false]]){
    assert.equal(projectViewOrder(value),null);assert.equal(uiVisibility({sharedProjectViewOrder:value}).sharedProjectViewOrder,null);
  }
});
