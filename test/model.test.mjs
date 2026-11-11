import assert from 'node:assert/strict';
import test from 'node:test';
import {initial,today,monday,schedule,draftFor,candidates,suggestions,validBackup,plus,weeklyMeasures} from '../site/model.mjs';
const setup=()=>({...initial(),profile:{max:7,weights:[2,4]}});
test('week structure and Saturday lock',()=>{
  const state=setup();
  const w=plus(monday(today()),7);
  const [a,h,b,o]=schedule(state,w);
  assert.deepEqual([a.kind,h.kind,b.kind,o.kind],['A','H','B','O']);
  assert.deepEqual(candidates(state,b),[plus(w,2),plus(w,4)]);
});
test('short mode and left/right sequencing',()=>{
  const state=setup();
  const [item]=schedule(state,monday(today()));
  const d=draftFor(state,item,false);
  assert.deepEqual(d.steps.filter(s=>s.id==='row').map(s=>s.side),['左','右','左','右']);
  assert.equal(d.steps[0].target,4);
  assert.equal(d.steps.filter(s=>s.id==='squat').length,1);
  assert.equal(draftFor(state,item,true).steps.length,6);
});
test('two confirmed sessions required and pain blocks progression',()=>{
  const state=setup();
  const [a,,b]=schedule(state,monday(today()));
  for(const item of [a,b]) {
    const records=draftFor(state,item,false).steps.filter(r=>r.id==='push').map(r=>({...r,reps:r.hi,effort:''}));
    state.sessions[item.id]={...item,records,status:'done'};
  }
  assert.deepEqual(suggestions(state),[]);
  for(const s of Object.values(state.sessions)) for(const r of s.records) r.effort='easy';
  assert.equal(suggestions(state)[0].next.hi,5);
  state.sessions[b.id].records[1].pain=true;
  assert.deepEqual(suggestions(state),[]);
});
test('body measurements aggregate within the week and backup validates',()=>{
  const state=setup();
  const w=monday(today());
  state.measures[w]={weight:70};
  state.measures[plus(w,2)]={weight:72,waist:85};
  assert.deepEqual(weeklyMeasures(state,w),{weight:71,waist:85,fat:null});
  assert.equal(validBackup(JSON.parse(JSON.stringify(state))),true);
  assert.equal(validBackup({...state,plans:[]}),false);
});
