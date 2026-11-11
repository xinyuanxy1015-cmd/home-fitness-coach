export const moves = {
  warm: ['原地踏步', '交替抬膝，配合自然摆臂。', '从慢到快，接着做几次肩部绕环。'],
  push: ['标准俯卧撑', '手略宽于肩，头、躯干和腿保持一条线。', '胸和髋一起下降，推回起始位。避免塌腰。'],
  incline: ['上斜俯卧撑', '双手撑在固定、稳固的台面上。', '保持全身一条直线，胸靠近台面，再推回。'],
  row: ['单臂哑铃划船', '用空手支撑稳固台面，保持背部自然平直。', '肘向髋部拉，慢慢放下。避免转动躯干。', true, true],
  deadbug: ['死虫', '仰卧，手臂朝上，髋膝弯曲。', '缓慢伸出对侧手脚，再收回。腰部开始拱起就缩小幅度。', true],
  crunch: ['反向卷腹', '仰卧屈膝，手臂自然放在身侧。', '轻收腹，让骨盆小幅卷起，再缓慢落下。避免甩腿。'],
  squat: ['坐椅深蹲', '站在稳固椅子前，双脚踩实。', '髋往后坐，轻触椅面后站起。膝盖跟脚尖同向。'],
  hinge: ['哑铃罗马尼亚硬拉', '膝盖微屈，哑铃贴近大腿。', '髋向后推，背部保持自然平直，感到腿后侧拉伸就站回。', false, true],
};
export const labels = {A:'力量 A', B:'力量 B', H:'9 分钟 HIIT', O:'可选 HIIT'};
const templates = {A:['push','row','deadbug','squat'], B:['push','row','crunch','hinge']};
export const initial = () => ({version:1, profile:null, sessions:{}, shifts:{}, measures:{}, plans:{}, history:[], draft:null});
const stamp = date => [date.getFullYear(), date.getMonth()+1, date.getDate()].map((n,i)=> i ? String(n).padStart(2,'0') : n).join('-');
export const today = () => stamp(new Date());
export function plus(date, days) {
  const d = new Date(date+'T12:00:00');
  d.setDate(d.getDate()+days);
  return stamp(d);
}
export const weekday = date => (new Date(date+'T12:00:00').getDay()+6)%7;
export const monday = date => plus(date,-weekday(date));
export const days = week => Array.from({length:7},(_,i)=>plus(week,i));
export function schedule(state, week) {
  return Object.entries({A:0,H:1,B:3,O:6}).map(([kind,offset])=>{
    const id = week+kind;
    return {kind,id,date:state.shifts[id] ?? plus(week,offset)};
  }).sort((a,b)=>a.date.localeCompare(b.date));
}
export function candidates(state, item) {
  const week = item.id.slice(0,10);
  const nearby = [-7,0,7].flatMap(delta=>schedule(state,plus(week,delta))).filter(other=>other.id!==item.id);
  return days(week).filter(date=>weekday(date)!==5 && date>=today() && date!==item.date &&
    !nearby.some(other=>other.date===date || (item.kind==='A'||item.kind==='B') &&
      (other.kind==='A'||other.kind==='B') && [plus(date,1),plus(date,-1)].includes(other.date)));
}
export function plan(state, id) {
  const max = state.profile.max;
  const previousKg = Object.values(state.sessions).filter(s=>s.records?.some(r=>r.id===id && r.reps>0))
    .sort((a,b)=>b.date.localeCompare(a.date))[0]?.records.findLast(r=>r.id===id && r.reps>0)?.kg;
  const weight = previousKg ?? state.profile.weights[0] ?? 0;
  const start = max>=7 ? 4 : Math.max(2,max-2);
  const defaults = {
    push:{variant:max<3?'incline':'push',lo:Math.max(1,start-1),hi:start,kg:0},
    row:{lo:8,hi:10,kg:weight},
    hinge:{lo:8,hi:10,kg:weight},
    deadbug:{lo:5,hi:6,kg:0}, crunch:{lo:6,hi:8,kg:0}, squat:{lo:6,hi:8,kg:0},
    optional:{variant:'hiit'},
  };
  return {...defaults[id],...state.plans[id]};
}
export function draftFor(state,item,short) {
  const steps = templates[item.kind].flatMap((id,index)=>{
    const p = plan(state,id);
    const variant = p.variant ?? id;
    const sets = short || index===3 ? 1 : 2;
    return Array.from({length:sets},(_,i)=>(moves[variant][3]?['左','右']:['']).map(side=>({
      ...p,id,variant,sets,set:i+1,side,target:id==='push'?p.hi:p.lo
    }))).flat();
  });
  return {...item,short,steps,index:0,phase:'warm',records:[],restUntil:0};
}
export function weeklyMeasures(state, week) {
  const entries = Object.entries(state.measures).filter(([date])=>monday(date)===week).map(([,value])=>value);
  return Object.fromEntries(['weight','waist','fat'].map(key=>{
    const nums = entries.map(entry=>entry[key]).filter(Number.isFinite);
    return [key,nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null];
  }));
}
export function suggestions(state) {
  const sessions = Object.values(state.sessions).filter(session=>session.records?.length)
    .sort((a,b)=>b.date.localeCompare(a.date));
  const pending = [];
  for(const id of Object.keys(moves).filter(id=>!['warm','incline'].includes(id))) {
    const p = plan(state,id);
    const recent = sessions.filter(s=>!s.short && s.status==='done' && s.records.some(r=>r.id===id)).slice(0,2);
    if(recent.length<2) continue;
    const groups = recent.map(s=>s.records.filter(r=>r.id===id));
    const stamp = recent.map(s=>s.id).join('/');
    const same = group=>group.every(r=>r.variant===(p.variant??id)&&r.kg===p.kg&&r.hi===p.hi&&r.lo===p.lo);
    const lastPain = sessions.find(s=>s.records.some(r=>r.id===id && r.pain));
    const blocked = lastPain && lastPain.date>=recent[1].date;
    if(!groups.every(same)) continue;
    const hard = groups.every(g=>g.some(r=>r.effort==='hard'||r.reps<r.lo));
    const expected = (id==='squat'||id==='hinge'?1:2)*(moves[p.variant??id][3]?2:1);
    const easy = !blocked && groups.every(g=>g.length===expected && g.every(r=>r.reps>=r.hi&&r.effort==='easy'&&!r.pain));
    let next;
    if(hard && !blocked) {
      if(id==='push' && p.variant==='push') next={...p,variant:'incline'};
      else if(p.kg>0) next={...p,kg:state.profile.weights.filter(kg=>kg<p.kg).at(-1)??0};
      else if(p.hi>2) next={...p,lo:Math.max(1,p.lo-1),hi:p.hi-1};
    } else if(easy) {
      if(id==='push') next={...p,lo:p.lo+1,hi:p.hi+1};
      else if(moves[id][4]) {
        const nextKg = state.profile.weights.find(kg=>kg>p.kg && kg-p.kg<=2);
        if(nextKg) next={...p,kg:nextKg};
      }
    }
    if(next && !(easy && state.history.some(x=>x.increase && !x.dismissed && monday(x.date)===monday(today())))) {
      pending.push({id,key:id+stamp,before:p,next,increase:easy,reason:easy?'最近两次完整训练均达到上限，并确认动作稳定、有余力、无疼痛。':'最近两次记录都偏难或低于次数下限。'});
    }
  }
  const week = monday(today());
  const priorSunday = plus(week,-1);
  const sunday = Object.values(state.sessions).find(s=>s.kind==='O' && s.date===priorSunday && s.activity==='hiit');
  const mondayStrength = sessions.find(s=>s.date===week);
  if(sunday && mondayStrength?.recovery==='poor' && state.plans.optional?.week!==plus(week,7)) {
    pending.unshift({id:'optional',key:'optional'+week,before:{variant:'hiit'},next:{variant:'walk'},week:plus(week,7),reason:'周日加练后，周一反馈恢复较差。建议下周把这次加练换成散步。'});
  }
  return pending.filter(s=>!state.history.some(h=>h.key===s.key));
}
export function validBackup(value) {
  if(value?.version!==1) return false;
  const record = x=>x && typeof x==='object' && !Array.isArray(x);
  const date = x=>/^\d{4}-\d{2}-\d{2}$/.test(x);
  const kind = x=>Object.hasOwn(labels,x);
  const move = x=>Object.hasOwn(moves,x);
  const profile = value.profile;
  if(profile!==null && (!record(profile)||!Number.isInteger(profile.max)||profile.max<0||!Array.isArray(profile.weights)||!profile.weights.every(x=>Number.isFinite(x)&&x>0))) return false;
  if(!['sessions','shifts','measures','plans'].every(key=>record(value[key]))||!Array.isArray(value.history)) return false;
  if(!Object.entries(value.measures).every(([day,x])=>date(day)&&record(x)&&Object.values(x).every(n=>Number.isFinite(n)&&n>0))) return false;
  if(!Object.entries(value.shifts).every(([id,day])=>date(id.slice(0,10))&&kind(id.slice(10))&&date(day)&&weekday(day)!==5)) return false;
  const planValue = (id,p)=>record(p)&&(id==='optional'?['walk','hiit'].includes(p.variant):move(id)&&[p.lo,p.hi,p.kg].every(Number.isFinite)&&(!p.variant||move(p.variant)));
  if(!value.history.every(h=>record(h)&&date(h.date)&&planValue(h.id,h.next)&&(h.previous===null||planValue(h.id,h.previous)))) return false;
  const step = r=>record(r)&&move(r.id)&&move(r.variant)&&['kg','lo','hi'].every(key=>Number.isFinite(r[key]));
  if(!Object.values(value.sessions).every(s=>record(s)&&kind(s.kind)&&date(s.date)&&(!s.records||Array.isArray(s.records)&&s.records.every(step)))) return false;
  if(!Object.entries(value.plans).every(([id,p])=>planValue(id,p))) return false;
  const d=value.draft;
  return d===null || record(d)&&kind(d.kind)&&date(d.date)&&['warm','set','rest','summary'].includes(d.phase)&&Array.isArray(d.steps)&&d.steps.every(step)&&Array.isArray(d.records)&&d.records.every(step)&&Number.isInteger(d.index)&&d.index>=0&&d.index<=d.steps.length;
}
