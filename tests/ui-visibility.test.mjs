import test from 'node:test';
import assert from 'node:assert/strict';
import { uiVisibility, visibleCalendarModes, visibleCalendarMode, viewIsVisible } from '../app/ui-visibility.ts';

test('the sacred layer hides its entry points without changing saved calendar or menu choices', () => {
  const original = uiVisibility({enabledCalendars:['sacred','lunar'],hiddenMenuItems:['tasks'],hiddenSubmenus:['calendar.year']});
  const hidden = uiVisibility({...original,sacredFeaturesEnabled:false});
  assert.equal(viewIsVisible('stoicheion',hidden),false);
  assert.equal(viewIsVisible('theokyklos',hidden),false);
  assert.equal(viewIsVisible('calendar',hidden),true);
  assert.equal(viewIsVisible('habits',hidden),true);
  assert.deepEqual(visibleCalendarModes(hidden),['lunar']);
  assert.equal(visibleCalendarMode('sacred',hidden),'lunar');
  assert.deepEqual(hidden.enabledCalendars,original.enabledCalendars);
  assert.deepEqual(hidden.hiddenMenuItems,original.hiddenMenuItems);
  assert.deepEqual(uiVisibility({...hidden,sacredFeaturesEnabled:true}),original);
});

test('a sacred-only account gets a temporary civil display and recovers its original calendar', () => {
  const saved = uiVisibility({enabledCalendars:['sacred'],sacredFeaturesEnabled:false});
  assert.deepEqual(visibleCalendarModes(saved),['profane']);
  assert.equal(visibleCalendarMode('sacred',saved),'profane');
  assert.deepEqual(saved.enabledCalendars,['sacred']);
  assert.equal(visibleCalendarMode('sacred',{...saved,sacredFeaturesEnabled:true}),'sacred');
  assert.equal(uiVisibility().sacredFeaturesEnabled,true);
});
