import {moves,labels,initial,today,plus,monday,days,schedule,candidates,draftFor,suggestions,weeklyMeasures,validBackup} from './model.mjs';
import {read,write} from './db.mjs';

const app=document.querySelector('#app');
let state;
let week=monday(today());
let changing='';
let busy=false;
const weekdays=['一','二','三','四','五','六','日'];
const fmt=d=>d.slice(5).replace('-','/');
const btn=(label,action,extra='',cls='')=>`<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const card=(title,body)=>`<section class="card"><h2>${title}</h2>${body}</section>`;
const photo=id=>`<figure><img src="./art/${id}.jpg" alt="${moves[id][0]}的起始位与结束位" width="598" height="${id==='deadbug'?299:326}"><figcaption><span>起始位</span><span>${id==='deadbug'?'左手 + 右腿伸出':'结束位'}</span></figcaption></figure>`;
const current=()=>location.hash.slice(1)||'today';
const strength=item=>['A','B'].includes(item.kind);
const completed=s=>s && s.status!=='skipped';
function scheduled(date) {return schedule(state,monday(date)).find(x=>x.date===date);}
function titleFor(item) {
  if(item.kind==='O' && state.plans.optional?.week===monday(item.date)) return '可选散步';
  return labels[item.kind];
}
function status(item) {
  const s=state.sessions[item.id];
  if(s?.status==='skipped') return '已跳过';
  if(s?.status==='partial') return '部分完成';
  if(s) return s.short?'短版完成':'已完成';
  return item.date<today()?'未打卡':item.kind==='O'?'可选':'已计划';
}
function progressCount(w) {
  return schedule(state,w).filter(x=>strength(x)&&state.sessions[x.id]?.status==='done').length;
}
function agenda(w) {
  const items=schedule(state,w);
  return `<div class="agenda">${days(w).map((d,i)=>{
    const item=items.find(x=>x.date===d);
    return `<div class="day ${d===today()?'is-today':''}"><div><strong>周${weekdays[i]}</strong><small>${fmt(d)}</small></div><div><strong>${item?titleFor(item):'休息'}</strong><small>${item?status(item):''}</small></div>${item&&(!completed(state.sessions[item.id]))?btn('查看','inspect',`data-id="${item.id}"`,'small'):''}</div>`;
  }).join('')}</div>`;
}
function actions(item) {
  if(state.sessions[item.id] && state.sessions[item.id].status!=='skipped') return '<p>这节课已记录。</p>';
  const attr=`data-id="${item.id}"`;
  const controls=strength(item)
    ? btn('开始训练','start',attr,'primary')+btn('8 分钟短版','short',attr)
    : (titleFor(item)!=='可选散步'?btn('记录 HIIT','activity',attr+' data-kind="hiit"','primary'):'')+btn('记录散步','activity',attr+' data-kind="walk"');
  return `<div class="buttons">${item.date<=today()?controls:''}${btn('改期','inspect',attr)}${!state.sessions[item.id]?btn('记为休息','activity',attr+' data-kind="skip"'):''}</div>`;
}
function todayPage() {
  const d=today();
  const item=scheduled(d);
  const count=progressCount(monday(d));
  return `<div class="page-title"><p>${d.replaceAll('-',' / ')} · 周${weekdays[days(monday(d)).indexOf(d)]}</p><h1>今天</h1></div>
    <section class="hero"><div class="hero-copy"><span class="pill">${item?status(item):'恢复日'}</span><h2>${item?titleFor(item):'今天休息'}</h2><p>${item?strength(item)?'胸、背与核心 · 约 15–20 分钟':'熟悉的居家有氧 · 约 9 分钟':'轻松活动，给身体留一点恢复时间。'}</p></div><img src="./art/${item&&strength(item)?'push':'warm'}.jpg" alt=""></section>
    ${state.draft?card('上次训练',btn('继续训练','resume','','primary')):item?actions(item):''}
    <div class="section-head"><h2>本周计划</h2><span>力量 ${count}/2</span></div>${agenda(monday(d))}`;
}
function weekPage() {
  return `<div class="page-title"><p>${fmt(week)} – ${fmt(plus(week,6))}</p><h1>本周</h1></div>
    <div class="section-head">${btn('← 上一周','prev')}<strong>力量 ${progressCount(week)}/2</strong>${btn('下一周 →','next')}</div>
    ${agenda(week)}`;
}
function editItem() {
  const item=findItem(changing);
  if(!item) return weekPage();
  const opts=candidates(state,item).map(d=>`<option value="${d}">${fmt(d)} · 周${weekdays[days(monday(d)).indexOf(d)]}</option>`).join('');
  return `<div class="page-title"><p>${fmt(item.date)}</p><h1>${titleFor(item)}</h1></div>${actionsWithoutEdit(item)}
    ${opts?card('改期',`<form data-form="shift"><label>本周可选日期<select name="date">${opts}</select></label><button class="primary">保存改期</button></form>`):card('改期','<p>本周没有符合间隔的可用日期。</p>')}
    ${btn('返回本周','back-week')}`;
}
function actionsWithoutEdit(item) {
  if(state.sessions[item.id] && state.sessions[item.id].status!=='skipped') return '<p>这节课已记录。</p>';
  const attr=`data-id="${item.id}"`;
  if(item.date>today()) return '';
  return `<div class="buttons">${strength(item)?btn('开始训练','start',attr,'primary')+btn('8 分钟短版','short',attr):
    (titleFor(item)!=='可选散步'?btn('记录 HIIT','activity',attr+' data-kind="hiit"','primary'):'')+btn('记录散步','activity',attr+' data-kind="walk"')}
    ${!state.sessions[item.id]?btn('记为休息','activity',attr+' data-kind="skip"'):''}</div>`;
}
function progress() {
  const w=monday(today());
  const trends=[-21,-14,-7,0].map(offset=>{
    const date=plus(w,offset);
    const m=weeklyMeasures(state,date);
    return `<tr><td>${fmt(date)}</td>${['waist','weight','fat'].map(k=>`<td>${m[k]?.toFixed(1)??'—'}</td>`).join('')}</tr>`;
  }).join('');
  const rows=Object.entries(state.measures).sort(([a],[b])=>b.localeCompare(a)).slice(0,12).map(([d,m])=>`<li>${d} · ${['weight','waist','fat','bmi'].filter(k=>m[k]).map(k=>m[k]+({weight:' kg',waist:' cm',fat:'% 体脂',bmi:' BMI'}[k])).join(' · ')}</li>`).join('');
  const lifting=Object.values(state.sessions).filter(s=>s.records?.some(r=>r.id==='push')).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(s=>`<li>${fmt(s.date)} · ${s.records.filter(r=>r.id==='push'&&r.reps>0).map(r=>moves[r.variant][0]+' '+r.reps+' 个').join(' / ')||'已停止'}</li>`).join('');
  return `<div class="page-title"><h1>进展</h1></div>${card('最近四周',`<table><thead><tr><th>周起始</th><th>腰围 cm</th><th>体重 kg</th><th>体脂 %</th></tr></thead><tbody>${trends}</tbody></table>`)}
    ${card('身体记录',measureForm())}${card('历史体测',rows?`<ul>${rows}</ul>`:'<p>暂无记录。</p>')}
    ${card('俯卧撑表现',lifting?`<ul>${lifting}</ul>`:`<p>设置基线 · 标准俯卧撑 ${state.profile.max} 个</p>`)}`;
}
function measureForm() {
  return `<form data-form="measure"><label>测量日期<input required type="date" name="date" value="${today()}" max="${today()}"></label>
    <div class="fields">${[['weight','体重 kg',500],['waist','腰围 cm',300],['fat','体脂 %',100],['bmi','BMI',100]].map(([key,label,max])=>`<label>${label}<input name="${key}" type="number" inputmode="decimal" min="0.1" max="${max}" step="0.1"></label>`).join('')}</div>
    <button class="primary">保存体测</button></form>`;
}
function profileForm() {
  return `<form data-form="profile"><label>标准俯卧撑最多能做几个<input name="max" type="number" inputmode="numeric" min="0" max="100" required value="${state.profile?.max??''}"></label>
  <label>哑铃档位（每只 kg，用空格分隔）<input name="weights" placeholder="例如 2 4 6" value="${state.profile?.weights.join(' ')??''}"></label>
  <button class="primary">保存设置</button></form>`;
}
function settings() {
  return `<div class="page-title"><h1>设置</h1></div>${card('训练基线',profileForm())}
    ${card('本机数据','<p>训练和体测保存在此浏览器。换设备前可以导出备份。</p>'+btn('导出备份','export')+'<label class="import">恢复备份<input id="backup" type="file" accept="application/json,.json"></label>'+btn('清空本机记录','clear','','danger'))}
    ${card('添加到主屏幕','<p>iPhone 可在 Safari 的分享菜单中选择「添加到主屏幕」。支持安装的浏览器也可在菜单里安装。</p>')}`;
}
function describe(id,p) {
  if(id==='optional') return p.variant==='walk'?'散步':'可选 HIIT';
  return `${moves[p.variant??id][0]} · ${p.lo}–${p.hi} 次${p.kg?' · '+p.kg+' kg':''}`;
}
function coach() {
  const proposals=suggestions(state);
  const summaries=[-21,-14,-7].map(x=>weeklyMeasures(state,plus(monday(today()),x)));
  const rising=['waist','weight'].every(k=>summaries.every(m=>m[k]!==null)&&summaries[0][k]<summaries[1][k]&&summaries[1][k]<summaries[2][k]);
  const latest=state.history.findLast(h=>!h.dismissed);
  return `<div class="page-title"><h1>教练</h1></div>
  ${card('本周复盘',`<p>已完成力量 ${progressCount(monday(today()))}/2。</p><p>${rising?'过去三个完整周体重与腰围都上升。回顾训练完成情况、日常活动和饮食习惯。':'用几周的腰围、体重和力量记录看趋势。'}</p>`)}
  ${proposals.length?proposals.map((p,i)=>card(p.id==='optional'?'周日有氧':moves[p.id][0],`<p>${p.reason}</p><div class="change">${describe(p.id,p.before)}<br>↓<br>${describe(p.id,p.next)}</div><div class="buttons">${btn('应用建议','apply',`data-index="${i}"`,'primary')}${btn('保留原计划','dismiss',`data-index="${i}"`)}</div>`)).join(''):card('当前计划','<p>暂无待确认调整。</p>')}
  ${latest&&!latest.dismissed?card('最近一次调整',`<p>${describe(latest.id,latest.next)}</p>${btn('撤销调整','undo')}`):''}`;
}
function workout() {
  const d=state.draft;
  if(!d) return todayPage();
  const heading=`<div class="page-title workout-title"><p>${labels[d.kind]}${d.short?' · 短版':''}</p><h1>${{warm:'先热身',rest:'休息一下',summary:'训练小结',set:'当前动作'}[d.phase]}</h1></div>`;
  if(d.phase==='warm') return heading+card('原地踏步 · 约 3 分钟',photo('warm')+'<p>交替抬膝，自然摆臂。再做几次肩部绕环。</p>'+btn('热身完成','warm-done','','primary'));
  if(d.phase==='rest') return heading+`<section class="card rest"><output id="timer">60 秒</output><p>接下来 · ${moves[d.steps[d.index].variant][0]}</p><div class="buttons">${btn('+15 秒','extend')}${btn('结束休息，开始下一组','rest-done','','primary')}</div></section>`;
  if(d.phase==='summary') return heading+card('本次训练',`<p>确认了 ${d.records.filter(r=>r.reps>0).length} 个组次记录（左右侧分别计）。</p><form data-form="finish"><label>整体恢复感受（可选）<select name="recovery"><option value="">跳过</option><option value="good">恢复良好</option><option value="poor">明显疲劳 / 恢复较差</option></select></label><button class="primary">保存训练</button></form>`);
  const s=d.steps[d.index];
  const [name,tip,tip2,,weighted]=moves[s.variant];
  return heading+`<progress value="${d.index}" max="${d.steps.length}" aria-label="训练进度"></progress>`+
    card(name,`<p class="set-meta">第 ${s.set}/${s.sets} 组${s.side?' · '+(s.variant==='deadbug'?s.side+'手 + '+(s.side==='左'?'右':'左')+'腿':s.side+'侧'):''} · 目标 ${s.target} 个</p>${photo(s.variant)}
    <ul class="tips"><li>${tip}</li><li>${tip2}</li></ul>
    <form data-form="set"><div class="fields"><label>实际次数<input required id="reps" name="reps" type="number" inputmode="numeric" min="0" max="150" value="${s.target}"></label>
    ${weighted?`<label>每只哑铃 kg<input required name="kg" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${s.kg}"></label>`:''}</div>
    <label>这一组感受（可选）<select name="effort"><option value="">跳过</option><option value="easy">太轻松 · 动作稳定、有余力、无疼痛</option><option value="fine">刚好</option><option value="hard">太难</option></select></label>
    <button id="complete" class="primary">完成 ${s.target} 个</button></form>
    <div class="buttons">${s.variant==='push'?btn('换上斜俯卧撑','incline'):''}${btn('疼痛，停止此动作','pain','','danger')}</div>`);
}
const pages={today:todayPage,week:weekPage,progress,coach,settings,workout,item:editItem};
function render() {
  const route=current();
  for(const a of document.querySelectorAll('nav a')) {
    if(a.hash==='#'+route) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  }
  app.innerHTML=state.profile?(Object.hasOwn(pages,route)?pages[route]:todayPage)():`<div class="page-title"><h1>开始你的居家训练</h1><p>先记录训练基线。体测可以稍后在「进展」录入。</p></div>${card('训练基线',profileForm())}`;
  updateTimer();
}
function go(route) {
  if(current()===route) render();
  else location.hash=route;
  window.scrollTo(0,0);
}
function updateTimer() {
  const out=document.querySelector('#timer');
  if(!out) return;
  const seconds=Math.max(0,Math.ceil((state.draft.restUntil-Date.now())/1000));
  out.textContent=seconds?seconds+' 秒':'休息完成';
}
const findItem=id=>id?schedule(state,id.slice(0,10)).find(item=>item.id===id):null;
async function save(next,route) {
  await write(next);
  state=next;
  if(route) go(route); else render();
}
function advance(d,nextIndex,rest=true) {
  d.index=nextIndex;
  d.phase=nextIndex>=d.steps.length?'summary':rest?'rest':'set';
  d.restUntil=d.phase==='rest'?Date.now()+60000:0;
}
async function handleAction(button) {
  const {action,id,kind,index}=button.dataset;
  const item=findItem(id);
  const next=structuredClone(state);
  const d=next.draft;
  switch(action) {
    case 'prev': case 'next': week=plus(week,action==='prev'?-7:7); render(); return;
    case 'inspect': changing=id; go('item'); return;
    case 'back-week': go('week'); return;
    case 'resume': go('workout'); return;
    case 'short': case 'start':
      if(d) {go('workout'); return;}
      if(item?.date>today()||!item||!strength(item)||completed(state.sessions[id])) return;
      next.draft=draftFor(state,item,action==='short');
      await save(next,'workout'); return;
    case 'activity':
      if(!item||completed(state.sessions[id])||item.date>today()&&kind!=='skip') return;
      next.sessions[id]={...item,status:kind==='skip'?'skipped':'done',activity:kind};
      await save(next); return;
    case 'warm-done': d.phase='set'; break;
    case 'rest-done': d.phase='set'; break;
    case 'extend': d.restUntil=Math.max(Date.now(),d.restUntil)+15000; break;
    case 'incline':
      for(const s of d.steps.slice(d.index).filter(s=>s.id==='push')) s.variant='incline';
      break;
    case 'pain': {
      const s=d.steps[d.index];
      d.records.push({...s,reps:0,pain:true});
      let i=d.index+1;
      while(d.steps[i]?.id===s.id) i++;
      advance(d,i); break;
    }
    case 'apply': case 'dismiss': {
      const proposal=suggestions(state)[Number(index)];
      if(!proposal) return;
      const {id,next:p,week}=proposal;
      next.history.push({...proposal,previous:state.plans[id]??null,date:today(),dismissed:action==='dismiss'});
      if(action==='apply') next.plans[id]=week?{...p,week}:p;
      break;
    }
    case 'undo': {
      const i=next.history.findLastIndex(h=>!h.dismissed);
      const last=next.history[i];
      if(!last||last.dismissed) return;
      next.history.splice(i,1);
      if(last.previous) next.plans[last.id]=last.previous;
      else delete next.plans[last.id];
      break;
    }
    case 'export': {
      const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
      const a=document.createElement('a');
      a.href=url; a.download='home-fitness-backup-'+today()+'.json'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      return;
    }
    case 'clear':
      if(confirm('清空此设备上的训练、体测和设置？')) await save(initial(),'today');
      return;
    default: return;
  }
  await save(next);
}
async function handleForm(form) {
  const data=new FormData(form);
  const next=structuredClone(state);
  const d=next.draft;
  switch(form.dataset.form) {
    case 'profile': {
      const input=String(data.get('weights')).trim();
      const weights=input?input.split(/[\s,，]+/).map(Number):[];
      if(weights.some(n=>!Number.isFinite(n)||n<=0||n>100)) throw new Error('请输入有效的哑铃档位（每只 0–100 kg）。');
      next.profile={max:Number(data.get('max')),weights:[...new Set(weights)].sort((a,b)=>a-b)};
      await save(next,'today'); return;
    }
    case 'measure': {
      const date=String(data.get('date'));
      const values=Object.fromEntries(['weight','waist','fat','bmi'].filter(k=>data.get(k)!=='').map(k=>[k,Number(data.get(k))]));
      if(!Object.keys(values).length) throw new Error('请至少填写一项体测。');
      next.measures[date]={...next.measures[date],...values}; break;
    }
    case 'shift': {
      const item=findItem(changing);
      const date=String(data.get('date'));
      if(!item||completed(state.sessions[item.id])||state.draft?.id===item.id||!candidates(state,item).includes(date)) throw new Error('这个日期现在不可用。');
      next.shifts[item.id]=date;
      if(next.sessions[item.id]?.status==='skipped') delete next.sessions[item.id];
      week=monday(date); await save(next,'week'); return;
    }
    case 'set': {
      const s=d.steps[d.index];
      const kg=data.has('kg')?Number(data.get('kg')):s.kg;
      d.records.push({...s,reps:Number(data.get('reps')),kg,effort:data.get('effort')});
      const following=d.steps[d.index+1];
      if(following?.id===s.id) following.kg=kg;
      advance(d,d.index+1,!(s.side==='左'&&following?.side==='右'));
      break;
    }
    case 'finish': {
      const {id,kind,date,short,records}=d;
      next.sessions[id]={id,kind,date,short,records,recovery:data.get('recovery'),status:records.length===d.steps.length&&records.every(r=>r.reps>0&&!r.pain)?'done':'partial'};
      next.draft=null;
      await save(next,'today'); return;
    }
    default:return;
  }
  await save(next);
}
async function guard(action) {
  if(busy) return;
  busy=true;
  try {await action();} catch(error) {alert(error.message||'保存失败，请重试。');}
  finally {busy=false;}
}
app.addEventListener('click',event=>{
  const b=event.target.closest('button[data-action]');
  if(b) guard(()=>handleAction(b));
});
app.addEventListener('submit',event=>{
  event.preventDefault();
  guard(()=>handleForm(event.target));
});
app.addEventListener('input',event=>{
  if(event.target.id==='reps') document.querySelector('#complete').textContent='完成 '+(event.target.value||0)+' 个';
});
app.addEventListener('change',event=>{
  const file=event.target.id==='backup'&&event.target.files[0];
  if(file) guard(async()=>{
    const imported=JSON.parse(await file.text());
    if(!validBackup(imported)) throw new Error('备份格式有误。');
    if(confirm('用这份备份覆盖当前设备上的记录？')) await save(imported,'today');
    else event.target.value='';
  });
});
window.addEventListener('hashchange',()=>state&&render());
setInterval(updateTimer,250);
try {
  state=(await read())??initial();
  render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
} catch(error) {
  app.innerHTML='<p>无法读取本机数据。请检查浏览器的存储设置后重新打开。</p>';
  console.error(error);
}
