
import { exportMarkdown } from '@/lib/exportMd';
import { claudeSkill, chatgptInstructions, skillSlug } from '@/lib/agentExport';
import { flowHtml, columnsOf } from '@/lib/flowHtml';
import { cleanTag, cleanTags } from '@/lib/tags';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rid = p => p + Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const KINDS = ['start','task','decision','subprocess','end'];
const ss = { get(k){ try { return sessionStorage.getItem(k); } catch { return null; } }, set(k,v){ try { sessionStorage.setItem(k,v); } catch {} } };

/* ---------- Example processes (shown as examples, read-only until you change them) ---------- */
const st = (id,lane,label,kind,next=[],extra={}) => ({id,lane,label,kind,uses:[],next:next.map(n=>typeof n==='string'?{to:n}:{to:n[0],label:n[1]}),...extra});
const EX_EGG = {
  id:'ex_egg', example:true, visibility:'public', title:'Fry an egg', updatedAt:0, tags:['daily life','cooking'],
  maps:{
    m_root:{ id:'m_root', title:'Fry an egg', parent:null,
      lanes:[{id:'e_cook',name:'Cook',type:'person'},{id:'e_stove',name:'Stove',type:'system'}],
      steps:[
        st('f1','e_cook','Want a fried egg','start',['f2']),
        st('f2','e_cook','Prepare the pan','subprocess',['f3'],{child:'m_f2'}),
        st('f3','e_cook','Crack the egg','subprocess',['f4'],{child:'m_f3'}),
        st('f4','e_stove','Cook until whites set','task',['f5']),
        st('f5','e_cook','Over easy?','decision',[['f6','Yes'],['n1','No']]),
        st('f6','e_cook','Flip gently with a spatula','task',['f6a']),
        st('f6a','e_cook','Yolk still whole?','decision',[['f6b','Yes'],['f6c','No']]),
        st('f6b','e_cook','Cook 20 seconds, yolk runny','task',['f7']),
        st('f6c','e_cook','Break it and cook 1 more minute','task',['f7']),
        st('n1','e_cook','Keep it sunny side up','task',['n2']),
        st('n2','e_cook','Spoon hot butter over the whites','task',['n3']),
        st('n3','e_cook','Whites fully set?','decision',[['f7','Yes'],['n4','No']]),
        st('n4','e_cook','Cover with a lid, 30 seconds','task',['n3']),
        st('f7','e_cook','Slide onto a plate','task',['f8']),
        st('f8','e_cook','Turn off the burner','task',['f9'],{uses:['e_stove']}),
        st('f9','e_cook','Eat','end')
      ]},
    m_f2:{ id:'m_f2', title:'Prepare the pan', parent:{map:'m_root',step:'f2'},
      lanes:[{id:'g_cook',name:'Cook',type:'person'},{id:'g_stove',name:'Stove',type:'system'}],
      steps:[
        st('g1','g_cook','Put pan on burner','start',['g2']),
        st('g2','g_cook','Set heat to medium','task',['g3'],{uses:['g_stove']}),
        st('g3','g_stove','Heat the pan','task',['g4']),
        st('g4','g_cook','Add butter or oil','task',['g5']),
        st('g5','g_cook','Butter sizzling?','decision',[['g6','Yes'],['g3','No']]),
        st('g6','g_cook','Pan ready','end')
      ]},
    m_f3:{ id:'m_f3', title:'Crack the egg', parent:{map:'m_root',step:'f3'},
      lanes:[{id:'c_cook',name:'Cook',type:'person'}],
      steps:[
        st('c1','c_cook','Pick up an egg','start',['c2']),
        st('c2','c_cook','Tap on a flat surface','task',['c3']),
        st('c3','c_cook','Open shell over the pan','task',['c4']),
        st('c4','c_cook','Shell in the pan?','decision',[['c5','Yes'],['c6','No']]),
        st('c5','c_cook','Fish out the shell','subprocess',['c6'],{child:'m_c5'}),
        st('c6','c_cook','Egg in the pan','end')
      ]},
    m_c5:{ id:'m_c5', title:'Fish out the shell', parent:{map:'m_f3',step:'c5'},
      lanes:[{id:'k_cook',name:'Cook',type:'person'}],
      steps:[
        st('k1','k_cook','Spot a shell piece','start',['k2']),
        st('k2','k_cook','Scoop it with a shell half','task',['k3']),
        st('k3','k_cook','Got it all?','decision',[['k4','Yes'],['k2','No']]),
        st('k4','k_cook','Shell removed','end')
      ]}
  },
  chat:[
    {role:'user',content:'How I fry an egg. First I get the pan ready, then I crack the egg in.'},
    {role:'assistant',content:'Added you as the cook, the stove, and two subprocesses: "Prepare the pan" and "Crack the egg".',ask:'How do you know the pan is hot enough?'},
    {role:'user',content:'When the butter sizzles. And if a bit of shell falls in, I scoop it out with the other half of the shell.'},
    {role:'assistant',content:'Added the sizzle check inside "Prepare the pan", and a "Fish out the shell" layer inside "Crack the egg".',ask:'Do you flip it, or cook it sunny side up?'}
  ],
  events:[]
};
const EX_CAR = {
  id:'ex_car', example:true, visibility:'public', title:'Start a car', updatedAt:0, tags:['daily life','driving'],
  maps:{ m_root:{ id:'m_root', title:'Start a car', parent:null,
    lanes:[{id:'d_drv',name:'Driver',type:'person'},{id:'d_key',name:'Key or key fob',type:'system'},{id:'d_car',name:'Car',type:'system'}],
    steps:[
      st('d1','d_drv','Sit in the driver’s seat','start',['d2']),
      st('d2','d_drv','Press the brake pedal','task',['d3']),
      st('d3','d_drv','Push-button start?','decision',[['d4','Yes'],['d5','No']]),
      st('d4','d_drv','Press Start','task',['d6'],{uses:['d_car']}),
      st('d6','d_car','Detect the key fob','task',['d7'],{uses:['d_key']}),
      st('d5','d_drv','Turn the key','task',['d7'],{uses:['d_key']}),
      st('d7','d_car','Crank the engine','task',['d8']),
      st('d8','d_drv','Engine running?','decision',[['d9','Yes'],['d2','No']]),
      st('d9','d_drv','Check dashboard lights','task',['d10']),
      st('d10','d_drv','Ready to drive','end')
    ]}},
  chat:[], events:[]
};
const EX_TEA = {
  id:'ex_tea', example:true, visibility:'public', title:'Make a cup of tea', updatedAt:0, tags:['daily life','cooking'],
  maps:{ m_root:{ id:'m_root', title:'Make a cup of tea', parent:null,
    lanes:[{id:'t_me',name:'Tea maker',type:'person'},{id:'t_kettle',name:'Kettle',type:'system'}],
    steps:[
      st('t1','t_me','Want tea','start',['t2']),
      st('t2','t_me','Fill and switch on kettle','task',['t3','t4'],{uses:['t_kettle']}),
      st('t3','t_kettle','Boil and click off','task',['t5']),
      st('t4','t_me','Tea bag in the mug','task',['t5']),
      st('t5','t_me','Pour the water','task',['t6']),
      st('t6','t_me','Steep 3–5 minutes','task',['t7']),
      st('t7','t_me','Milk or sugar?','decision',[['t8','Yes'],['t9','No']]),
      st('t8','t_me','Add and stir','task',['t9']),
      st('t9','t_me','Drink','end')
    ]}},
  chat:[], events:[]
};
const EXAMPLES = [EX_EGG, EX_CAR, EX_TEA];

/* ---------- State ---------- */
const S = { view:'login', me:null, ready:false,
  sort:'new', pubLimit:12, commentsData:null, voice:{ on:false, state:'idle', mute:false, note:'' }, guide:null, painView:false, q:'', tag:'', zoom:1, zoomAuto:true, detail:'auto', zoomKey:'', tool:'select', space:false, playing:false, playNow:null, playSeen:{}, drawNow:false,
  mine:[], shared:[], pub:[], cur:null, real:null, compare:null, panel:null, panelMsg:'', path:['m_root'], sel:null, busy:false, ctl:null,
  fresh:new Set(), save:'', tab:'chat', deep:false, confirmPub:false, confirmDel:null, acct:false, notice:'', toast:'',
  sessionTurns:0, askedThisSession:false, lastTurnId:null };

/* ---------- Talking to the server ---------- */
const ls = { get(k){ try { return localStorage.getItem(k); } catch { return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch {} }, del(k){ try { localStorage.removeItem(k); } catch {} } };
function freshKey(){ const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2,'0')).join(''); }
const API = {
  key: null,
  async call(path, opts = {}){
    const r = await fetch(path, { ...opts, headers:{ 'content-type':'application/json', 'x-ptw-key':API.key || '', ...(opts.headers || {}) } });
    let d = null; try { d = await r.json(); } catch {}
    if (!r.ok) throw { status:r.status, code:d?.code, message:d?.error || 'Something went wrong. Try again.' };
    return d;
  },
  get(p){ return API.call(p); },
  post(p, b){ return API.call(p, { method:'POST', body:JSON.stringify(b || {}) }); },
  put(p, b){ return API.call(p, { method:'PUT', body:JSON.stringify(b || {}) }); },
  del(p){ return API.call(p, { method:'DELETE' }); },
};

/* ---------- Helpers on the process model ---------- */
function newProcess(){
  const id = rid('p');
  return { id, title:'Untitled process', status:'interviewing', updatedAt:Date.now(),
    maps:{ m_root:{ id:'m_root', title:'Untitled process', parent:null, lanes:[], steps:[] } }, chat:[], events:[] };
}
const curMap = () => S.cur?.maps[S.path[S.path.length-1]] || S.cur?.maps.m_root;
const readOnly = p => !!(p?.example || p?.readonly);
function stats(p){
  const maps = Object.values(p.maps || {});
  let steps = 0; maps.forEach(m => steps += m.steps.length);
  const depthOf = m => { let d = 1, x = m; while (x?.parent && d < 20) { x = p.maps[x.parent.map]; d++; } return d; };
  const depth = maps.reduce((a,m)=>Math.max(a,depthOf(m)),1);
  const lanes = (p.maps?.m_root?.lanes || []);
  return { steps, depth, lanes };
}
function countSteps(p, mapId, seen = new Set()){
  const m = p.maps[mapId]; if (!m || seen.has(mapId)) return 0; seen.add(mapId);
  return m.steps.reduce((a,s)=> a + 1 + (s.child ? countSteps(p, s.child, seen) : 0), 0);
}
const normType = t => /sys|tech|tool|app|soft|platform/i.test(String(t||'')) ? 'system' : 'person';

/* Events go into the process (for the map's own history) and, for people and
   the system, to the server as learning signal. AI changes are sent with the turn. */
let outbox = [], outTimer = null;
function logEvent(p, e){
  p.events = p.events || []; p.events.push({ t:Date.now(), ...e });
  if (p.events.length > 300) p.events.splice(0, p.events.length - 300);
  if (e.who !== 'ai' && !readOnly(p)){
    const { who, op, ...data } = e;
    outbox.push({ processId:p.id, turnId:S.lastTurnId, who, type:op, data });
    clearTimeout(outTimer); outTimer = setTimeout(sendEvents, 2000);
  }
}
function track(type, data = {}, processId = S.cur?.id){
  outbox.push({ processId:processId || null, turnId:S.lastTurnId, who:'human', type, data });
  clearTimeout(outTimer); outTimer = setTimeout(sendEvents, 2000);
}
async function sendEvents(){
  if (!outbox.length) return;
  const batch = outbox.splice(0, 50);
  try { await flush(); await API.post('/api/events', { events:batch }); } catch {}
  if (outbox.length) outTimer = setTimeout(sendEvents, 2000);
}

/* Opening an example or someone's public process is read-only; the first change makes a private copy */
function ensureOwned(){
  const p = S.cur; if (!readOnly(p)) return;
  if (S.compare) closeCompare();
  const q = S.cur;
  const copy = clone(q);
  const from = q.example ? 'this example' : `“${q.title}” by ${q.publishedBy || q.owner}`;
  for (const k of ['example','readonly','publishedBy','publicId','publicMode','mine','role','owner','rev','version','openProposals','viewShare','shareCount']) delete copy[k];
  copy.id = rid('p'); copy.events = []; copy.undo = null; copy.rating = null;
  if (q.publicId && !q.viewShare){ copy.forkedFrom = q.publicId; API.post('/api/public/' + q.publicId, {}).catch(()=>{}); }
  copy.chat = (copy.chat || []).concat([{ role:'note', content:`Saved your own private copy of ${from}.` }]);
  S.cur = copy;
  track('copy_made', { from:q.publicId || q.id, example:!!q.example }, copy.id);
}
/* "Suggest changes" on a public process: a private draft tied to the version it started from */
function startSuggestion(){
  const q = S.real || S.cur; if (!q?.publicId || !q.readonly) return;
  if (S.compare) closeCompare();
  const d = clone(S.cur);
  for (const k of ['readonly','publishedBy','mine','role','owner','rev','openProposals','viewShare','example']) delete d[k];
  d.id = rid('p'); d.events = []; d.undo = null; d.rating = null; d.status = 'interviewing';
  d.proposalFor = q.publicId; d.proposalBase = q.version || 1; d.suggestTitle = q.title; d.suggestAuthor = q.publishedBy; delete d.publicId;
  d.chat = [{ role:'note', content:`You're suggesting changes to “${q.title}” by ${q.publishedBy}. Describe or make your changes, then choose “Submit for review”. Other people will compare before and after and vote.` }];
  S.cur = d; S.sel = null; S.panel = null; dirty = true;
  track('suggestion_started', { publicId:q.publicId }, d.id);
  flush(); renderWork();
}
/* ---------- Apply one AI or human change ---------- */
/* A "turn" carries what this AI turn may and may not do:
   pre       — step keys (map|id) that existed before the turn; the AI can only PROPOSE removing these
   alias     — lane ids the AI invented that duplicate an existing lane name, mapped to the existing lane
   proposals — removals waiting for the person to confirm */
function newTurn(p){
  const pre = new Set();
  Object.values(p.maps).forEach(m => m.steps.forEach(s => pre.add(m.id + '|' + s.id)));
  return { pre, alias:{}, proposals:[], ops:0, log:[], lastOp:null };
}
const laneRef = (turn, mapId, id) => (turn?.alias[mapId]?.[id]) || id;
function setStepFields(s, o, turn, mapId){
  if ('label' in o && o.label) s.label = String(o.label);
  if (o.lane) s.lane = laneRef(turn, mapId, String(o.lane));
  if (o.kind && KINDS.includes(o.kind)) s.kind = o.kind;
  if (Array.isArray(o.uses)) s.uses = [...new Set(o.uses.map(u => laneRef(turn, mapId, String(u))))];
}
function removeMapTree(p, mapId){
  const m = p.maps[mapId]; if (!m || mapId === 'm_root') return;
  m.steps.forEach(s => s.child && removeMapTree(p, s.child));
  delete p.maps[mapId];
}
function hardRemoveStep(p, m, s){
  if (s.child) removeMapTree(p, s.child);
  m.steps = m.steps.filter(x => x !== s);
  // drop links to it from every layer
  Object.values(p.maps).forEach(mm => mm.steps.forEach(x => x.next = x.next.filter(n => !(n.to === s.id && (n.map || mm.id) === m.id))));
}
const isInternal = (n, m) => !n.map || n.map === m.id;
function applyOp(p, o, who, turn){
  if (!o || typeof o !== 'object') return null;
  const m = o.map ? p.maps[o.map] : null;
  const find = (mm, id) => mm?.steps.find(s => s.id === String(id));
  let touched = null, logOp = o.op;
  switch (o.op){
    case 'rename_process':
      if (o.title){ p.title = String(o.title); p.maps.m_root.title = p.title; touched = 'title'; } break;
    case 'rename_map':
      if (m && o.title){ m.title = String(o.title); if (m.id === 'm_root') p.title = m.title; touched = 'title'; } break;
    case 'add_lane': case 'update_lane': {
      if (!m || !o.id) break;
      const id = String(o.id);
      let l = m.lanes.find(l => l.id === id);
      if (!l && o.op === 'add_lane'){
        const same = m.lanes.find(x => x.name.trim().toLowerCase() === String(o.name || '').trim().toLowerCase());
        if (same){ if (turn){ (turn.alias[m.id] ||= {})[id] = same.id; } touched = same.id; logOp = 'merge_duplicate_lane'; break; }
        m.lanes.push({ id, name:String(o.name || 'New lane'), type:normType(o.type) });
      } else if (l){ if (o.name) l.name = String(o.name); if (o.type) l.type = normType(o.type); }
      touched = id; break; }
    case 'remove_lane': {
      if (!m) break;
      const id = laneRef(turn, m.id, String(o.id));
      if (m.steps.some(s => s.lane === id)) break;          // never strand steps
      m.lanes = m.lanes.filter(l => l.id !== id);
      m.steps.forEach(s => s.uses = (s.uses||[]).filter(u => u !== id));
      touched = id; break; }
    case 'add_step': case 'update_step': {
      if (!m || !o.id) break;
      let s = find(m, o.id);
      if (!s){ if (o.op === 'update_step') break; s = { id:String(o.id), lane:null, label:'New step', kind:'task', uses:[], next:[] }; m.steps.push(s); }
      setStepFields(s, o, turn, m.id);
      delete s.proposedRemove;
      if (o.after){ const a = find(m, o.after); if (a && a !== s && !a.next.some(n => isInternal(n, m) && n.to === s.id)) a.next.push({ to:s.id, label:o.after_label ? String(o.after_label) : '' }); }
      touched = s.id; break; }
    case 'remove_step': {
      const s = find(m, o.id); if (!s) break;
      if (who === 'ai' && turn?.pre.has(m.id + '|' + s.id)){
        // Something the person already saw: propose, don't delete.
        if (!s.proposedRemove){ s.proposedRemove = true; turn.proposals.push({ map:m.id, id:s.id, label:s.label }); }
        touched = s.id; logOp = 'propose_remove'; break;
      }
      hardRemoveStep(p, m, s); touched = s.id; break; }
    case 'connect': case 'link': {
      const toMapId = o.to_map && p.maps[o.to_map] ? String(o.to_map) : (m && m.id);
      const a = find(m, o.from), b = find(p.maps[toMapId], o.to); if (!a || !b || a === b) break;
      const ext = toMapId !== m.id;
      const ex = a.next.find(n => n.to === b.id && (n.map || m.id) === toMapId);
      if (ex){ if (o.label) ex.label = String(o.label); }
      else a.next.push({ to:b.id, label:o.label ? String(o.label) : '', ...(ext ? { map:toMapId } : {}) });
      if (ext) logOp = 'link';
      touched = a.id; S.fresh.add(b.id); break; }
    case 'disconnect': case 'unlink': {
      const a = find(m, o.from); if (!a) break;
      const toMapId = o.to_map || m.id;
      a.next = a.next.filter(n => !(n.to === String(o.to) && (n.map || m.id) === toMapId)); touched = a.id; break; }
    case 'add_map': {
      const parent = p.maps[o.parent_map], st = find(parent, o.parent_step);
      if (!st || !o.id) break;
      const id = String(o.id);
      if (!p.maps[id]) p.maps[id] = { id, title:String(o.title || st.label), parent:{ map:parent.id, step:st.id }, lanes:[], steps:[] };
      st.kind = 'subprocess'; st.child = id; touched = st.id; break; }
    case 'done':
      p.status = 'done'; touched = 'status'; break;
  }
  if (turn) turn.lastOp = touched ? logOp : null;
  if (touched){
    S.fresh.add(touched);
    if (turn) turn.ops++;
    logEvent(p, { who, op:logOp, map:o.map || o.parent_map || null, id:o.id || o.from || null });
  }
  return touched;
}
/* Remove links that point at steps that no longer exist */
function tidy(p){
  Object.values(p.maps).forEach(m => m.steps.forEach(s => {
    s.next = s.next.filter(n => { const t = p.maps[n.map || m.id]; return t && t.steps.some(x => x.id === n.to); });
  }));
}

/* ---------- Checks the system runs after every AI turn ---------- */
function incomingLinks(p, mapId, stepId){
  const out = [];
  Object.values(p.maps).forEach(m => m.steps.forEach(s => s.next.forEach(n => {
    if (n.to === stepId && n.map === mapId && m.id !== mapId) out.push({ map:m.id, step:s });
  })));
  return out;
}
const issueKey = i => i.map + '|' + (i.step || '') + '|' + i.kind;
function findIssues(p){
  const dismissed = new Set(p.dismissed || []);
  return rawIssues(p).map(i => ({ ...i, key:issueKey(i), at:i.at || i.map })).filter(i => !dismissed.has(i.key));
}
function rawIssues(p){
  const out = [];
  for (const m of Object.values(p.maps)){
    if (!m.steps.length){ if (m.parent) out.push({ kind:'sub_empty', map:m.id, at:m.parent.map, step:m.parent.step, text:`“${m.title}” has no steps yet` }); continue; }
    const laneIds = new Set(m.lanes.map(l => l.id));
    const into = new Set();
    m.steps.forEach(s => s.next.forEach(n => { if (isInternal(n, m)) into.add(n.to); }));
    const names = {};
    m.lanes.forEach(l => { const k = l.name.trim().toLowerCase(); if (names[k]) out.push({ kind:'dup_lane:' + k, map:m.id, text:`Two lanes are named “${l.name}”` }); names[k] = 1; });
    m.steps.forEach(s => {
      const outs = s.next.length;
      const internalIn = into.has(s.id) || incomingLinks(p, m.id, s.id).length;
      if (s.kind !== 'start' && !internalIn && m.steps.length > 1) out.push({ kind:'no_incoming', map:m.id, step:s.id, text:`Nothing leads to “${s.label}”` });
      if (s.kind !== 'end' && !outs) out.push({ kind:'dead_end', map:m.id, step:s.id, text:`“${s.label}” doesn't lead anywhere` });
      if (s.kind === 'decision'){
        if (outs < 2) out.push({ kind:'decision_outcomes', map:m.id, step:s.id, text:`Decision “${s.label}” needs at least two outcomes` });
        else if (s.next.some(n => !n.label)) out.push({ kind:'decision_labels', map:m.id, step:s.id, text:`Label each outcome of “${s.label}”` });
      } else if (outs > 1 && s.next.every(n => !n.label)) out.push({ kind:'split', map:m.id, step:s.id, text:`“${s.label}” splits into ${outs} paths. Is it a decision, or do they happen at the same time?` });
      if (!laneIds.has(s.lane)) out.push({ kind:'no_lane', map:m.id, step:s.id, text:`No one is assigned to “${s.label}”` });
      if (s.kind === 'subprocess' && !s.child && !s.link) out.push({ kind:'sub_no_child', map:m.id, step:s.id, text:`“${s.label}” has no detail yet` });
    });
    if (!m.steps.some(s => s.kind === 'start') && m.steps.length > 1) out.push({ kind:'no_start', map:m.id, text:`“${m.title}” has no starting point` });
  }
  return out;
}

/* ---------- Never show internal ids to people ---------- */
function idNames(p){
  const d = {};
  for (const m of Object.values(p.maps)){
    d[m.id] = m.id === 'm_root' ? 'the main flow' : '“' + m.title + '”';
    m.lanes.forEach(l => { d[l.id] ||= l.name; });
    m.steps.forEach(s => { d[s.id] ||= '“' + s.label + '”'; });
  }
  return d;
}
function humanize(p, text){
  if (!text) return text;
  const d = idNames(p);
  return String(text)
    .replace(/\(\s*(m_[A-Za-z0-9_]+|[a-z]{1,3}\d+[A-Za-z0-9_]*)\s*\)/g, (all, id) => d[id] ? '' : all)
    .replace(/\b(m_[A-Za-z0-9_]+|[a-z]{1,3}\d+[A-Za-z0-9_]*)\b/g, (id) => d[id] || id)
    .replace(/“([^”]+)”\s*“\1”/g, '“$1”').replace(/\s{2,}/g, ' ').trim();
}

/* ---------- What the server needs to see of the map ---------- */
function compactModel(p){
  const maps = {};
  for (const m of Object.values(p.maps)){
    maps[m.id] = { title:m.title, parent:m.parent, lanes:m.lanes.map(l=>[l.id,l.name,l.type]),
      steps:m.steps.map(s=>({ id:s.id, lane:s.lane, label:s.label, kind:s.kind, ...(s.uses?.length?{uses:s.uses}:{}),
        ...(s.next.length?{next:s.next.map(n=> n.map && n.map !== m.id ? ['→'+n.map, n.to, n.label||''] : n.label ? [n.to,n.label] : n.to)}:{}),
        ...(s.child?{child:s.child}:{}), ...(s.proposedRemove?{pending_removal:true}:{}) })) };
  }
  return JSON.stringify({ title:p.title, status:p.status === 'done' ? 'DONE' : 'interviewing', maps });
}
function convoText(history){
  return history.map(x => x.role === 'user' ? 'User: ' + x.content : 'You: ' + x.content + (x.ask ? ' ' + x.ask : '')).join('\n');
}
/* ---------- Similarity, for "I retyped that" ---------- */
function similar(a, b){
  a = a.trim().toLowerCase(); b = b.trim().toLowerCase();
  if (!a || !b || a === b) return a === b;
  if (Math.max(a.length, b.length) > 240) return false;
  const dp = Array.from({length:a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length) >= 0.7;
}

/* ---------- Talk to the mapper ---------- */
/* Audio mode: talk to the interviewer. It listens, builds the map, then speaks its next question back. */
const SRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const voiceOK = () => !!SRec && typeof speechSynthesis !== 'undefined';
let rec = null, recTimer = 0, recFinal = '', recActive = false, voiceGen = 0;
const VOICE_OPENER = "Tell me about a process: what it's called, who's involved, and what happens first.";
function setVoice(state, note){ S.voice.state = state; S.voice.note = note || ''; renderVoice(); }
function renderVoice(){
  const b = $('#voice'); if (b) b.classList.toggle('on', S.voice.on);
  const el = $('#voicepanel'); if (!el) return;
  const v = S.voice;
  if (!v.on){ el.innerHTML = ''; return; }
  const label = { listening:'Listening…', thinking:'Thinking…', speaking:'Speaking…', idle:'Paused' }[v.state] || '';
  el.innerHTML = `<div class="vp"><button class="orb ${v.state}" data-v="orb" aria-label="${v.state === 'speaking' ? 'Skip the question and answer now' : v.state === 'listening' ? 'Done talking, send it' : 'Start listening'}"><i></i><i></i><i></i></button>
    <div class="vp-t"><b>${label}</b><span>${esc(v.note || (v.state === 'listening' ? 'Say what happens, or answer the question. Pause when you are done.' : ''))}</span></div>
    <div class="vp-acts"><button class="btn sm" data-v="mute" aria-pressed="${v.mute}">${v.mute ? 'Voice off' : 'Voice on'}</button><button class="btn sm" data-v="stop">Stop</button></div></div>`;
}
function onVoiceClick(e){
  const b = e.target.closest('[data-v]'); if (!b) return;
  const a = b.dataset.v;
  if (a === 'stop') stopVoice();
  else if (a === 'mute'){ S.voice.mute = !S.voice.mute; if (S.voice.mute) speechSynthesis.cancel(); renderVoice(); }
  else if (a === 'orb'){
    if (S.voice.state === 'speaking'){ speechSynthesis.cancel(); voiceGen++; listen(); }
    else if (S.voice.state === 'listening') finishListening();
    else if (S.voice.state === 'idle') listen();
  }
}
function stopRec(){ clearTimeout(recTimer); recActive = false; try { rec?.abort(); } catch {} rec = null; }
function stopVoice(){
  voiceGen++; S.voice.on = false; S.voice.state = 'idle'; S.voice.note = '';
  stopRec(); try { speechSynthesis?.cancel(); } catch {}
  renderVoice();
}
function startVoice(){
  if (!voiceOK()){ alertBox('Audio mode works in Chrome, Edge and Safari. In other browsers, use your keyboard’s dictation key.'); return; }
  const p = S.cur; if (!p || S.busy) return;
  ensureOwned(); S.tab = 'chat'; S.voice.on = true; S.voice.mute = false; renderWork();
  track('voice_started', {}, S.cur.id);
  const last = [...S.cur.chat].reverse().find(m => m.role === 'assistant' && !m.pending && !m.err);
  const opener = last ? [last.ask || last.content] : [VOICE_OPENER];
  setVoice('speaking', opener[0]);
  speak(opener[0], () => listen());
}
function pickVoice(){
  const vs = speechSynthesis.getVoices(), lang = (navigator.language || 'en-US').toLowerCase();
  return vs.find(v => v.lang.toLowerCase() === lang && /natural|google|samantha|premium|enhanced/i.test(v.name)) || vs.find(v => v.lang.toLowerCase() === lang) || vs.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) || null;
}
/* Speak in sentences: long utterances get cut off in some browsers */
function speak(text, done){
  const gen = ++voiceGen;
  if (S.voice.mute || !text){ done && done(); return; }
  speechSynthesis.cancel();
  const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || [text];
  const v = pickVoice();
  const next = i => {
    if (gen !== voiceGen || !S.voice.on) return;
    if (i >= parts.length){ done && done(); return; }
    const u = new SpeechSynthesisUtterance(parts[i].trim()); if (v){ u.voice = v; u.lang = v.lang; } u.rate = 1.03;
    u.onend = () => next(i + 1); u.onerror = () => next(i + 1);
    speechSynthesis.speak(u);
  };
  next(0);
}
function listen(){
  if (!S.voice.on || S.busy) return;
  stopRec(); recFinal = '';
  const r = new SRec(); rec = r; recActive = true;
  r.lang = navigator.language || 'en-US'; r.continuous = true; r.interimResults = true;
  r.onresult = ev => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++){
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) recFinal += t + ' '; else interim += t;
    }
    const text = (recFinal + interim).trim();
    $('#msg').value = text; setVoice('listening', text);
    clearTimeout(recTimer); if (text) recTimer = setTimeout(finishListening, 1800);
  };
  r.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){ alertBox('The microphone is blocked. Allow it in your browser’s address bar, then try Talk again.'); stopVoice(); }
  };
  r.onend = () => { if (recActive && S.voice.on && S.voice.state === 'listening' && !S.busy) setTimeout(() => { if (recActive && S.voice.on && S.voice.state === 'listening') { try { r.start(); } catch {} } }, 250); };
  try { r.start(); setVoice('listening', ''); } catch { setVoice('idle', 'Tap the circle to start listening'); }
}
function finishListening(){
  const text = ($('#msg').value || '').trim();
  stopRec();
  if (!S.voice.on) return;
  if (!text){ listen(); return; }
  if (/^(stop|exit|cancel)( (talking|listening|voice))?$/i.test(text)){ $('#msg').value = ''; stopVoice(); return; }
  if (/\b(i'?m done|i am done|that'?s all|that is all|finish( the)? map)\b/i.test(text) && text.length < 60){ $('#msg').value = ''; setVoice('thinking', 'Finishing the map…'); finish(); return; }
  setVoice('thinking', '“' + text + '”');
  send(text);
}
function voiceAfterTurn(p, reply){
  if (!S.voice.on) return;
  if (reply.err){
    const credits = /out of credits/i.test(reply.content);
    setVoice('speaking', reply.content); speak(reply.content, () => credits ? stopVoice() : listen()); return;
  }
  const text = [reply.content, reply.fixed, reply.ask].filter(Boolean).join(' ');
  if (p.status === 'done'){ setVoice('speaking', reply.content); speak(reply.content, () => stopVoice()); return; }
  setVoice('speaking', reply.ask || reply.content);
  speak(text, () => listen());
}
const ERR = {
  not_configured:'The mapper isn’t set up yet. Try again soon.',
  rate_limited:'Too many requests right now. Wait a moment, then send again.',
  upstream_error:'The mapper was interrupted. Send your message again.',
  out_of_credits:'You’re out of credits. You’ll get more soon.',
};
function lastUserIndex(p){ for (let i = p.chat.length - 1; i >= 0; i--) if (p.chat[i].role === 'user') return i; return -1; }
/* Put the map back to how it was before the last message, and take that message out of the conversation */
function rewindLast(p){
  const i = lastUserIndex(p); if (i < 0 || !p.undo || p.undo.chatIndex !== i) return null;
  const text = p.chat[i].content;
  p.maps = clone(p.undo.maps); p.title = p.undo.title; p.status = p.undo.status;
  p.chat = p.chat.slice(0, i); p.undo = null;
  S.path = S.path.filter(id => p.maps[id]); if (!S.path.length) S.path = ['m_root'];
  S.sel = null;
  return text;
}
function editLast(){
  if (S.busy) return;
  const p = S.cur; const undone = p.undo?.turnId || S.lastTurnId; const text = rewindLast(p); if (text == null) return;
  S.lastTurnId = undone; logEvent(p, { who:'human', op:'edit_message' });
  touch(); renderWork();
  const msg = $('#msg'); msg.value = text; msg.focus();
}
/* Stream the mapper's reply from the server, one JSON change per line */
async function runAI(payload, onLine, ctl){
  let r;
  try {
    r = await fetch('/api/ai', { method:'POST', headers:{ 'content-type':'application/json', 'x-ptw-key':API.key || '' }, body:JSON.stringify(payload), signal:ctl.signal });
  } catch (e){ throw { code:e?.name === 'AbortError' ? 'cancelled' : 'upstream_error' }; }
  if (!r.ok){ let d = {}; try { d = await r.json(); } catch {} throw { code:d.code || (r.status === 402 ? 'out_of_credits' : r.status === 429 ? 'rate_limited' : 'upstream_error'), message:d.error }; }
  const id = r.headers.get('x-ai-call-id');
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', failed = false;
  const eat = raw => {
    const line = raw.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').replace(/,$/, '').trim();
    if (!line.startsWith('{')) return;
    let o; try { o = JSON.parse(line); } catch { return; }
    if (o.op === 'error'){ failed = true; return; }
    onLine(o);
  };
  try {
    for (;;){
      const { done, value } = await reader.read(); if (done) break;
      const lines = (buf + dec.decode(value, { stream:true })).split('\n'); buf = lines.pop(); lines.forEach(eat);
    }
  } catch (e){ if (ctl.signal.aborted) throw { code:'cancelled' }; throw { code:'upstream_error' }; }
  if (buf.trim()) eat(buf);
  if (failed) throw { code:'upstream_error' };
  return id;
}
/* Snapshot of whatever an AI change touches, for the before/after record */
function snapOf(p, o){
  const m = p.maps[o.map || o.parent_map];
  const pick = x => x ? clone(x) : null;
  switch (o.op){
    case 'add_lane': case 'update_lane': case 'remove_lane': return pick(m?.lanes.find(l => l.id === String(o.id)));
    case 'add_step': case 'update_step': case 'remove_step': return pick(m?.steps.find(s => s.id === String(o.id)));
    case 'connect': case 'disconnect': case 'link': case 'unlink': return pick(m?.steps.find(s => s.id === String(o.from)));
    case 'add_map': return pick(m?.steps.find(s => s.id === String(o.parent_step)));
    case 'rename_process': return { title:p.title };
    case 'rename_map': return m ? { title:m.title } : null;
    case 'done': return { status:p.status || 'interviewing' };
  }
  return null;
}
function recorder(p, turn, pass){
  return o => {
    const before = snapOf(p, o);
    const touched = applyOp(p, o, 'ai', turn);
    const kind = turn.lastOp;
    turn.log.push({ pass, op:String(o.op || ''), mapId:o.map || o.parent_map || null, targetId:o.id || o.from || null,
      result:!touched ? 'ignored' : kind === 'propose_remove' ? 'proposed_removal' : kind === 'merge_duplicate_lane' ? 'merged_duplicate' : 'applied',
      payload:o, before, after:snapOf(p, o) });
  };
}
function mapPayload(p, mapId, history, text){
  const prevAsk = [...p.chat].reverse().find(x => x.role === 'assistant' && x.ask);
  return { mode:'map', processId:p.id, model:compactModel(p), mapId, mapTitle:p.maps[mapId]?.title || '', status:p.status || 'interviewing',
    hasTech:Object.values(p.maps).some(mm => mm.lanes.some(l => l.type === 'system')), history, text, skippedLastQuestion:!!prevAsk?.askSkipped };
}
async function send(text){
  text = (text || '').trim();
  if (!text || S.busy) return;
  ensureOwned();
  let p = S.cur;

  // A near-copy of the last message is a retype: replace it instead of stacking a new instruction on top.
  const li = lastUserIndex(p);
  let retyped = false;
  if (li >= 0 && p.undo && p.undo.chatIndex === li && similar(p.chat[li].content, text) && p.chat[li].content.trim() !== text){
    S.lastTurnId = p.undo?.turnId || S.lastTurnId; rewindLast(p); retyped = true; logEvent(p, { who:'human', op:'retype_message' });
  }

  const mapId = curMap().id;
  const history = p.chat.filter(x => x.role === 'user' || x.role === 'assistant').map(x => ({ role:x.role, content:x.content, ask:x.ask || '' })).slice(-12);
  const payload = mapPayload(p, mapId, history, text);
  const mapBefore = clone(p.maps);
  p.undo = { maps:clone(p.maps), title:p.title, status:p.status || 'interviewing', chatIndex:p.chat.length };
  p.chat.push({ role:'user', content:text });
  if (retyped) p.chat.push({ role:'note', content:'Treated this as a corrected version of your last message.' });
  const reply = { role:'assistant', content:'', pending:true, ops:0 };
  p.chat.push(reply);
  S.busy = true; S.sessionTurns++; $('#msg').value = ''; renderWork();
  const ctl = new AbortController(); S.ctl = ctl;
  const turn = newTurn(p);
  const checksBefore = findIssues(p).map(i => i.text);
  const before = new Set(findIssues(p).map(i => i.map + '|' + (i.step || '') + '|' + i.text));
  let feedback = null, mainCallId = null, repairCallId = null, found = 0, repaired = 0, error = null;

  try {
    mainCallId = await runAI(payload, o => {
      if (o.op === 'reply'){ reply.content = String(o.say || ''); reply.ask = o.ask ? String(o.ask) : ''; feedback = o.feedback || null; }
      else recorder(p, turn, 'main')(o);
      reply.ops = turn.ops; queueRender();
    }, ctl);

    // Check the map before the person has to point anything out.
    tidy(p);
    const fresh = findIssues(p).filter(i => !before.has(i.map + '|' + (i.step || '') + '|' + i.text));
    if (fresh.length && turn.ops && !ctl.signal.aborted){
      found = fresh.length;
      reply.checking = true; queueRender();
      logEvent(p, { who:'system', op:'check_found', count:fresh.length, items:fresh.map(i => i.text).slice(0, 8) });
      let fix = null;
      repairCallId = await runAI({ mode:'repair', processId:p.id, model:compactModel(p), issues:fresh.map(i => ({ map:i.map, step:i.step || null, text:i.text })), history:[...history, { role:'user', content:text }] }, o => {
        if (o.op === 'reply') fix = o; else recorder(p, turn, 'repair')(o);
        reply.ops = turn.ops; queueRender();
      }, ctl).catch(() => null);
      tidy(p);
      const left = findIssues(p).filter(i => !before.has(i.map + '|' + (i.step || '') + '|' + i.text));
      repaired = fresh.length - left.length;
      logEvent(p, { who:'system', op:'check_repaired', fixed:repaired, left:left.length });
      if (fix?.say) reply.fixed = String(fix.say);
      if (fix?.ask && !reply.ask && p.status !== 'done') reply.ask = String(fix.ask);
      reply.checking = false;
    }
  } catch (e){
    error = e?.code || 'error';
    if (e?.code !== 'cancelled'){ reply.err = true; reply.content = ERR[e?.code] || e?.message || 'The mapper was interrupted. Send your message again.'; }
    else if (!reply.content) reply.content = 'Stopped.';
  }

  if (turn.proposals.length) reply.proposals = { items:turn.proposals, state:'open' };
  if (p.status === 'done'){ reply.ask = ''; reply.summary = true; }
  reply.content = humanize(p, reply.content); reply.ask = humanize(p, reply.ask); reply.fixed = humanize(p, reply.fixed);
  reply.pending = false;
  if (!reply.content) reply.content = turn.ops ? 'Updated the map.' : 'I could not turn that into changes. Try describing who does what, in order.';
  S.busy = false; S.ctl = null;
  touch(); renderWork();
  voiceAfterTurn(p, reply);

  // Record the turn: the training example.
  try {
    await flush();
    const fb = feedback && typeof feedback === 'object' ? { type:String(feedback.type || ''), category:String(feedback.category || ''), about:String(feedback.about || '') } : null;
    const d = await API.post('/api/turns', {
      processId:p.id, seq:p.chat.filter(x => x.role === 'user').length, mapId, userText:text, retyped,
      replySay:reply.content, replyAsk:reply.ask || '', feedback:fb,
      opsApplied:turn.log.filter(x => x.result === 'applied').length, removalsProposed:turn.proposals.length, checksFound:found, checksRepaired:repaired,
      mapBefore, mapAfter:p.maps, checksBefore, checksAfter:findIssues(p).map(i => i.text),
      mainCallId, repairCallId, error, ops:turn.log, skippedLastQuestion:payload.skippedLastQuestion,
    });
    reply.turnId = d.turnId; S.lastTurnId = d.turnId; if (p.undo) p.undo.turnId = d.turnId; touch();
  } catch {}
}

/* Removals the AI proposed, waiting on the person */
function resolveProposal(msgIndex, accept){
  ensureOwned();
  const p = S.cur, msg = p.chat[msgIndex]; if (!msg?.proposals || msg.proposals.state !== 'open') return;
  for (const it of msg.proposals.items){
    const m = p.maps[it.map]; const s = m?.steps.find(x => x.id === it.id); if (!s || !s.proposedRemove) continue;
    if (accept) hardRemoveStep(p, m, s); else delete s.proposedRemove;
  }
  msg.proposals.state = accept ? 'removed' : 'kept';
  const t0 = S.lastTurnId; if (msg.turnId) S.lastTurnId = msg.turnId;
  logEvent(p, { who:'human', op:accept ? 'confirm_remove' : 'reject_remove', count:msg.proposals.items.length });
  S.lastTurnId = t0;
  tidy(p); touch(); renderWork();
}

/* The person reviews a check: it's right as is, or the AI should fix it */
function issueAction(key, act){
  const p0 = S.cur; const it = findIssues(p0).find(i => i.key === key);
  if (act === 'restore'){ ensureOwned(); const p = S.cur; logEvent(p, { who:'human', op:'check_restored', count:(p.dismissed||[]).length }); p.dismissed = []; touch(); renderWork(); return; }
  if (!it) return;
  if (act === 'go'){ jumpTo(it.at, it.step); return; }
  ensureOwned(); const p = S.cur;
  if (act === 'ok'){
    (p.dismissed ||= []).push(key);
    logEvent(p, { who:'human', op:'check_dismissed', kind:it.kind, map:it.map, id:it.step || null, text:it.text });
    touch(); renderWork(); return;
  }
  if (act === 'decision'){
    const s = p.maps[it.map]?.steps.find(x => x.id === it.step); if (!s) return;
    logEvent(p, { who:'human', op:'check_made_decision', kind:it.kind, map:it.map, id:s.id, before:s.kind, after:'decision' });
    s.kind = 'decision'; touch(); renderWork();
    prefill(`“${s.label}” is a decision. The outcomes are: `); return;
  }
  if (act === 'fix'){
    logEvent(p, { who:'human', op:'check_sent_to_ai', kind:it.kind, map:it.map, id:it.step || null });
    S.checksOpen = false; renderWork();
    prefill(`Please fix this: ${it.text} `); return;
  }
}
function prefill(text){
  S.tab = 'chat'; renderWork();
  const msg = $('#msg'); msg.value = text; msg.focus(); msg.setSelectionRange(msg.value.length, msg.value.length);
}
function issueRowHTML(i, compact){
  return `<li class="chk">
    <span>${esc(i.text)}</span>
    <span class="chk-acts">
      ${!compact && i.step ? `<button class="btn ghost sm" data-chk="go" data-key="${esc(i.key)}">Show</button>` : ''}
      ${i.kind === 'split' ? `<button class="btn sm" data-chk="ok" data-key="${esc(i.key)}">They happen at the same time</button><button class="btn sm" data-chk="decision" data-key="${esc(i.key)}">Make it a decision</button>`
        : `<button class="btn sm" data-chk="ok" data-key="${esc(i.key)}">It's right as is</button>`}
      <button class="btn sm" data-chk="fix" data-key="${esc(i.key)}">Ask AI to fix</button>
    </span></li>`;
}
function renderChecks(){
  const box = $('#checks'); if (!box) return;
  if (!S.checksOpen){ box.innerHTML = ''; return; }
  const p = S.cur, all = findIssues(p), here = all.filter(i => i.map === curMap().id || i.at === curMap().id);
  const elsewhere = all.filter(i => !here.includes(i));
  const nd = (p.dismissed || []).length;
  box.innerHTML = `<div class="inspector checks" role="dialog" aria-label="Things to check">
    <div class="ins-head"><span class="label">To check in “${esc(curMap().id === 'm_root' ? p.title : curMap().title)}”</span><button class="btn ghost" data-chk="close" aria-label="Close">✕</button></div>
    ${here.length ? `<ul class="chk-list">${here.map(i => issueRowHTML(i)).join('')}</ul>` : '<p class="hint">Nothing to check on this layer.</p>'}
    ${elsewhere.length ? `<p class="hint">${elsewhere.length} more in other layers: ${[...new Set(elsewhere.map(i => p.maps[i.at]?.title || ''))].map(t => esc(t)).join(', ')}.</p>` : ''}
    <p class="hint">Marking an item “right as is” teaches the checker when it was wrong.${nd ? ` ${nd} marked right · <button class="linkish" data-chk="restore" data-key="">Show them again</button>` : ''}</p>
  </div>`;
}

/* Finish / resume */
function finish(){
  if (S.busy) return;
  ensureOwned(); const p = S.cur; p.status = 'done';
  logEvent(p, { who:'human', op:'finish' });
  p.chat.push({ role:'assistant', content:'Marked this map as finished.', summary:true });
  touch(); renderWork();
}
function resume(){
  ensureOwned(); const p = S.cur; p.status = 'interviewing';
  logEvent(p, { who:'human', op:'resume' });
  p.chat.push({ role:'note', content:'Back to mapping. I’ll ask questions again.' });
  touch(); renderWork();
}
function summaryHTML(p){
  const maps = Object.values(p.maps);
  let steps = 0, people = new Set(), tech = new Set();
  maps.forEach(m => { steps += m.steps.length; m.lanes.forEach(l => (l.type === 'system' ? tech : people).add(l.name)); });
  const issues = findIssues(p);
  const rate = readOnly(p) ? '' : p.rating == null
    ? `<div class="frate"><span class="label">Does this match how it really works?</span><span class="frate-row">${[1,2,3,4,5].map(n => `<button class="btn sm" data-frate="${n}" aria-label="${n} of 5">${n}</button>`).join('')}</span><span class="frate-ends"><span>Not at all</span><span>Exactly</span></span></div>`
    : p.rating < 5 && !p.ratingWhy ? `<div class="frate"><span class="label">Thanks. What's off? (optional)</span><span class="chips">${['Missing steps','Wrong people','Wrong order','Missing tools','Too much detail'].map(r => `<button class="chip" data-fwhy="${esc(r)}">${esc(r)}</button>`).join('')}</span></div>`
    : '<p class="ok">Thanks for rating this map.</p>';
  if (!readOnly(p) && p.rating == null) S.askedThisSession = true;
  return `<div class="summary">
    <div class="label">Map summary</div>
    <div class="sum-grid"><div><b>${steps}</b><span>steps</span></div><div><b>${stats(p).depth}</b><span>layers</span></div><div><b>${people.size}</b><span>people</span></div><div><b>${tech.size}</b><span>technology</span></div></div>
    ${people.size ? `<p><span class="label">People</span> ${esc([...people].join(', '))}</p>` : ''}
    <p><span class="label">Technology</span> ${tech.size ? esc([...tech].join(', ')) : 'None captured'}</p>
    ${issues.length ? `<p><span class="label">Still to check</span></p><ul>${issues.slice(0,5).map(i => `<li>${esc(i.text)}</li>`).join('')}</ul>` : '<p class="ok">Every step is connected.</p>'}
    ${rate}
  </div>`;
}

/* ---------- Saving ---------- */
let saveTimer = null, savePromise = null, dirty = false;
function setSave(t){ S.save = t; const el = $('#save'); if (el) el.textContent = t; }
function keptUndo(p){
  // the saved chat keeps the last 40 messages; keep the undo point only if its message survives
  const live = p.chat.filter(x => !x.pending); const drop = Math.max(0, live.length - 40);
  if (!p.undo || p.chat.some(x => x.pending) || p.undo.chatIndex < drop) return null;
  return { ...p.undo, chatIndex:p.undo.chatIndex - drop };
}
function serialize(p){
  const st = stats(p);
  return { id:p.id, title:p.title, updatedAt:p.updatedAt, stepCount:st.steps, depth:st.depth, laneTypes:st.lanes.map(l=>l.type).slice(0,8),
    tags:cleanTags(p.tags), status:p.status || 'interviewing', forkedFrom:p.forkedFrom || null, proposalFor:p.proposalFor || null, proposalBase:p.proposalBase ?? null,
    suggestTitle:p.suggestTitle || null, suggestAuthor:p.suggestAuthor || null, submitted:p.submitted || null,
    rating:p.rating ?? null, dismissed:(p.dismissed || []).slice(-200),
    maps:p.maps, undo:keptUndo(p), chat:p.chat.filter(x=>!x.pending).slice(-40), events:(p.events||[]).slice(-300) };
}
function touch(){ if (!S.cur || readOnly(S.cur)) return; S.cur.updatedAt = Date.now(); dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900); setSave('Unsaved changes'); }
/* Load a saved process the way the server describes it (who owns it, your role) */
function fromServer(id, d){
  const p = { ...d.doc, id, rev:d.rev, role:d.role, owner:d.owner, publicId:d.publicId || null, publicMode:d.publicMode || null, proposalFor:d.proposalFor || d.doc.proposalFor || null, proposalBase:d.proposalBase ?? d.doc.proposalBase ?? null };
  if (d.role === 'view'){ p.readonly = true; p.viewShare = true; p.publishedBy = d.owner; }
  p.chat = p.chat || []; p.events = p.events || [];
  return p;
}
async function flush(){
  if (savePromise){ await savePromise; if (!dirty) return; }
  const p = S.cur; if (!p || readOnly(p) || !dirty) return;
  dirty = false; clearTimeout(saveTimer);
  savePromise = (async () => {
    setSave('Saving…');
    try {
      const d = await API.put('/api/processes/' + p.id, { doc:serialize(p), baseRev:p.rev || 0 });
      p.rev = d.rev; setSave('Saved');
      if (!p.role || p.role === 'owner'){
        const row = { id:p.id, title:p.title, status:p.status, stepCount:stats(p).steps, depth:stats(p).depth, laneTypes:stats(p).lanes.map(l => l.type), updatedAt:p.updatedAt, publicId:p.publicId || null, publicMode:p.publicMode || null, proposalFor:p.proposalFor || null, shareCount:p.shareCount || 0 };
        S.mine = [row, ...S.mine.filter(x => x.id !== p.id)];
      }
    } catch (e){
      if (e?.status === 409 && e.code !== 'outdated'){ await reloadCurrent('Someone else changed this process while you were editing, so it was reloaded with their version.'); return; }
      dirty = true; setSave(e?.status === 413 ? 'Too large to save' : e?.status === 403 ? 'View only' : 'Not saved — will retry');
      if (e?.status !== 403 && e?.status !== 413){ clearTimeout(saveTimer); saveTimer = setTimeout(flush, 5000); }
    }
  })();
  try { await savePromise; } finally { savePromise = null; }
}
async function reloadCurrent(note){
  const p = S.cur; if (!p) return;
  try {
    const d = await API.get('/api/processes/' + p.id);
    const fresh = fromServer(p.id, d);
    fresh.shareCount = p.shareCount;
    S.cur = fresh; dirty = false;
    S.path = S.path.filter(id => fresh.maps[id]); if (!S.path.length) S.path = ['m_root'];
    if (note) fresh.chat.push({ role:'note', content:note });
    setSave('Saved'); renderWork();
  } catch {}
}
/* While a shared process is open, pick up other people's saves */
setInterval(async () => {
  const p = S.cur;
  if (S.view !== 'work' || !p || S.busy || dirty || savePromise || readOnly(p) || document.hidden) return;
  if (!(p.role === 'edit' || (p.shareCount || 0) > 0)) return;
  try { const d = await API.get('/api/processes/' + p.id + '?rev=1'); if (S.cur === p && d.rev > (p.rev || 0)) reloadCurrent('Updated with the latest changes from people you share this with.'); } catch {}
}, 15000);
async function deleteProcess(id){
  S.confirmDel = null;
  if (S.cur?.id === id){ clearTimeout(saveTimer); dirty = false; }
  S.mine = S.mine.filter(x => x.id !== id); S.shared = S.shared.filter(x => x.id !== id);
  S.pub = S.pub.filter(x => x.processId !== id);
  if (S.cur?.id === id){ S.cur = null; S.view = 'home'; }
  render();
  try { await API.del('/api/processes/' + id); } catch { S.notice = 'Could not delete that process. Try again.'; render(); }
}
async function publish(note, mode){
  const p = S.cur; if (!p || readOnly(p) || S.busy) return;
  S.panel = null; dirty = true;
  try {
    await flush();
    const d = await API.post('/api/processes/' + p.id + '/publish', { note:note || '', mode:mode || undefined });
    const first = !!d.published; 
    p.publicId = d.publicId; if (first) p.publicMode = d.mode || 'collaborative';
    logEvent(p, { who:'human', op:first ? 'publish' : 'publish_update' });
    p.chat.push({ role:'note', content:first ? (p.publicMode === 'locked' ? `Published as is under ${S.me?.handle}. Anyone can open it. To change it, they make their own copy.` : `Published as ${S.me?.handle}. Anyone can open it. People can suggest changes, and changes go live when the votes agree.`)
      : d.updated ? 'Public version updated.' : 'Your update was submitted as a suggested change to the public version. It goes live when the votes agree.' });
    touch(); loadPublic();
  } catch (e){ p.chat.push({ role:'note', content:'Could not publish: ' + (e?.message || 'try again.') }); }
  S.tab = 'chat'; renderWork();
}
async function unpublish(){
  const p = S.cur; if (!p?.publicId) return;
  S.panel = null;
  try {
    await API.del('/api/processes/' + p.id + '/publish');
    p.publicId = null; p.publicMode = null; logEvent(p, { who:'human', op:'unpublish' });
    p.chat.push({ role:'note', content:'Removed from public processes.' }); touch(); loadPublic();
  } catch {}
  renderWork();
}
async function submitSuggestion(note){
  const p = S.cur; if (!p?.proposalFor) return;
  try {
    dirty = true; await flush();
    const d = await API.post('/api/public/' + p.proposalFor + '/proposals', { processId:p.id, note });
    p.submitted = d.proposalId; S.panel = null;
    logEvent(p, { who:'human', op:'proposal_submitted', proposalId:d.proposalId });
    p.chat.push({ role:'note', content:'Submitted for review. People can now compare before and after and vote. You can keep editing and submit again; the newest submission replaces the earlier one.' });
    touch();
  } catch (e){ S.panelMsg = e.message; }
  S.tab = 'chat'; renderWork();
}
async function loadMine(){ try { const d = await API.get('/api/processes'); S.mine = d.processes; S.shared = d.shared || []; } catch {} if (S.view === 'home' || S.view === 'login') render(); }
async function loadPublic(){ try { S.pub = (await API.get('/api/public')).processes; } catch {} if (S.view === 'home') render(); }
/* ---------- Sharing ---------- */
const RULE_SHORT = 'A change goes live when “after is better” leads by 2 votes; the person who suggested it counts as one.';
async function loadShares(){
  const p = S.cur;
  try { S.shareData = await API.get('/api/processes/' + p.id + '/shares'); }
  catch (e){ S.shareData = { error:e.status === 404 ? 'Save the process first, then share it.' : e.message, people:[] }; }
  p.shareCount = (S.shareData.people || []).length;
  if (S.panel === 'share') renderPanel();
  renderTopActions();
}
/* Publishing lives with sharing: the creator can open a process to everyone, collaboratively or as is */
function publishHTML(d){
  const p = S.cur;
  if (!d.canManage || p.proposalFor || !p.maps.m_root.steps.length) return '';
  if (!p.publicId) return `<form class="pubbox" data-form="publish"><p class="label">${ICON.globe} Publish to everyone</p>
    <p class="hint">Anyone can open, like, share and copy it. Only you can change it.</p>
    <div class="prop-acts"><button class="btn primary sm">Publish</button></div></form>`;
  return `<div class="pubbox"><p class="label">${ICON.globe} Public</p>
    <p class="hint">Anyone can open, like, share and copy it. Only you can change it.</p>
    <div class="prop-acts"><button class="btn primary sm" data-act="update">Update public version</button><button class="btn sm" data-act="openpublic">View public version</button><button class="btn sm" data-act="unpublish">Unpublish</button></div>
    <div class="prop-acts">${shareButtons(p.publicId)}</div></div>`;
}
function shareHTML(){
  const d = S.shareData, close = '<button class="btn ghost sm" data-act="close" aria-label="Close">✕</button>';
  const head = `<div class="ins-head"><span class="label">Share & publish “${esc(S.cur.title)}”</span>${close}</div>`;
  if (!d) return `<div class="sheet">${head}<p class="hint">Loading…</p></div>`;
  if (d.error) return `<div class="sheet">${head}<p class="hint">${esc(d.error)}</p></div>`;
  const msg = S.panelMsg ? `<p class="hint panel-msg" role="status">${esc(S.panelMsg)}</p>` : '';
  const people = d.people.map(x => `<li class="person">
      <span class="pname">${esc(x.name)}${x.you ? ' <span class="hint">(you)</span>' : ''}${x.pending ? ' <span class="pill">Invited</span>' : ''}</span>
      ${d.canManage ? `<select data-role-for="${esc(x.id)}" aria-label="Access for ${esc(x.name)}"><option value="edit" ${x.role === 'edit' ? 'selected' : ''}>Can edit</option><option value="view" ${x.role === 'view' ? 'selected' : ''}>Can view</option></select>`
        : `<span class="hint">${x.role === 'view' ? 'Can view' : 'Can edit'}</span>`}
      ${x.link ? `<button class="btn sm" data-act="copylink" data-link="${esc(x.link)}">Copy invite link</button>` : ''}
      ${d.canManage || x.you ? `<button class="btn ghost sm" data-act="unshare" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.name)}">✕</button>` : ''}
    </li>`).join('');
  return `<div class="sheet">${head}
    ${d.canManage ? `<form data-form="invite" class="invite"><label class="label" for="inv-who">Invite by username or email</label>
      <div class="row-in"><input id="inv-who" name="who" required placeholder="username or name@example.com" autocomplete="off">
      <select name="role" aria-label="Access"><option value="edit">Can edit</option><option value="view">Can view</option></select>
      <button class="btn primary sm">Invite</button></div>
      <p class="hint">People without an account get an email invite. Accepting it signs them up. If the email doesn't arrive, copy the invite link below and send it yourself.</p></form>` : '<p class="hint">Only the owner can invite people.</p>'}
    ${msg}
    <p class="label">${ICON.people} People with access</p>
    <ul class="people"><li class="person"><span class="pname">${esc(d.owner)}</span><span class="hint">Owner</span></li>${people}</ul>
    ${publishHTML(d)}
  </div>`;
}
async function invite(f){
  const who = f.elements.who.value.trim(), role = f.elements.role.value;
  if (!who) return;
  try {
    await flush();
    const d = await API.post('/api/processes/' + S.cur.id + '/shares', { who, role });
    S.panelMsg = d.added ? `Added ${d.added}. It's in their “Shared with me”.` : `Invite sent to ${d.invited}.`;
    track('shared', { by:who.includes('@') ? 'email' : 'username', role });
    S.shareData = null; await loadShares();
  } catch (e){ S.panelMsg = e.message; renderPanel(); }
}
async function setRole(id, role){ try { await API.call('/api/processes/' + S.cur.id + '/shares/' + id, { method:'PATCH', body:JSON.stringify({ role }) }); S.panelMsg = 'Updated.'; } catch (e){ S.panelMsg = e.message; } S.shareData = null; loadShares(); }
async function unshare(id){
  const me = S.shareData?.people.find(x => x.id === id)?.you;
  try { await API.del('/api/processes/' + S.cur.id + '/shares/' + id); } catch (e){ S.panelMsg = e.message; }
  if (me){ S.panel = null; S.view = 'home'; S.cur = null; loadMine(); render(); return; }
  S.shareData = null; loadShares();
}

/* ---------- Public collaboration: suggestions, compare, vote ---------- */
function pubId(){ return (S.real || S.cur)?.publicId; }
/* Comments on a public process */
const commentBtn = q => `<button class="btn sm" data-act="comments" aria-label="Comments" title="Comments">${ICON.comment}${q.commentCount ? q.commentCount : ''}</button>`;
async function loadComments(){
  const id = pubId(); if (!id) return;
  try { S.commentsData = await API.get('/api/public/' + id + '/comments'); }
  catch (e){ S.commentsData = { error:e.message, comments:[] }; }
  const q = S.real || S.cur; if (q && !S.commentsData.error){ q.commentCount = S.commentsData.comments.length; const row = (S.pub || []).find(x => x.id === id); if (row) row.commentCount = q.commentCount; }
  if (S.panel === 'comments') renderPanel(); renderTopActions();
}
function stepOptions(){
  const p = S.real || S.cur;
  return Object.values(p.maps || {}).flatMap(m => m.steps.map(s => `<option value="${esc(m.id + '|' + s.id)}">${esc(s.label)}${m.id !== 'm_root' ? ' · ' + esc(m.title) : ''}</option>`)).join('');
}
function commentsHTML(){
  const d = S.commentsData, close = '<button class="btn ghost sm" data-act="close" aria-label="Close">✕</button>';
  const head = `<div class="ins-head"><span class="label">Comments${d?.comments?.length ? ' · ' + d.comments.length : ''}</span>${close}</div>`;
  if (!d) return `<div class="sheet">${head}<p class="hint">Loading…</p></div>`;
  const list = d.comments.map(c => `<li class="cm"><div class="cm-h"><b>${esc(c.author)}</b><span>${ago(c.createdAt)}</span>${c.stepRef ? `<button class="chip" data-act="jumpc" data-ref="${esc(c.stepRef)}">on “${esc(c.stepLabel || 'a step')}”</button>` : ''}${c.mine || d.isOwner ? `<button class="g-link" data-act="delcomment" data-id="${esc(c.id)}">Delete</button>` : ''}</div><p>${esc(c.body)}</p></li>`).join('');
  const msg = S.panelMsg ? `<p class="hint panel-msg" role="status">${esc(S.panelMsg)}</p>` : '';
  return `<div class="sheet">${head}
    ${d.error ? `<p class="hint">${esc(d.error)}</p>` : list ? `<ul class="cms">${list}</ul>` : '<p class="hint">No comments yet. Ask a question, suggest a missing step, or say what worked.</p>'}
    <form data-form="comment" class="cm-form"><textarea name="body" rows="2" maxlength="1000" required placeholder="Add a comment…" aria-label="Comment"></textarea>
      <div class="row-in"><select name="step" aria-label="Pin to a step"><option value="">The whole process</option>${stepOptions()}</select><button class="btn primary sm">Post</button></div></form>${msg}</div>`;
}
async function postComment(f){
  const text = f.elements.body.value.trim(), step = f.elements.step.value, id = pubId(); if (!text || !id) return;
  try {
    await API.post('/api/public/' + id + '/comments', { body:text, step });
    track('comment', { publicId:id }); S.commentsData = null; f.elements.body.value = ''; loadComments();
  } catch (e){ S.panelMsg = e.message; renderPanel(); }
}
async function loadReview(){
  try { S.reviewData = await API.get('/api/public/' + pubId() + '/proposals?status=open'); }
  catch (e){ S.reviewData = { error:e.message, proposals:[] }; }
  const q = S.real || S.cur; if (q) q.openProposals = S.reviewData.proposals?.length || 0;
  if (S.panel === 'review') renderPanel(); renderTopActions();
}
function ago(t){ const s = (Date.now() - new Date(t).getTime()) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago'; }
function reviewHTML(){
  const d = S.reviewData, close = '<button class="btn ghost sm" data-act="close" aria-label="Close">✕</button>';
  const head = `<div class="ins-head"><span class="label">Suggested changes</span>${close}</div>`;
  if (!d) return `<div class="sheet">${head}<p class="hint">Loading…</p></div>`;
  if (d.error) return `<div class="sheet">${head}<p class="hint">${esc(d.error)}</p></div>`;
  return `<div class="sheet">${head}<p class="hint">${esc(d.rule)}</p>
    ${d.proposals.length ? `<ul class="props">${d.proposals.map(x => `<li class="prop-card">
      <p><b>${esc(x.note)}</b></p>
      <p class="hint">by ${esc(x.mine ? 'you' : x.author)} · ${ago(x.createdAt)} · ${diffMaps(x.mapsBefore, x.mapsAfter).items.length} differences</p>
      <p class="tally"><span>After is better: <b>${x.after}</b></span><span>Before is better: <b>${x.before}</b></span>${x.myVote ? `<span class="hint">You voted ${x.myVote === 'after' ? 'after' : 'before'}</span>` : ''}</p>
      <div class="prop-acts"><button class="btn primary sm" data-act="compare" data-id="${esc(x.id)}">Compare and vote</button></div>
    </li>`).join('')}</ul>` : '<p>No suggested changes right now. Use “Suggest changes” to propose one.</p>'}
  </div>`;
}
async function loadHistory(){
  try { S.historyData = await API.get('/api/public/' + pubId() + '/history'); } catch (e){ S.historyData = { error:e.message }; }
  if (S.panel === 'history') renderPanel();
}
function historyHTML(){
  const d = S.historyData, close = '<button class="btn ghost sm" data-act="close" aria-label="Close">✕</button>';
  const head = `<div class="ins-head"><span class="label">Version history</span>${close}</div>`;
  if (!d) return `<div class="sheet">${head}<p class="hint">Loading…</p></div>`;
  if (d.error) return `<div class="sheet">${head}<p class="hint">${esc(d.error)}</p></div>`;
  const byId = Object.fromEntries((d.decided || []).map(x => [x.id, x]));
  return `<div class="sheet">${head}<ul class="props">${d.versions.map(v => `<li class="prop-card"><p><b>Version ${v.version}</b> <span class="hint">${new Date(v.createdAt).toLocaleDateString()}</span></p>
      <p class="hint">${v.proposalId && byId[v.proposalId] ? `${esc(byId[v.proposalId].note)} · suggested by ${esc(byId[v.proposalId].author)}` : v.version === 1 ? 'First published' : 'Accepted change'}</p></li>`).join('')}</ul>
    ${(d.decided || []).filter(x => x.status === 'rejected').length ? `<p class="label">Turned down</p><ul class="props">${d.decided.filter(x => x.status === 'rejected').map(x => `<li class="prop-card"><p>${esc(x.note)}</p><p class="hint">by ${esc(x.author)}</p></li>`).join('')}</ul>` : ''}
  </div>`;
}
/* What changed between two versions, in words, plus marks for the board */
function diffMaps(before, after){
  before = before || {}; after = after || {};
  const items = [], marks = { before:{}, after:{} };
  const mark = (side, map, id, kind) => { (marks[side][map] ||= {})[id] = kind; };
  const nameOf = (maps, mapId) => mapId === 'm_root' ? 'the main flow' : '“' + (maps[mapId]?.title || 'a layer') + '”';
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])){
    const a = before[id], b = after[id];
    if (!a){ items.push({ k:'add', t:`New layer ${nameOf(after, id)}` }); (b.steps || []).forEach(s => mark('after', id, s.id, 'add')); continue; }
    if (!b){ items.push({ k:'rem', t:`Removed layer ${nameOf(before, id)}` }); continue; }
    const where = id === 'm_root' ? '' : ` in ${nameOf(after, id)}`;
    const la = Object.fromEntries((a.lanes || []).map(l => [l.id, l])), lb = Object.fromEntries((b.lanes || []).map(l => [l.id, l]));
    for (const l of b.lanes || []) if (!la[l.id] && !(a.lanes || []).some(x => x.name === l.name)) items.push({ k:'add', t:`New lane “${l.name}”${where}` });
    for (const l of a.lanes || []) if (!lb[l.id] && !(b.lanes || []).some(x => x.name === l.name)) items.push({ k:'rem', t:`Removed lane “${l.name}”${where}` });
    const sa = Object.fromEntries((a.steps || []).map(s => [s.id, s])), sb = Object.fromEntries((b.steps || []).map(s => [s.id, s]));
    for (const s of b.steps || []){
      const o = sa[s.id];
      if (!o){ items.push({ k:'add', t:`Added “${s.label}”${where}` }); mark('after', id, s.id, 'add'); continue; }
      const ch = [];
      if (o.label !== s.label) ch.push(`renamed “${o.label}” to “${s.label}”`);
      if (o.lane !== s.lane) ch.push(`moved “${s.label}” to ${lb[s.lane]?.name || 'another lane'}`);
      if (o.kind !== s.kind) ch.push(`made “${s.label}” a ${s.kind}`);
      const key = st => (st.next || []).map(n => (n.map || '') + '>' + n.to + ':' + (n.label || '')).sort().join('|');
      if (key(o) !== key(s)) ch.push(`changed what follows “${s.label}”`);
      if (ch.length){ ch.forEach(t => items.push({ k:'chg', t:t[0].toUpperCase() + t.slice(1) + where })); mark('after', id, s.id, 'chg'); mark('before', id, s.id, 'chg'); }
    }
    for (const s of a.steps || []) if (!sb[s.id]){ items.push({ k:'rem', t:`Removed “${s.label}”${where}` }); mark('before', id, s.id, 'rem'); }
  }
  return { items, marks };
}
function openCompare(id){
  const x = S.reviewData?.proposals.find(p => p.id === id); if (!x) return;
  if (!S.real) S.real = S.cur;
  S.compare = { prop:x, side:'after', diff:diffMaps(x.mapsBefore, x.mapsAfter) };
  S.panel = null; S.sel = null; S.tab = 'map';
  track('compare_opened', { proposalId:id }, null);
  applyCompareSide();
}
function applyCompareSide(){
  const c = S.compare, base = S.real;
  S.cur = { ...base, maps:clone(c.side === 'after' ? c.prop.mapsAfter : c.prop.mapsBefore), readonly:true, chat:base.chat, events:[] };
  renderWork();
}
function closeCompare(){ if (S.real) S.cur = S.real; S.real = null; S.compare = null; if (S.view === 'work') renderWork(); }
function renderCompare(){
  const el = $('#compare'); if (!el) return;
  const c = S.compare; if (!c){ el.innerHTML = ''; return; }
  const x = c.prop, items = c.diff.items;
  el.innerHTML = `<div class="cmp">
    <div class="cmp-head"><div class="cmp-note"><span class="label">Suggested change</span><b>${esc(x.note)}</b><span class="hint">by ${esc(x.mine ? 'you' : x.author)}</span></div>
      <button class="btn ghost sm" data-act="endcompare">← All changes</button></div>
    <div class="cmp-row">
      <div class="seg-toggle" role="group" aria-label="Which version to show">
        <button class="${c.side === 'before' ? 'on' : ''}" data-act="side" data-side="before" aria-pressed="${c.side === 'before'}">Before</button>
        <button class="${c.side === 'after' ? 'on' : ''}" data-act="side" data-side="after" aria-pressed="${c.side === 'after'}">After</button>
      </div>
      ${x.mine ? `<span class="hint">You suggested this, so your vote counts for “after”.</span><button class="btn ghost sm danger" data-act="withdraw" data-id="${esc(x.id)}">Withdraw</button>`
        : `<div class="votes"><button class="btn sm${x.myVote === 'before' ? ' primary' : ''}" data-act="vote" data-choice="before" data-id="${esc(x.id)}" aria-pressed="${x.myVote === 'before'}">Before is better</button>
           <button class="btn sm${x.myVote === 'after' ? ' primary' : ''}" data-act="vote" data-choice="after" data-id="${esc(x.id)}" aria-pressed="${x.myVote === 'after'}">After is better</button></div>`}
      <span class="tally"><span>After <b>${x.after}</b></span><span>Before <b>${x.before}</b></span></span>
    </div>
    <details class="cmp-diff" ${items.length <= 4 ? 'open' : ''}><summary>${items.length} difference${items.length === 1 ? '' : 's'}</summary>
      <ul>${items.slice(0, 40).map(i => `<li class="d-${i.k}">${esc(i.t)}</li>`).join('') || '<li>No differences in the steps.</li>'}</ul></details>
  </div>`;
}
async function vote(id, choice){
  try {
    const d = await API.post('/api/proposals/' + id + '/vote', { choice });
    const x = S.compare?.prop; if (x){ x.after = d.after; x.before = d.before; x.myVote = d.myVote; }
    if (d.status === 'accepted'){ alertBox('That change had enough votes and is now live.'); const id2 = pubId(); closeCompare(); openProcess(id2, 'pub'); return; }
    if (d.status === 'rejected'){ alertBox('That change was turned down by the votes.'); closeCompare(); S.panel = 'review'; S.reviewData = null; loadReview(); return; }
    if (d.status === 'superseded'){ alertBox('The public version changed in the meantime, so this suggestion is out of date.'); closeCompare(); S.panel = 'review'; S.reviewData = null; loadReview(); return; }
    renderCompare();
  } catch (e){ alertBox(e.message); }
}
async function withdraw(id){
  try { await API.post('/api/proposals/' + id + '/withdraw', {}); alertBox('Suggestion withdrawn.'); } catch {}
  closeCompare(); S.panel = 'review'; S.reviewData = null; loadReview(); renderPanel();
}

let rsz = 0; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (S.view === 'work' && S.cur) renderBoard(); }, 150); });
/* ---------- Layout ---------- */
const L = { HEAD:150, COL:196, BOXW:158, BOXH:60, ROWGAP:16, PADX:28, PADY:16, BAND:22 };
function layout(m){
  const col = columnsOf(m, n => isInternal(n, m));
  const laneIds = new Set(m.lanes.map(l => l.id));
  let lanes = [...m.lanes.filter(l => l.type !== 'system'), ...m.lanes.filter(l => l.type === 'system')];
  if (m.steps.some(s => !laneIds.has(s.lane))) lanes.push({ id:'__none', name:'Unassigned', type:'person' });
  const laneOf = s => laneIds.has(s.lane) ? s.lane : '__none';
  const slot = {}, rowOf = {}, rows = {};
  m.steps.forEach(s => { const k = laneOf(s) + '|' + col[s.id]; rowOf[s.id] = slot[k] = (slot[k] ?? -1) + 1; rows[laneOf(s)] = Math.max(rows[laneOf(s)] || 1, rowOf[s.id] + 1); });
  const maxCol = Math.max(0, ...Object.values(col));
  const width = L.HEAD + L.PADX * 2 + (maxCol + 1) * L.COL;
  const firstSys = lanes.findIndex(l => l.type === 'system');
  let y = 0; const laneY = {}, laneH = {}, bands = [];
  lanes.forEach((l, i) => {
    if (i === 0 && l.type !== 'system'){ bands.push({ y, t:'People' }); y += L.BAND; }
    if (i === firstSys){ bands.push({ y, t:'Technology' }); y += L.BAND; }
    laneY[l.id] = y; laneH[l.id] = (rows[l.id] || 1) * (L.BOXH + L.ROWGAP) + L.PADY * 2 - L.ROWGAP + 8; y += laneH[l.id];
  });
  const pos = {};
  m.steps.forEach(s => { pos[s.id] = { x:L.HEAD + L.PADX + col[s.id] * L.COL, y:laneY[laneOf(s)] + L.PADY + rowOf[s.id] * (L.BOXH + L.ROWGAP) }; });
  return { lanes, laneY, laneH, bands, pos, width, height:y };
}

/* ---------- Rendering ---------- */
let rq = 0;
function queueRender(){ if (rq) return; rq = requestAnimationFrame(() => { rq = 0; renderWork(true); }); }

function render(){
  const app = $('#app');
  document.body.classList.toggle('in-work', S.view === 'work');
  if (S.view === 'login') renderLogin(app);
  else if (S.view === 'home') renderHome(app);
  else renderWorkShell(app);
  renderToast();
}

/* ---------- Account: anonymous handle, optional email ---------- */
function acctHTML(){
  const me = S.me; if (!me) return '';
  const nameForm = `<form data-name-form class="acct-form"><label class="label" for="acct-name">Username</label>
      <div class="row-in"><input id="acct-name" name="handle" value="${esc(me.handle)}" maxlength="24" autocomplete="username" aria-describedby="acct-name-msg"><button class="btn sm">Save</button></div>
      <p class="hint" id="acct-name-msg" data-name-msg role="status"></p></form>`;
  const panel = !S.acct ? '' : me.email ? `
    <div class="acct-panel" role="dialog" aria-label="Account">
      <p>Signed in as <b>${esc(me.email)}</b>.</p>
      ${nameForm}
      <button class="btn sm" data-acct="copykey">Copy key for Claude or ChatGPT</button>
      ${me.isAdmin ? '<a class="btn sm" href="/admin">Admin dashboard</a>' : ''}
      <button class="btn sm" data-acct="signout">Sign out</button>
    </div>` : `
    <div class="acct-panel" role="dialog" aria-label="Account">
      <p>You're a guest, mapping as <b>${esc(me.handle)}</b>. Your processes are saved to this browser.</p>
      <button class="btn sm" data-acct="copykey">Copy key for Claude or ChatGPT</button>
      <p class="hint">Add your email to choose your own username, keep your processes on any device, or sign in.</p>
      ${emailFormHTML('acct')}
    </div>`;
  return `${me.isAdmin ? '<a class="btn sm admin-link hide-sm" href="/admin">Admin</a>' : ''}<div class="acct"><button class="btn ghost acct-btn" data-acct="toggle" aria-expanded="${S.acct}"><span class="acct-name">${esc(me.handle)}</span> ▾</button>${panel}</div>`;
}
function wireAcct(root){
  root.querySelectorAll('[data-acct]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (b.dataset.acct === 'toggle'){ S.acct = !S.acct; S.signin = false; render(); return; }
    if (b.dataset.acct === 'copykey'){ navigator.clipboard.writeText(API.key || '').then(() => alertBox('Key copied. Give it to Claude or ChatGPT so it saves processes to your library. Keep it private.')).catch(() => alertBox('Could not copy.')); return; }
    if (b.dataset.acct === 'signout'){ ls.del('ptw_key'); ls.del('ptw_in'); location.href = '/'; }
  });
  root.querySelectorAll('[data-name-form]').forEach(f => f.onsubmit = async e => {
    e.preventDefault(); e.stopPropagation();
    const v = f.elements.handle.value.trim(), msg = f.querySelector('[data-name-msg]');
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(v)){ msg.textContent = 'Usernames are 3–24 letters, numbers, dots, dashes or underscores.'; return; }
    try { S.me = await API.post('/api/account/username', { handle:v }); msg.textContent = 'Saved.'; track('username_changed'); setTimeout(() => { if (S.acct) render(); }, 900); }
    catch (err){ msg.textContent = err.message; }
  });
  wireEmailForm(root);
}
function emailFormHTML(p){
  return `<form data-email-form class="acct-form" novalidate>
    <label class="label" for="${p}-email">Email</label>
    <input id="${p}-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
    <label class="label" for="${p}-handle">Username <span class="opt">(optional)</span></label>
    <input id="${p}-handle" name="handle" type="text" placeholder="${esc(S.me?.handle || 'Pick a username')}" autocomplete="username" maxlength="24" pattern="[A-Za-z0-9._-]{3,24}">
    <button class="btn primary">Email me a link</button>
    <p class="hint" data-email-msg role="status">New here? This saves your processes. Been here before? It signs you in.</p>
  </form>`;
}
/* "Sign in": you're already a member, so just your email */
function signInHTML(){
  if (S.me?.email) return '';
  return `<div class="signin"><button class="btn ghost sm" data-signin aria-expanded="${!!S.signin}">Sign in</button>${S.signin ? `
    <div class="acct-panel signin-panel" role="dialog" aria-label="Sign in">
      <form data-email-form data-mode="signin" class="acct-form" novalidate>
        <label class="label" for="si-email">Email</label>
        <input id="si-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
        <input name="handle" type="hidden" value="">
        <button class="btn primary">Send me a sign-in link</button>
        <p class="hint" data-email-msg role="status">We'll email you a link. No password needed.</p>
      </form>
    </div>` : ''}</div>`;
}
function wireSignIn(root){
  root.querySelectorAll('[data-signin]').forEach(b => b.onclick = e => { e.stopPropagation(); S.signin = !S.signin; S.acct = false; render(); setTimeout(() => $('#si-email')?.focus(), 0); });
}
document.addEventListener('click', e => { if (S.signin && !e.target.closest('.signin')){ S.signin = false; render(); } });
function wireEmailForm(root){
  root.querySelectorAll('[data-email-form]').forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const msg = f.querySelector('[data-email-msg]'), btn = f.querySelector('button');
    const email = f.elements.email.value.trim(), handle = f.elements.handle.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = 'Enter a valid email address.'; f.elements.email.focus(); return; }
    if (handle && !/^[A-Za-z0-9._-]{3,24}$/.test(handle)){ msg.textContent = 'Usernames are 3–24 letters, numbers, dots, dashes or underscores.'; f.elements.handle.focus(); return; }
    btn.disabled = true;
    try {
      await flush();
      await API.post('/api/auth/email', { email, handle });
      msg.textContent = f.dataset.mode === 'signin' ? `If ${email} has an account, a sign-in link is on its way. It may land in spam.` : `Check ${email} for a link. It may land in spam.`; track('email_link_requested', { mode:f.dataset.mode || 'save' });
      f.elements.email.value = ''; f.elements.handle.value = '';
    } catch (err){ msg.textContent = err.message; }
    btn.disabled = false;
  });
}
document.addEventListener('click', e => { if (S.acct && !e.target.closest('.acct')){ S.acct = false; render(); } });

/* The landing page's samples: a few of the best published maps, or the built-in examples until they load */
const FEATURED = ['Your Immune System vs. a Cold Virus', 'Quote, sell, service, renew', 'A workday: drive to work', 'Photosynthesis', 'How a lightning bolt', 'Lead to customer', 'The life and death of a star', 'Quote to cash'];
function sampleCards(){
  const feat = FEATURED.map(t => (S.pub || []).find(p => p.title.startsWith(t))).filter(Boolean).slice(0, 6);
  return feat.length >= 3 ? feat.map(p => cardHTML(p, 'pub')).join('') : EXAMPLES.map(p => cardHTML(p, 'ex')).join('');
}
function renderLogin(app){
  app.innerHTML = `
  <div class="top land-top"><button class="mark linkish-plain" data-home>${MARK}</button><div class="grow"></div>
    ${ls.get('ptw_in') ? '<button class="btn sm" id="to-lib">Your library</button>' : ''}${signInHTML()}</div>
  <main class="landing">
    <section class="hero2">
      <h1>The Best Process Mapper in the World.</h1>
      <button class="btn primary xl" id="go">Try it</button>
      <p class="goal-line">Our goal is to map the world's processes.</p>
      <p class="guide-line">We guide you through your process, and ask you and your collaborators the questions that fill in the gaps.</p>
    </section>
    <section class="samples">
      <h2>Jump into a sample</h2>
      <div class="cards">${sampleCards()}</div>
    </section>
    <section class="use-ai">
      <h2>Build from Claude or ChatGPT.</h2>
      <p>Map, view and publish processes from your own AI.</p>
      <div class="use-actions">
        <a class="btn primary lg" href="/process-the-world-skill.zip" download>Get the Claude skill</a>
        <button class="btn primary lg" data-copy-url="/chatgpt/instructions.txt">Get the ChatGPT skill</button>
      </div>
      <p class="hint">Claude: upload the zip in Settings, Capabilities, Skills. ChatGPT: paste it into a new GPT, then <button class="linkish" data-copy-text="https://processtheworld.vercel.app/openapi.json">copy the action URL</button>. Or add our connector: <button class="linkish" data-copy-text="https://processtheworld.vercel.app/api/mcp">copy the MCP URL</button>.</p>
    </section>
    ${footHTML()}
  </main>`;
  const enter = () => { ls.set('ptw_in','1'); S.view = 'home'; render(); };
  $('#go').onclick = () => { enter(); startNew(); };
  const tl = $('#to-lib'); if (tl) tl.onclick = enter;
  wireSignIn(app);
  app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { ls.set('ptw_in','1'); openProcess(b.dataset.open, b.dataset.kind); });
  wireEmailForm(app); wireInterest(app); wireCopy(app);
}
const MARK = '<i>PW</i>Process the World';
const footHTML = () => `<footer class="foot"><details class="sf"><summary>Salesforce connector: get early access</summary>
  <form data-interest><input name="email" type="email" required placeholder="you@company.com" autocomplete="email" aria-label="Email"><button class="btn primary sm">Notify me</button><span class="hint" data-imsg role="status"></span></form></details>
  <a href="/agents.md">For AI agents</a></footer>`;
function wireCopy(root){
  root.querySelectorAll('[data-copy-url],[data-copy-text]').forEach(b => b.onclick = async () => {
    try {
      const text = b.dataset.copyText || await fetch(b.dataset.copyUrl).then(r => r.text());
      await navigator.clipboard.writeText(text);
      const old = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = old; }, 1600);
    } catch { alertBox('Could not copy. Open ' + (b.dataset.copyUrl || b.dataset.copyText) + ' and copy it by hand.'); }
  });
}
function wireImport(root){
  const f = root.querySelector('[data-import]'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const msg = f.querySelector('[data-imsg]'), btn = f.querySelector('button');
    let data;
    try { data = JSON.parse(f.elements.json.value.trim().replace(/^```(?:json)?/, '').replace(/```$/, '')); }
    catch { msg.textContent = 'That is not valid JSON. Paste the whole map your AI gave you.'; return; }
    btn.disabled = true; msg.textContent = 'Importing…';
    try { const d = await API.post('/api/agent/processes', data); track('import_ai', {}, d.id); await loadMine(); openProcess(d.id, 'mine'); }
    catch (err){ msg.textContent = err.message; }
    btn.disabled = false;
  };
}
function wireInterest(root){
  root.querySelectorAll('[data-interest]').forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const msg = f.querySelector('[data-imsg]'), btn = f.querySelector('button');
    btn.disabled = true;
    try { await API.post('/api/interest', { email:f.elements.email.value.trim(), kind:'salesforce' }); msg.textContent = 'Thanks. We will email you when it is ready.'; f.elements.email.value = ''; track('interest_salesforce'); }
    catch (err){ msg.textContent = err.message; }
    btn.disabled = false;
  });
}
function startNew(){ S.guide = null; S.painView = false; stopVoice(); S.cur = newProcess(); S.path = ['m_root']; S.sel = null; S.view = 'work'; S.tab = 'chat'; S.panel = null; track('process_started', {}, S.cur.id); render(); }

function cardHTML(p, kind){
  const st = p.stepCount != null ? { steps:p.stepCount, depth:p.depth } : stats(p);
  const types = p.laneTypes || (p.maps?.m_root?.lanes || []).map(l => l.type);
  const when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
  const del = kind === 'mine' ? (S.confirmDel === p.id
    ? `<div class="card-del"><span>Delete “${esc(p.title || 'Untitled process')}”? This can't be undone${p.publicId ? ', and the public version goes too' : ''}.</span><span class="prop-acts"><button class="btn danger sm" data-del-yes="${esc(p.id)}">Delete</button><button class="btn sm" data-del-no>Cancel</button></span></div>`
    : `<button class="card-x" data-del="${esc(p.id)}" aria-label="Delete ${esc(p.title || 'process')}" title="Delete">Delete</button>`) : '';
  let badge, by = '';
  if (kind === 'mine'){
    badge = p.proposalFor ? '<span class="pill ex">Suggestion</span>' : visPill(p.publicId, p.shareCount, p.publicMode);
  } else if (kind === 'shared'){
    badge = `<span class="pill sh">${p.role === 'view' ? 'Can view' : 'Can edit'}</span>`; by = `<span class="by">Shared by ${esc(p.owner)}</span>`;
  } else if (kind === 'ex'){ badge = ''; by = '<span class="by">By Process the World</span>'; }
  else { badge = ''; by = `<span class="by">Published by ${esc(p.processId && S.mine.some(m => m.id === p.processId) ? 'you' : p.authorName)}${p.likes ? ` · ${ICON.heart}${p.likes}` : ''}</span>`; }
  return `<div class="card-wrap">${del}<button class="card" data-open="${esc(p.id)}" data-kind="${kind}">
    <div class="card-top">${badge}<span class="mono card-when${kind === 'mine' ? ' has-x' : ''}">${esc(when)}</span></div>
    <h3>${esc(p.title || 'Untitled process')}</h3>
    ${by}
    ${(p.tags || []).length ? `<div class="ctags">${p.tags.slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="spark">${types.slice(0,8).map(t => `<b class="${t==='system'?'s':''}"></b>`).join('') || '<b style="background:var(--line)"></b>'}</div>
    <div class="meta"><span>${st.steps} steps</span><span>${st.depth} ${st.depth === 1 ? 'layer' : 'layers'}</span><span>${types.filter(t=>t!=='system').length} people · ${types.filter(t=>t==='system').length} tech</span></div>
  </button></div>`;
}

/* Search and tag filter for the public processes */
function allTags(){
  const c = {};
  [...(S.pub || []), ...EXAMPLES].forEach(p => (p.tags || []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function publicMatches(p){
  const needle = S.q.trim().toLowerCase();
  if (S.tag && !(p.tags || []).includes(S.tag)) return false;
  return !needle || (p.title + ' ' + (p.authorName || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(needle);
}
const SORTS = {
  new:(a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  top:(a, b) => (b.likes || 0) - (a.likes || 0) || (b.publishedAt || 0) - (a.publishedAt || 0),
  upd:(a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
};
function feedCardHTML(p){
  const mine = p.processId && S.mine.some(m => m.id === p.processId);
  const tags = (p.tags || []).slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('');
  return `<article class="fcard"><div class="fbody"><button class="ftitle" data-open="${esc(p.id)}" data-kind="pub">${esc(p.title)}</button>
      <div class="fby">by ${esc(mine ? 'you' : p.authorName)}${p.publishedAt ? ' · ' + ago(p.publishedAt) : ''}</div>
      ${tags ? `<div class="ctags">${tags}</div>` : ''}
      <div class="ffoot"><button class="flike${p.liked ? ' on' : ''}" data-like="${esc(p.id)}" aria-pressed="${!!p.liked}" aria-label="Like">${ICON.heart}<b>${p.likes || 0}</b></button><button class="fcom" data-comment="${esc(p.id)}" aria-label="Comments">${ICON.comment}<b>${p.commentCount || 0}</b></button><span class="fstats">${p.stepCount} steps · ${p.depth} ${p.depth === 1 ? 'layer' : 'layers'}</span></div></div></article>`;
}
function publicCardsHTML(){
  const all = (S.pub || []).filter(publicMatches).sort(SORTS[S.sort] || SORTS.new);
  const shown = all.slice(0, S.pubLimit), more = all.length > shown.length;
  const exs = more ? '' : EXAMPLES.filter(publicMatches).map(p => cardHTML(p, 'ex')).join('');
  if (!shown.length && !exs) return '<div class="empty"><b style="color:var(--ink)">Nothing matches</b><span>Try a different word, or clear the tag.</span></div>';
  return shown.map(feedCardHTML).join('') + exs + (more ? `<div class="fmore"><button class="btn" data-more>Show ${Math.min(12, all.length - shown.length)} more</button></div>` : '');
}
function sortBarHTML(){
  const n = (S.pub || []).filter(publicMatches).length;
  return `<span class="fcount">${n} process${n === 1 ? '' : 'es'}</span><span class="fsort-l">Sort</span>${[['new', 'Newest'], ['top', 'Most liked'], ['upd', 'Recently updated']].map(([k, l]) => `<button data-sort="${k}" class="${S.sort === k ? 'on' : ''}">${l}</button>`).join('')}`;
}
async function toggleFeedLike(id, btn){
  const p = (S.pub || []).find(x => x.id === id); if (!p) return;
  const paint = () => { btn.classList.toggle('on', !!p.liked); btn.setAttribute('aria-pressed', !!p.liked); btn.querySelector('b').textContent = p.likes || 0; };
  const was = !!p.liked; p.liked = !was; p.likes = Math.max(0, (p.likes || 0) + (was ? -1 : 1)); paint();
  try { const d = await API.post('/api/public/' + id + '/like', {}); p.liked = d.liked; p.likes = d.likes; track(d.liked ? 'like' : 'unlike', { publicId:id }); }
  catch { p.liked = was; p.likes = Math.max(0, (p.likes || 0) + (was ? 1 : -1)); }
  paint();
}
function tagPillsHTML(){
  const tags = allTags().slice(0, 16);
  return `<button class="tagpill${S.tag ? '' : ' on'}" data-ptag="">All</button>` + tags.map(([t, n]) => `<button class="tagpill${S.tag === t ? ' on' : ''}" data-ptag="${esc(t)}">${esc(t)} <small>${n}</small></button>`).join('');
}
function publicFilterHTML(){
  return `<div class="pfilter"><input id="psearch" type="search" placeholder="Search public processes" value="${esc(S.q)}" aria-label="Search public processes" autocomplete="off"><div class="pills" id="ppills">${tagPillsHTML()}</div><div class="fsort" id="fsort">${sortBarHTML()}</div></div><div class="feed" id="pcards">${publicCardsHTML()}</div>`;
}
function wirePublicFilter(root){
  const inp = root.querySelector('#psearch'); if (!inp) return;
  const refresh = (reset = true) => {
    if (reset) S.pubLimit = 12;
    root.querySelector('#ppills').innerHTML = tagPillsHTML();
    root.querySelector('#fsort').innerHTML = sortBarHTML();
    const c = root.querySelector('#pcards'); c.innerHTML = publicCardsHTML();
    c.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProcess(b.dataset.open, b.dataset.kind));
  };
  inp.oninput = () => { S.q = inp.value; refresh(); };
  root.querySelector('#ppills').onclick = e => { const b = e.target.closest('[data-ptag]'); if (!b) return; S.tag = b.dataset.ptag; refresh(); };
  root.querySelector('#fsort').onclick = e => { const b = e.target.closest('[data-sort]'); if (!b) return; S.sort = b.dataset.sort; ls.set('ptw_sort', S.sort); refresh(); };
  root.querySelector('#pcards').onclick = e => {
    const lk = e.target.closest('[data-like]'); if (lk){ e.stopPropagation(); toggleFeedLike(lk.dataset.like, lk); return; }
    const cm = e.target.closest('[data-comment]'); if (cm){ e.stopPropagation(); openProcess(cm.dataset.comment, 'pub').then(() => { S.panel = 'comments'; S.commentsData = null; renderPanel(); }); return; }
    if (e.target.closest('[data-more]')){ S.pubLimit += 12; refresh(false); }
  };
}
const useAiHTML = () => `<section class="sec use-ai">
      <h2>Build from Claude or ChatGPT.</h2>
      <p>Map, view and publish processes from your own AI.</p>
      <div class="use-actions">
        <a class="btn primary" href="/process-the-world-skill.zip" download>Get the Claude skill</a>
        <button class="btn primary" data-copy-url="/chatgpt/instructions.txt">Get the ChatGPT skill</button>
      </div>
      <p class="hint">Claude: upload the zip in Settings, Capabilities, Skills. ChatGPT: paste it into a new GPT, then <button class="linkish" data-copy-text="https://processtheworld.vercel.app/openapi.json">copy the action URL</button>. Or add our connector: <button class="linkish" data-copy-text="https://processtheworld.vercel.app/api/mcp">copy the MCP URL</button>.</p>
    </section>`;
function renderHome(app){
  const sec = (title, sub, inner) => `<section class="sec"><div class="sec-head"><h2>${title}</h2><p>${sub}</p></div>${inner}</section>`;
  app.innerHTML = `
  <div class="top"><button class="mark linkish-plain" data-home aria-label="Process the World home">${MARK}</button><div class="grow"></div>
    ${S.notice ? `<span class="save hide-sm" style="color:var(--danger)">${esc(S.notice)}</span>` : ''}
    <a class="toplink hide-sm" href="/agents.md">For AI agents</a>
    <button class="btn primary" id="new">New<span class="hide-sm"> process</span></button>${signInHTML()}${acctHTML()}</div>
  <div class="home"><div class="home-in">
    <div class="home-head"><div><div class="label">Process the World${S.me ? ' · Hi, ' + esc(S.me.handle) : ''}</div><h1 class="tagline">The World's Best Process Mapper</h1><p class="tagsub">Our goal is to map the world's processes. Explore what others have mapped, or start your own.</p></div></div>
    ${S.mine.length ? sec('My processes', 'Private unless you share or publish them.', `<div class="cards">${S.mine.map(p => cardHTML(p,'mine')).join('')}</div>`) : ''}
    ${S.shared.length ? sec('Shared with me', 'Processes people invited you to.', `<div class="cards">${S.shared.map(p => cardHTML(p,'shared')).join('')}</div>`) : ''}
    ${sec('Public processes', 'Search, filter by tag, open any of them, like them, or make your own copy.', publicFilterHTML())}
    ${useAiHTML()}
  </div></div>`;
  $('#new').onclick = startNew; const n2 = $('#new2'); if (n2) n2.onclick = startNew;
  wireAcct(app); wireSignIn(app); wireInterest(app); wireImport(app); wirePublicFilter(app); wireCopy(app);
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.confirmDel = b.dataset.del; render(); });
  app.querySelectorAll('[data-del-no]').forEach(b => b.onclick = () => { S.confirmDel = null; render(); });
  app.querySelectorAll('[data-del-yes]').forEach(b => b.onclick = () => deleteProcess(b.dataset.delYes));
  app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProcess(b.dataset.open, b.dataset.kind));
}
document.addEventListener('click', e => { if (e.target.closest('[data-home]')){ if (S.view === 'work') flush(); S.compare = null; S.real = null; S.cur = null; S.view = 'login'; render(); window.scrollTo(0, 0); } });

async function openProcess(id, kind){
  S.guide = null; S.painView = false; stopVoice();
  let p = null;
  try {
    if (kind === 'ex') p = clone(EXAMPLES.find(x => x.id === id));
    else if (kind === 'pub'){
      const d = await API.get('/api/public/' + id);
      p = { ...d.doc, id:'pub_' + id, readonly:true, publishedBy:d.authorName, publicId:id, version:d.version, openProposals:d.openProposals, publicMode:d.mode || 'collaborative', likes:d.likes || 0, liked:!!d.liked, commentCount:d.commentCount || 0, tags:d.doc?.tags || d.tags || [] };
      track('public_opened', { publicId:id }, null);
    } else {
      const d = await API.get('/api/processes/' + id);
      p = fromServer(id, d);
      const row = (kind === 'shared' ? S.shared : S.mine).find(x => x.id === id);
      p.shareCount = row?.shareCount || 0;
    }
  } catch { S.notice = 'Could not open that process. Try again.'; render(); return; }
  if (!p) return;
  p.chat = p.chat || []; p.events = p.events || [];
  S.compare = null; S.real = null;
  S.cur = p; S.path = ['m_root']; S.sel = null; S.view = 'work'; S.checksOpen = false; S.panel = null; S.confirmDel = null;
  S.tab = p.maps.m_root.steps.length ? 'map' : 'chat'; render();
}
const STARTERS = [
  'How I make pancakes from scratch.',
  'How to change a flat bike tire.',
  'Doing laundry. It has three parts: sort, wash, and dry and fold.'
];

function renderWorkShell(app){
  app.innerHTML = `
  <div class="top work-top">
    <button class="btn ghost" id="back" aria-label="Back to library">←<span class="hide-sm"> Library</span></button>
    <div class="grow"><input class="title-in" id="title" aria-label="Process name" placeholder="Name your process" title="Click to rename" maxlength="120"></div>
    <span id="vis" class="vis"></span>
    <span class="save hide-sm" id="save"></span>
    <span id="wprimary" class="wprimary"></span>
    <span class="wmenu-wrap"><button class="btn ghost" id="wmenu-btn" aria-label="More actions" aria-haspopup="true">⋯</button></span>
    <span id="wacct"></span>
  </div>
  <div id="wpanel"></div>
  <a id="embedlink" class="embedlink" target="_blank" rel="noopener" hidden>Open in Process the World ↗</a>
  <div id="tagbar" class="tagbar"></div>
  <div id="pubbar"></div>
  <div class="tabs" id="tabs"><button data-tab="chat">Conversation</button><button data-tab="map">Map</button></div>
  <div class="work" id="work">
    <aside class="chat">
      <div class="msgs" id="msgs"></div>
      <div id="voicepanel"></div>
      <div class="composer">
        <textarea id="msg" placeholder="Describe the process in your own words… (tip: use your keyboard's dictation to talk)" aria-label="Describe the process"></textarea>
        <div class="composer-row">
          <label class="toggle"><input type="checkbox" id="deep"> Deeper thinking</label>
          <div class="composer-acts"><button class="btn" id="voice" aria-label="Talk to the interviewer" title="Talk instead of typing. It talks back and asks you questions.">${ICON.mic}Talk</button><button class="btn" id="finish">Finish map</button><button class="btn" id="stop" hidden>Stop</button><button class="btn primary" id="sendb">Send</button></div>
        </div>
      </div>
    </aside>
    <section class="canvas-wrap">
      <div id="compare"></div>
      <div class="crumbs" id="crumbs"></div>
      <div class="scroller" id="scroller"><div class="board" id="board"></div></div>
      <div id="zoomctl" class="zoomctl"></div>
      <div id="guide" class="guide"></div>
      <div id="painlist" class="painlist"></div>
      <div id="inspector"></div>
      <div id="checks"></div>
    </section>
  </div>`;
  $('#back').onclick = () => { stopGuide(); stopVoice(); flush(); if (S.compare) closeCompare(); S.view = 'home'; S.cur = null; S.confirmDel = null; S.panel = null; loadMine(); loadPublic(); render(); };
  $('#wmenu-btn').onclick = e => { e.stopPropagation(); S.panel = S.panel === 'menu' ? null : 'menu'; S.panelMsg = ''; renderPanel(); };
  $('#wprimary').onclick = onAction; $('#pubbar').onclick = onAction;
  $('#tagbar').addEventListener('submit', e => { const f = e.target.closest('[data-tagform]'); if (!f) return; e.preventDefault(); addTag(f.elements.tag.value); });
  $('#tagbar').addEventListener('click', e => { const b = e.target.closest('[data-untag]'); if (b) removeTag(b.dataset.untag); }); $('#wpanel').onclick = onAction; $('#compare').onclick = onAction;
  $('#wpanel').addEventListener('submit', onPanelSubmit);
  $('#wpanel').addEventListener('change', onPanelChange);
  $('#title').onchange = e => { ensureOwned(); const v = e.target.value.trim() || 'Untitled process'; logEvent(S.cur,{who:'human',op:'rename_process',before:S.cur.title,after:v}); S.cur.title = v; S.cur.maps.m_root.title = v; touch(); renderWork(); };
  const msg = $('#msg');
  msg.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(max-width: 820px)').matches){ e.preventDefault(); send(msg.value); } };
  $('#sendb').onclick = () => send(msg.value);
  $('#voice').onclick = () => S.voice.on ? stopVoice() : startVoice();
  $('#voicepanel').onclick = onVoiceClick;
  renderVoice();
  $('#stop').onclick = () => S.ctl?.abort();
  $('#finish').onclick = () => S.cur?.status === 'done' ? resume() : finish();
  $('#deep').checked = S.deep; $('#deep').onchange = e => S.deep = e.target.checked;
  $('#zoomctl').onclick = onZoomClick;
  $('#guide').onclick = onGuideClick;
  $('#painlist').onclick = e => { const b = e.target.closest('[data-pjump]'); if (b) jumpTo(b.dataset.pmap, b.dataset.pjump); };
  $('#scroller').addEventListener('wheel', onBoardWheel, { passive:false });
  wirePan($('#scroller'));
  $('#tabs').onclick = e => { const t = e.target.closest('[data-tab]'); if (!t) return; S.tab = t.dataset.tab; renderWork(); };
  $('#msgs').onclick = e => {
    const b = e.target.closest('[data-starter]'); if (b){ send(b.dataset.starter); return; }
    if (e.target.closest('[data-edit]')){ editLast(); return; }
    const pr = e.target.closest('[data-prop]'); if (pr){ resolveProposal(+pr.dataset.idx, pr.dataset.prop === 'remove'); return; }
    const j = e.target.closest('[data-jump]'); if (j){ jumpTo(j.dataset.jump, j.dataset.step); return; }
    const r = e.target.closest('[data-rate]'); if (r){ rateReply(+r.dataset.idx, +r.dataset.rate); return; }
    const rr = e.target.closest('[data-reason]'); if (rr){ reasonReply(+rr.dataset.idx, rr.dataset.reason); return; }
    const sk = e.target.closest('[data-skip]'); if (sk){ skipQuestion(+sk.dataset.skip); return; }
    const fr = e.target.closest('[data-frate]'); if (fr){ rateFinish(+fr.dataset.frate); return; }
    const fw = e.target.closest('[data-fwhy]'); if (fw){ finishReason(fw.dataset.fwhy, fw); return; }
    const ci = e.target.closest('[data-checkin]'); if (ci){ checkin(ci.dataset.checkin); return; }
    const a = e.target.closest('[data-act]'); if (a){ onAction(e); }
  };
  $('#board').onclick = onBoardClick;
  const onChk = e => {
    const b = e.target.closest('[data-chk]'); if (!b) return;
    if (b.dataset.chk === 'close'){ S.checksOpen = false; renderWork(); return; }
    issueAction(b.dataset.key, b.dataset.chk);
  };
  $('#checks').onclick = onChk; $('#inspector').addEventListener('click', onChk);
  $('#crumbs').onclick = e => {
    const c = e.target.closest('[data-depth]'); if (c){ S.path = S.path.slice(0, +c.dataset.depth + 1); S.sel = null; renderWork(); return; }
    if (e.target.closest('[data-checks]')){ S.checksOpen = !S.checksOpen; if (S.checksOpen) S.sel = null; renderWork(); }
  };
  renderWork();
}
document.addEventListener('click', e => {
  if (S.panel === 'menu' && !e.target.closest('#wpanel') && !e.target.closest('#wmenu-btn')){ S.panel = null; renderPanel(); }
});

/* One place for who can see a process: Private, Shared, or Public, each with an icon */
const ico = d => '<svg class="vi" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ICON = {
  lock:   ico('<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>'),
  people: ico('<circle cx="6" cy="5.5" r="2.2"/><path d="M1.8 13.5c.3-2.4 2-3.8 4.2-3.8s3.9 1.4 4.2 3.8"/><path d="M10.6 3.6a2.2 2.2 0 010 4.2M12 9.9c1.3.5 2.1 1.6 2.3 3.2"/>'),
  star:   ico('<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>'),
  link:   ico('<path d="M6.8 9.2a3 3 0 004.2 0l2-2a3 3 0 00-4.2-4.2l-.7.7"/><path d="M9.2 6.8a3 3 0 00-4.2 0l-2 2a3 3 0 004.2 4.2l.7-.7"/>'),
  heart:  ico('<path d="M8 13.6S2.2 10 2.2 6.1A3.1 3.1 0 018 4.6a3.1 3.1 0 015.8 1.5C13.8 10 8 13.6 8 13.6z"/>'),
  hand:   ico('<path d="M6 8V3.5a1 1 0 012 0V7m0-3a1 1 0 012 0v3m0-2a1 1 0 012 0v3.5m0-1a1 1 0 012 0V10a5 5 0 01-5 5H8.5a3.5 3.5 0 01-2.8-1.4L2.6 9.8a1 1 0 011.6-1.2L6 10.5V8"/>'),
  play:   ico('<path d="M4.5 3l8 5-8 5z"/>'),
  stop:   ico('<rect x="4" y="4" width="8" height="8" rx="1"/>'),
  full:   ico('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>'),
  pointer: ico('<path d="M3.5 2.5l8 4-3.4 1.2L6.9 11z"/>'),
  flame:  ico('<path d="M8 1.4c.4 2.3-.9 3.1-1.8 4.3C5.2 7 4.6 8.2 4.6 9.5A3.4 3.4 0 008 13.6a3.4 3.4 0 003.4-4c0-1.4-.7-2.4-1.4-3.3-.2 1-.7 1.5-1.4 1.7.4-2 0-4.1-.6-6.6z"/>'),
  compass: ico('<circle cx="8" cy="8" r="6"/><path d="M10.6 5.4L9.1 9.1 5.4 10.6 6.9 6.9z"/>'),
  mic:    ico('<rect x="6" y="1.8" width="4" height="8" rx="2"/><path d="M3.5 7.5a4.5 4.5 0 009 0M8 12v2.2M5.6 14.2h4.8"/>'),
  comment: ico('<path d="M2.5 3.2h11v7.3H8l-3.2 2.6v-2.6H2.5z"/>'),
  globe:  ico('<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 1.8 2.8 3.8 2.8 6S10 12.2 8 14M8 2C6 3.8 5.2 5.8 5.2 8S6 12.2 8 14"/>')
};
const visPill = (publicId, shareCount, mode) => publicId ? `<span class="pill pub">${ICON.globe}Public${mode === 'locked' ? ' · as is' : ''}</span>` : shareCount ? `<span class="pill sh">${ICON.people}Shared · ${shareCount}</span>` : `<span class="pill">${ICON.lock}Private</span>`;

/* What kind of process is open decides the buttons */
function kindOf(p){
  if (S.compare) return 'compare';
  if (p.example) return 'example';
  if (p.readonly && p.viewShare) return 'view';
  if (p.readonly) return 'public';
  if (p.proposalFor) return 'draft';
  if (p.role === 'edit') return 'shared';
  return 'owned';
}
function visHTML(p){
  const k = kindOf(S.real || p);
  const q = S.real || p;
  if (k === 'example') return '';
  if (k === 'public' || k === 'compare') return `<span class="by">by ${esc(q.publishedBy)} · v${q.version || 1}</span>`;
  if (k === 'view') return `<span class="pill">View only</span><span class="by hide-sm">shared by ${esc(q.owner)}</span>`;
  if (k === 'draft') return `<span class="pill ex">Suggestion</span><span class="by hide-sm">for “${esc(q.suggestTitle || 'a public process')}”</span>`;
  if (k === 'shared') return `<span class="pill sh">${ICON.people}Shared</span><span class="by hide-sm">by ${esc(q.owner)}</span>`;
  return visPill(q.publicId, q.shareCount, q.publicMode);
}
const likeHTML = q => `<button class="btn sm like${q.liked ? ' on' : ''}" data-act="like" aria-pressed="${!!q.liked}" aria-label="Like">${ICON.heart}${q.likes || 0}</button>`;
function primaryHTML(p){
  const k = kindOf(p), q = S.real || p;
  const n = q.openProposals || 0;
  if (k === 'compare') return '';
  if (k === 'public') return `${likeHTML(q)}${commentBtn(q)}<button class="btn primary sm" data-act="copy">Make my own copy</button>${shareButtons(q.publicId)}`;
  if (k === 'example') return `<button class="btn sm" data-act="copy">Make a copy</button>${shareButtons(q.id)}`;
  if (k === 'view') return `<button class="btn sm" data-act="copy">Make a copy</button>`;
  if (k === 'draft') return p.maps.m_root.steps.length ? `<button class="btn primary sm" data-act="submit">${p.submitted ? 'Submit again' : 'Submit for review'}</button>` : '';
  return `<button class="btn sm" data-act="share">${q.publicId ? ICON.globe : q.shareCount ? ICON.people : ICON.lock}Share</button>${q.publicId ? commentBtn(q) + shareButtons(q.publicId) : ''}`;
}
function menuHTML(p){
  const k = kindOf(p), items = [];
  if (k === 'owned'){
    items.push(['share', 'Share & publish…']);
    if (p.publicId) items.push(['openpublic', 'View public version'], ['tweet', 'Share on X'], ['copypub', 'Copy public link'], ['copyguide', 'Copy guided link'], ['copyembed', 'Copy embed code'], ['preview', 'Preview image']);
    items.push(['delete', 'Delete', 'danger']);
  } else if (k === 'shared'){ items.push(['share', 'People with access'], ['copy', 'Make a private copy'], ['leave', 'Remove from my list', 'danger']); }
  else if (k === 'draft'){ items.push(['openpublic', 'View the public version'], ['delete', 'Discard this suggestion', 'danger']); }
  else if (k === 'public'){ items.push(['copy', 'Make my own copy'], ['tweet', 'Share on X'], ['copypub', 'Copy link'], ['copyguide', 'Copy guided link'], ['copyembed', 'Copy embed code'], ['preview', 'Preview image']); }
  else if (k === 'view'){ items.push(['copy', 'Make a private copy'], ['leave', 'Remove from my list', 'danger']); }
  else items.push(['copy', 'Make a copy']);
  if (k !== 'compare') items.unshift(['export', 'Export as Markdown (.md)'], ['exportflow', 'Export flow (.html)'], ['copyskill', 'Copy as Claude skill'], ['copygpt', 'Copy as ChatGPT instructions']);
  return `<div class="menu" role="menu">${items.map(([a, l, c]) => `<button role="menuitem" class="menu-item${c ? ' ' + c : ''}" data-act="${a}">${esc(l)}</button>`).join('')}</div>`;
}
function renderPanel(){
  const el = $('#wpanel'); if (!el) return;
  const p = S.cur, msg = S.panelMsg ? `<p class="hint panel-msg" role="status">${esc(S.panelMsg)}</p>` : '';
  if (!S.panel){ el.innerHTML = ''; return; }
  const close = '<button class="btn ghost sm" data-act="close" aria-label="Close">✕</button>';
  let html = '';
  if (S.panel === 'menu') html = menuHTML(p);
  else if (S.panel === 'update' || S.panel === 'submit') html = `<form class="sheet" data-form="${S.panel}"><div class="ins-head"><span class="label">${S.panel === 'update' ? 'Update the public version' : 'Submit for review'}</span>${close}</div>
      <p>${S.panel === 'update' ? 'Your changes become a suggestion on the public version, like anyone else’s. ' : ''}People compare before and after and vote. ${esc(RULE_SHORT)}</p>
      <label class="label" for="pnote">What did you change?</label><textarea id="pnote" name="note" rows="3" required maxlength="500" placeholder="e.g. Added the step where the pan is preheated"></textarea>
      <div class="prop-acts"><button class="btn primary sm">Submit</button></div>${msg}</form>`;
  else if (S.panel === 'delete') html = `<div class="sheet"><div class="ins-head"><span class="label">${p.proposalFor ? 'Discard this suggestion?' : 'Delete this process?'}</span>${close}</div>
      <p>This can't be undone${p.publicId ? ', and the public version goes too' : ''}.</p><div class="prop-acts"><button class="btn danger sm" data-act="delete-yes">Delete</button><button class="btn sm" data-act="close">Cancel</button></div></div>`;
  else if (S.panel === 'share') html = shareHTML();
  else if (S.panel === 'comments') html = commentsHTML();
  else if (S.panel === 'review') html = reviewHTML();
  else if (S.panel === 'history') html = historyHTML();
  el.innerHTML = `<div class="wpanel-in ${S.panel === 'menu' ? 'is-menu' : 'is-sheet'}">${html}</div>`;
  if (S.panel === 'share' && !S.shareData) loadShares();
  if (S.panel === 'comments' && !S.commentsData) loadComments();
  setTimeout(() => el.querySelector('textarea, input:not([type=hidden])')?.focus(), 0);
}
async function onAction(e){
  const b = e.target.closest('[data-act]'); if (!b) return;
  e.stopPropagation();
  const a = b.dataset.act, p = S.cur;
  S.panelMsg = '';
  switch (a){
    case 'close': S.panel = null; break;
    case 'suggest': S.panel = null; startSuggestion(); return;
    case 'copy': S.panel = null; ensureOwned(); renderWork(); flushSoon(); return;
    case 'review': S.panel = 'review'; S.reviewData = null; loadReview(); break;
    case 'history': S.panel = 'history'; S.historyData = null; loadHistory(); break;
    case 'publish': S.panel = 'share'; S.shareData = null; break;
    case 'update': S.panel = null; publish(); return;
    case 'submit': S.panel = 'submit'; break;
    case 'share': S.panel = 'share'; S.shareData = null; break;
    case 'delete': S.panel = 'delete'; break;
    case 'delete-yes': S.panel = null; deleteProcess(p.id); return;
    case 'leave': S.panel = null; deleteProcess(p.id); return;
    case 'unpublish': unpublish(); return;
    case 'openpublic': S.panel = null; openProcess(p.publicId || p.proposalFor, 'pub'); return;
    case 'compare': openCompare(b.dataset.id); return;
    case 'side': if (S.compare){ S.compare.side = b.dataset.side; applyCompareSide(); } return;
    case 'vote': vote(b.dataset.id, b.dataset.choice); return;
    case 'withdraw': withdraw(b.dataset.id); return;
    case 'endcompare': closeCompare(); S.panel = 'review'; break;
    case 'unshare': unshare(b.dataset.id); return;
    case 'newown': S.panel = null; startNew(); return;
    case 'guideme': startGuide(); return;
    case 'comments': S.panel = S.panel === 'comments' ? null : 'comments'; S.commentsData = null; break;
    case 'delcomment': try { await API.del('/api/public/' + pubId() + '/comments/' + b.dataset.id); } catch (e){ S.panelMsg = e.message; } S.commentsData = null; loadComments(); return;
    case 'jumpc': { const [mid, sid] = String(b.dataset.ref).split('|'); S.panel = null; renderPanel(); jumpTo(mid, sid); return; }
    case 'copyguide': case 'copyembed': {
      const id = b.dataset.pub || (S.real || p).publicId;
      const text = a === 'copyguide' ? pubLink(id) + '?guide=1' : '<iframe src="' + location.origin + '/embed/' + id + '" width="100%" height="560" style="border:1px solid #D7DDE5;border-radius:12px" loading="lazy" allowfullscreen title="Process map"></iframe>';
      try { await navigator.clipboard.writeText(text); alertBox(a === 'copyguide' ? 'Guided link copied. Whoever opens it is walked through the process step by step.' : 'Embed code copied. Paste it into any web page.'); } catch { alertBox('Copy this: ' + text); }
      track(a === 'copyguide' ? 'share_guided' : 'share_embed', { publicId:id });
      S.panel = null; renderPanel(); return; }
    case 'preview': { const id = b.dataset.pub || (S.real || p).publicId; window.open('/p/' + id + '/opengraph-image', '_blank', 'noopener'); S.panel = null; renderPanel(); return; }
    case 'like': {
      const q = S.real || p; if (!q.publicId) break;
      try { const d = await API.post('/api/public/' + q.publicId + '/like', {}); q.liked = d.liked; q.likes = d.likes; track(d.liked ? 'like' : 'unlike', { publicId:q.publicId }); }
      catch (e){ alertBox(e.message); }
      break; }
    case 'copyskill': case 'copygpt': {
      const q = S.real || p, doc = { title:q.title, maps:q.maps };
      let text, msg;
      if (a === 'copyskill'){ text = claudeSkill(doc); msg = 'Copied. Save it as SKILL.md in a folder named ' + skillSlug(doc) + ', then add the folder to Claude as a skill.'; }
      else { const r = chatgptInstructions(doc); text = r.text; msg = r.trimmed ? 'Copied, trimmed to ChatGPT’s 8,000 character limit. Export as Markdown and add it to the GPT as a knowledge file for the rest.' : 'Copied. Paste it into your GPT’s Instructions.'; }
      try { await navigator.clipboard.writeText(text); alertBox(msg); } catch { alertBox('Could not copy. Use Export as Markdown instead.'); }
      track(a === 'copyskill' ? 'copy_claude_skill' : 'copy_chatgpt', {}, q.id);
      S.panel = null; renderPanel(); return; }
    case 'exportflow': {
      const q = S.real || p;
      const html = flowHtml({ title:q.title, maps:q.maps }, { author:q.publishedBy, url:q.publicId ? pubLink(q.publicId) : undefined });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type:'text/html' }));
      a.download = ((q.title || 'process').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'process') + '-flow.html';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      track('export_flow', {}, q.id);
      alertBox('Saved the flow as an HTML file. Open it in any browser.');
      S.panel = null; renderPanel(); return; }
    case 'export': {
      const q = S.real || p;
      const md = exportMarkdown({ title:q.title, maps:q.maps }, { url:q.publicId ? pubLink(q.publicId) : undefined, author:q.publishedBy });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([md], { type:'text/markdown' }));
      a.download = ((q.title || 'process').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'process') + '.md';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      track('export_ai', {}, q.id);
      alertBox('Saved as a Markdown (.md) file. Upload it to ChatGPT or Claude.');
      S.panel = null; renderPanel(); return; }
    case 'tweet': {
      const q = S.real || p, t = (q.title && q.title !== 'Untitled process') ? q.title : 'a process';
      track('share_x', { publicId:b.dataset.pub || q.publicId });
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent('How ' + (t.length > 90 ? t.slice(0, 90) + '…' : t) + ' gets done, mapped on Process the World. Improve it or build your own:') + '&url=' + encodeURIComponent(pubLink(b.dataset.pub || q.publicId)), '_blank', 'noopener');
      S.panel = null; renderPanel(); return; }
    case 'copypub': {
      const link = pubLink(b.dataset.pub || (S.real || p).publicId);
      try { await navigator.clipboard.writeText(link); alertBox('Link copied.'); } catch { alertBox('Copy this link: ' + link); }
      track('share_link', { publicId:b.dataset.pub });
      S.panel = null; renderPanel(); return; }
    case 'copylink': {
      const link = b.dataset.link;
      try { await navigator.clipboard.writeText(link); S.panelMsg = 'Invite link copied. Send it any way you like; it works once.'; }
      catch { S.panelMsg = 'Copy this invite link: ' + link; }
      break; }
  }
  renderPanel(); renderTopActions();
}
function flushSoon(){ dirty = true; flush(); }
async function onPanelSubmit(e){
  e.preventDefault();
  const f = e.target, kind = f.dataset.form, btn = f.querySelector('button.primary');
  if (btn) btn.disabled = true;
  if (kind === 'publish') await publish('');
  else if (kind === 'update'){ const n = f.elements.note.value.trim(); if (!n){ S.panelMsg = 'Add a short note about what you changed.'; renderPanel(); return; } await publish(n); }
  else if (kind === 'submit'){ const n = f.elements.note.value.trim(); if (!n){ S.panelMsg = 'Add a short note about what you changed.'; renderPanel(); return; } await submitSuggestion(n); renderPanel(); }
  else if (kind === 'invite') await invite(f);
  else if (kind === 'comment') await postComment(f);
  if (btn) btn.disabled = false;
}
function onPanelChange(e){
  const s = e.target.closest('[data-role-for]'); if (s) setRole(s.dataset.roleFor, s.value);
}
/* Public processes get a link of their own; people arriving from it are invited to edit or build their own */
function tagbarHTML(p){
  if (S.compare) return '';
  const k = kindOf(p), q = S.real || p, tags = q.tags || [];
  const editable = k === 'owned' || k === 'shared';
  const pills = tags.map(t => `<span class="tagpill on">${esc(t)}${editable ? `<button data-untag="${esc(t)}" aria-label="Remove tag ${esc(t)}">✕</button>` : ''}</span>`).join('');
  const add = editable && tags.length < 8 ? `<form data-tagform class="tagform"><input name="tag" list="taglist" placeholder="+ add a tag" maxlength="24" autocomplete="off" aria-label="Add a tag"><datalist id="taglist">${allTags().slice(0, 40).map(([t]) => `<option value="${esc(t)}">`).join('')}</datalist></form>` : '';
  return pills + add;
}
let tagTimer = 0;
function tagsChanged(){
  const p = S.cur; touch(); renderTopActions();
  document.querySelector('#tagbar input')?.focus();
  if (p.publicId){ clearTimeout(tagTimer); tagTimer = setTimeout(() => { flush().then(() => API.post('/api/processes/' + p.id + '/publish', {})).then(loadPublic).catch(() => {}); }, 1500); }
}
function addTag(v){
  const p = S.cur, t = cleanTag(v); if (!p || !t || readOnly(p)) return;
  p.tags = cleanTags([...(p.tags || []), t]); logEvent(p, { who:'human', op:'add_tag', tag:t }); tagsChanged();
}
function removeTag(t){
  const p = S.cur; if (!p || readOnly(p)) return;
  p.tags = (p.tags || []).filter(x => x !== t); tagsChanged();
}
const pubLink = id => id.startsWith('ex_') ? location.origin + '/?example=' + id : location.origin + '/p/' + id;
function shareButtons(id){
  if (!id) return '';
  return `<button class="btn sm" data-act="tweet" data-pub="${esc(id)}">Share on X</button><button class="btn sm" data-act="copypub" data-pub="${esc(id)}">${ICON.link}Copy link</button>`;
}
function pubbarHTML(p){
  const q = S.real || p;
  if (S.compare) return '';
  if (kindOf(p) === 'example') return `<div class="pubbar"><span>This is an example. Make a copy to change it, or build a process of your own. It's free to start, no account needed.</span><span class="prop-acts"><button class="btn primary sm" data-act="newown">Build my own</button>${shareButtons(q.id)}</span></div>`;
  if (kindOf(p) !== 'public' || !q.publicId) return '';
  return `<div class="pubbar"><span><b>${esc(q.title)}</b> by ${esc(q.publishedBy)}. Make your own copy to change it, or build one of your own. Free to start, no account needed.</span>
    <span class="prop-acts"><button class="btn primary sm" data-act="guideme">${ICON.compass}Guide me</button><button class="btn sm" data-act="newown">Build my own</button>${shareButtons(q.publicId)}</span></div>`;
}
function renderTopActions(){
  const p = S.cur; if (!p || !$('#wprimary')) return;
  $('#pubbar').innerHTML = pubbarHTML(p);
  if (!document.activeElement?.closest?.('#tagbar')) $('#tagbar').innerHTML = tagbarHTML(p);
  $('#vis').innerHTML = visHTML(p);
  $('#wprimary').innerHTML = primaryHTML(p);
  $('#save').textContent = S.compare ? '' : readOnly(p) ? (kindOf(p) === 'public' ? 'Changes make a copy or a suggestion' : 'Changes make a private copy') : S.save;
}

function renderWork(fromStream){
  if (S.view !== 'work' || !S.cur) return;
  const p = S.cur;
  S.path = S.path.filter(id => p.maps[id]); if (!S.path.length) S.path = ['m_root'];
  const t = $('#title'); if (document.activeElement !== t) t.value = p.title === 'Untitled process' ? '' : p.title;
  t.readOnly = !!S.compare;
  renderTopActions();
  const wa = $('#wacct'); wa.innerHTML = signInHTML() + acctHTML(); wireAcct(wa); wireSignIn(wa); wireEmailForm(wa);
  $('#work').dataset.tab = S.tab;
  $('#work').classList.toggle('comparing', !!S.compare);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#stop').hidden = !S.busy; $('#sendb').disabled = S.busy || !!S.compare;
  const fb = $('#finish'); fb.textContent = p.status === 'done' ? 'Resume' : 'Finish map'; fb.disabled = S.busy || readOnly(p);
  if (S.checksOpen && !findIssues(p).length) S.checksOpen = false;
  renderMsgs(); renderCompare(); renderCrumbs(); renderBoard(); renderInspector(); renderChecks();
  if (!fromStream) renderPanel();
  if (S.fresh.size){ const f = S.fresh; setTimeout(() => { f.forEach(id => document.querySelector(`[data-step="${CSS.escape(id)}"]`)?.classList.remove('fresh')); }, 1700); S.fresh = new Set(); }
}
function renderMsgs(){
  const p = S.cur, el = $('#msgs');
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  if (!p.chat.length){
    el.innerHTML = `<div class="msg assistant">Tell me about a process: what it's called, who's involved, and what happens first. I'll build the map as you go and ask about anything that's missing.</div>
    <div class="starters"><div class="label">Or start with</div>${STARTERS.map(s => `<button class="starter" data-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
    return;
  }
  const lastU = lastUserIndex(p);
  const canEdit = !S.busy && p.undo && p.undo.chatIndex === lastU;
  el.innerHTML = p.chat.map((m, i) => {
    if (m.role === 'note') return `<div class="msg note">${esc(m.content)}</div>`;
    if (m.role === 'user') return `<div class="msg user">${esc(m.content)}</div>${i === lastU && canEdit ? '<button class="edit-last" data-edit>Edit message</button>' : ''}`;
    if (m.pending && !m.content) return `<div class="msg assistant"><span class="thinking"><i></i><i></i><i></i>&nbsp;${m.checking ? 'Checking the map' : m.ops ? 'Mapping · ' + m.ops + ' change' + (m.ops === 1 ? '' : 's') : 'Listening'}</span></div>`;
    let x = `<div class="msg assistant${m.err ? ' err' : ''}">${esc(m.content)}`;
    if (m.fixed) x += `<span class="fixed">Checked the map: ${esc(m.fixed)}</span>`;
    if (m.proposals){
      const names = m.proposals.items.map(it => '“' + it.label + '”').join(', ');
      x += m.proposals.state === 'open'
        ? `<span class="prop">Remove ${esc(names)}? They're marked on the map.<span class="prop-acts"><button class="btn danger" data-prop="remove" data-idx="${i}">Remove</button><button class="btn" data-prop="keep" data-idx="${i}">Keep</button></span></span>`
        : `<span class="ops">${m.proposals.state === 'removed' ? 'Removed' : 'Kept'} ${esc(names)}</span>`;
    }
    if (m.summary && i === p.chat.length - 1) x += summaryHTML(p);
    if (m.ask) x += `<span class="ask">${esc(m.ask)}</span>${i === p.chat.length - 1 && !readOnly(p) ? (m.askSkipped ? '<span class="ops">Skipped</span>' : `<button class="linkish skipq" data-skip="${i}">Skip this question</button>`) : ''}`;
    if (m.ops) x += `<span class="ops">${m.ops} change${m.ops === 1 ? '' : 's'} to the map</span>`;
    if (!m.err && !readOnly(p) && m.content && !(m.summary && !m.turnId)) x += rateHTML(m, i);
    return x + '</div>';
  }).join('') + checkinHTML();
  if (nearBottom || S.busy) el.scrollTop = el.scrollHeight;
}

function renderCrumbs(){
  const p = S.cur, ev = p.events || [];
  const ai = ev.filter(e => e.who === 'ai').length;
  const hu = ev.filter(e => e.who === 'human' && (e.op !== 'chat_feedback' || e.type === 'correction' || e.type === 'confusion')).length;
  const here = findIssues(p).filter(i => i.map === curMap().id || i.at === curMap().id);
  const totalDepth = stats(p).depth;
  const crumbs = S.path.map((id, i) => {
    const m = p.maps[id]; const last = i === S.path.length - 1;
    return (i ? '<span class="sep">/</span>' : '') + `<button class="crumb${last ? ' cur' : ''}" ${last ? 'aria-current="page"' : `data-depth="${i}"`}>${esc(i === 0 ? p.title : m.title)}</button>`;
  }).join('');
  const pub = '';
  $('#crumbs').innerHTML = `${crumbs}
    <span class="depth" title="Layer ${S.path.length} of ${totalDepth}">${Array.from({length:Math.max(totalDepth,S.path.length)},(_,i)=>`<b class="${i < S.path.length ? 'on' : ''}"></b>`).join('')}</span>
    <span class="spacer"></span>
    ${here.length ? `<button class="pill warn" data-checks aria-expanded="${S.checksOpen ? 'true' : 'false'}">${here.length} to check</button>` : ''}
    <span class="signal" title="Every AI change and human correction is kept as learning signal">${ai} AI changes · ${hu} corrections</span>
    ${pub}`;
}

/* Pain points: where the process hurts */
const PAIN_NAME = { 1:'Annoying', 2:'Painful', 3:'Critical' };
function painSteps(p){
  const out = [];
  Object.values(p?.maps || {}).forEach(m => m.steps.forEach(s => { if (s.pain) out.push({ map:m.id, mapTitle:m.title, id:s.id, label:s.label, level:s.pain.level || 2, note:s.pain.note || '' }); }));
  return out.sort((a, b) => b.level - a.level);
}
const countPain = p => painSteps(p).length;
function renderPainList(){
  const el = $('#painlist'); if (!el) return;
  if (!S.painView){ el.innerHTML = ''; return; }
  const list = painSteps(S.cur);
  el.innerHTML = `<div class="pl-card"><div class="pl-head"><b>${ICON.flame} Pain points</b><button data-pclose aria-label="Close" onclick="this.closest('.painlist').innerHTML=''">✕</button></div>${list.length ? list.map(x => `<button class="pl-item l${x.level}" data-pmap="${esc(x.map)}" data-pjump="${esc(x.id)}"><span class="pl-lv">${PAIN_NAME[x.level]}</span><b>${esc(x.label)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}${x.map !== 'm_root' ? `<small class="pl-in">in ${esc(x.mapTitle)}</small>` : ''}</button>`).join('') : '<p class="hint">No pain points marked yet. Select a step and set its pain level.</p>'}</div>`;
}

/* Guided mode: choose your path through the process, one step at a time */
const toneOf = lab => /^(yes|y|ok|okay|approved?|pass(ed)?|true|done|found|clear(ed)?|success|accept(ed)?|signed|match(es)?|resolved|enough|ready)\b/i.test(String(lab || '')) ? 'yes' : /^(no|n|not|fail(ed)?|reject(ed)?|denied|false|retry|missing|wait|too|stuck|nothing|blocked|cancel(led)?)\b/i.test(String(lab || '')) ? 'no' : '';
function gMap(){ return S.cur.maps[S.guide.map]; }
function gStep(){ return gMap()?.steps.find(x => x.id === S.guide.step); }
function startGuide(){
  const p = S.cur; if (!p) return;
  stopPlay(); S.sel = null;
  const m = p.maps.m_root, st = m.steps.find(s => s.kind === 'start') || m.steps[0];
  if (!st){ alertBox('Add some steps first, then guide yourself through them.'); return; }
  S.tab = 'map'; S.painView = false;
  S.guide = { map:'m_root', step:st.id, stack:[], hist:[], after:false, taken:1, done:false, visited:{ ['m_root|' + st.id]:1 } };
  track('guide_started', {}, p.id); guideApply();
}
function stopGuide(){
  S.guide = null;
  document.querySelector('#board')?.classList.remove('playing');
  document.querySelectorAll('.step.now,.step.trail').forEach(x => x.classList.remove('now', 'trail'));
  const el = $('#guide'); if (el) el.innerHTML = '';
  if ($('#zoomctl')) updateZoomCtl();
}
function guideApply(){
  const g = S.guide; if (!g) return;
  S.path = pathTo(g.map); renderWork(); guideCard(); markGuide();
}
function markGuide(){
  const g = S.guide; if (!g) return;
  const b = $('#board'); if (!b) return; b.classList.add('playing');
  b.querySelectorAll('.step').forEach(el => {
    const key = g.map + '|' + el.dataset.step;
    el.classList.toggle('now', !g.done && el.dataset.step === g.step);
    el.classList.toggle('trail', el.dataset.step !== g.step && !!g.visited[key]);
  });
  b.querySelector('.step.now')?.scrollIntoView({ block:'center', inline:'center', behavior:'smooth' });
}
function guideChoices(){
  const g = S.guide, m = gMap(), s = gStep(), out = [];
  const kids = s.child && S.cur.maps[s.child];
  const nexts = s.next || [];
  if (kids && !g.after) out.push({ k:'dive', label:'Walk through the details ↘', sub:countSteps(S.cur, s.child) + ' steps inside' });
  if (s.link) out.push({ k:'link', label:'Open “' + (s.link.title || 'linked process') + '” ↗', sub:'A whole process of its own' });
  nexts.forEach(n => {
    const tm = n.map && n.map !== m.id ? S.cur.maps[n.map] : m, ts = tm?.steps.find(x => x.id === n.to); if (!ts) return;
    const skip = kids && !g.after && nexts.length === 1 && !n.label;
    out.push({ k:'go', map:tm.id, step:ts.id, label:n.label || (skip ? 'Skip the details' : nexts.length > 1 ? ts.label : 'Next'), sub:n.label ? ts.label : (nexts.length > 1 || skip ? '' : ts.label), tone:toneOf(n.label), soft:!!skip });
  });
  if (!nexts.length){
    if (g.stack.length){ const top = g.stack[g.stack.length - 1], ps = S.cur.maps[top.map].steps.find(x => x.id === top.step); out.push({ k:'return', label:'Back to “' + (ps?.label || 'the main flow') + '”', sub:'Finish this part and continue' }); }
    else out.push({ k:'finish', label:'Finish', sub:'You reached the end' });
  }
  return out;
}
function guideCard(){
  const g = S.guide, el = $('#guide'); if (!g || !el) return;
  if (g.done){
    const q = S.cur, pubId = q.publicId;
    el.innerHTML = `<div class="g-card done"><div class="g-top"><span class="g-count">Done</span><button data-g="exit" aria-label="Exit guide">✕</button></div>
      <div class="g-q">That's the whole path.</div><p class="g-sub">You went through ${g.taken} step${g.taken === 1 ? '' : 's'}.</p>
      <div class="g-actions"><button class="g-btn primary" data-g="restart">Start over</button>${pubId ? shareButtons(pubId) : ''}<button class="g-btn" data-g="exit">Close</button></div></div>`;
    return;
  }
  const m = gMap(), s = gStep(), lane = m.lanes.find(l => l.id === s.lane), choices = guideChoices();
  const uses = (s.uses || []).map(u => m.lanes.find(l => l.id === u)?.name).filter(Boolean);
  const layerNote = g.stack.length ? `<span class="g-layer">in “${esc(m.title)}”</span>` : '';
  const trail = g.hist.slice(-3).map(h => S.cur.maps[h.map]?.steps.find(x => x.id === h.step)?.label).filter(Boolean);
  el.innerHTML = `<div class="g-card">
    <div class="g-top"><span class="g-lane ${lane?.type === 'system' ? 'sys' : 'per'}">${esc(lane?.name || 'Someone')}</span><span class="g-count">Step ${g.taken}</span>${layerNote}<button data-g="exit" aria-label="Exit guide">✕</button></div>
    <div class="g-q">${esc(s.label)}</div>
    ${uses.length ? `<p class="g-sub">Using ${esc(uses.join(', '))}</p>` : ''}
    ${s.pain ? `<div class="g-pain l${s.pain.level}">${ICON.flame}<span><b>${PAIN_NAME[s.pain.level] || 'Painful'}.</b> ${esc(s.pain.note || 'This is where it hurts.')}</span></div>` : ''}
    <div class="g-actions">${choices.map((c, i) => `<button class="g-btn${c.tone ? ' ' + c.tone : ''}${i === 0 && !c.tone && !c.soft ? ' primary' : ''}${c.soft ? ' soft' : ''}" data-g="pick" data-i="${i}"><span class="g-n">${i + 1}</span><span class="g-t">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span></button>`).join('')}</div>
    <div class="g-foot"><button class="g-link" data-g="back" ${g.hist.length ? '' : 'disabled'}>← Back</button><button class="g-link" data-g="restart">Restart</button>${trail.length ? `<span class="g-trail">${trail.map(esc).join(' → ')} → <b>now</b></span>` : ''}</div>
  </div>`;
}
function guideChoose(i){
  const g = S.guide; if (!g || g.done) return;
  const c = guideChoices()[i]; if (!c) return;
  g.hist.push({ map:g.map, step:g.step, after:g.after, stack:g.stack.map(x => ({ ...x })) });
  if (c.k === 'go'){ g.map = c.map; g.step = c.step; g.after = false; g.taken++; g.visited[c.map + '|' + c.step] = 1; }
  else if (c.k === 'dive'){
    const s = gStep(), cm = S.cur.maps[s.child], st = cm.steps.find(x => x.kind === 'start') || cm.steps[0];
    g.stack.push({ map:g.map, step:g.step }); g.map = cm.id; g.step = st.id; g.after = false; g.taken++; g.visited[cm.id + '|' + st.id] = 1;
  } else if (c.k === 'return'){ const top = g.stack.pop(); g.map = top.map; g.step = top.step; g.after = true; }
  else if (c.k === 'link'){ const s = gStep(); stopGuide(); openProcess(s.link.id, s.link.scope === 'private' ? 'mine' : 'pub').then(() => startGuide()); return; }
  else if (c.k === 'finish'){ g.done = true; track('guide_finished', { steps:g.taken }, S.cur.id); }
  guideApply();
}
function guideBack(){
  const g = S.guide; if (!g || !g.hist.length) return;
  const h = g.hist.pop(); g.map = h.map; g.step = h.step; g.after = h.after; g.stack = h.stack; g.done = false; g.taken = Math.max(1, g.taken - 1);
  guideApply();
}
function onGuideClick(e){
  const b = e.target.closest('[data-g], [data-act]'); if (!b) return;
  if (b.dataset.act){ onAction(e); return; }
  const a = b.dataset.g;
  if (a === 'pick') guideChoose(Number(b.dataset.i));
  else if (a === 'back') guideBack();
  else if (a === 'restart') startGuide();
  else if (a === 'exit') stopGuide();
}

/* Zoom: zoom out for the simple picture, zoom in for every detail */
const ZMIN = 0.25, ZMAX = 1.75;
function isFull(){ const w = document.querySelector('.canvas-wrap'); return !!(document.fullscreenElement || w?.classList.contains('fs')); }
function updateZoomCtl(){
  const el = $('#zoomctl'), sc = $('#scroller'); if (!el) return;
  const d = S.detail || 'auto';
  if (sc){ sc.dataset.detail = d; sc.dataset.low = S.zoom < 0.55 ? '1' : '0'; sc.classList.toggle('hand', S.tool === 'hand'); }
  el.innerHTML = `<button data-tool="select" class="${S.tool === 'select' ? 'on' : ''}" aria-label="Select tool" title="Select (V)">${ICON.pointer}</button><button data-tool="hand" class="${S.tool === 'hand' ? 'on' : ''}" aria-label="Hand tool: drag to move around" title="Hand: drag to move around (hold Space)">${ICON.hand}</button>
    <span class="zsep"></span><button data-z="out" aria-label="Zoom out" title="Zoom out">−</button><button data-z="reset" class="zv" aria-label="Reset to 100%" title="Reset to 100%">${Math.round(S.zoom * 100)}%</button><button data-z="in" aria-label="Zoom in" title="Zoom in">+</button><button data-z="fit" title="Fit the whole map on screen">Fit</button>
    <span class="zsep"></span><button data-detail="simple" class="${d === 'simple' ? 'on' : ''}" title="Names only">Simple</button><button data-detail="full" class="${d === 'full' ? 'on' : ''}" title="Tools, links and labels">Detailed</button>
    <span class="zsep"></span><button data-guide class="${S.guide ? 'on' : ''}" title="Choose your path through the process">${ICON.compass}Guide me</button>${(() => { const n = countPain(S.cur); return n || (kindOf(S.cur) === 'owned') ? `<button data-pain class="${S.painView ? 'on' : ''}" title="Show where the process hurts">${ICON.flame}Pain${n ? ' ' + n : ''}</button>` : ''; })()}<button data-play class="${S.playing ? 'on' : ''}" title="Walk through the process, step by step">${S.playing ? ICON.stop + 'Stop' : ICON.play + 'Play'}</button><button data-fs aria-label="Full screen" title="Full screen">${ICON.full}</button>`;
}
function setZoom(z, cx, cy){
  const sc = $('#scroller'), b = $('#board'); if (!sc || !b) return;
  z = Math.max(ZMIN, Math.min(ZMAX, z)); const old = S.zoom; if (Math.abs(z - old) < 0.001) return;
  const px = cx ?? sc.clientWidth / 2, py = cy ?? sc.clientHeight / 2;
  const ox = (sc.scrollLeft + px) / old, oy = (sc.scrollTop + py) / old;
  S.zoom = z; S.zoomAuto = false; b.style.zoom = z;
  sc.scrollLeft = ox * z - px; sc.scrollTop = oy * z - py;
  updateZoomCtl();
}
function onZoomClick(e){
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.z === 'in') setZoom(S.zoom * 1.25);
  else if (b.dataset.z === 'out') setZoom(S.zoom / 1.25);
  else if (b.dataset.z === 'reset') setZoom(1);
  else if (b.dataset.z === 'fit'){ S.zoomAuto = true; S.fitFull = true; renderBoard(); S.fitFull = false; }
  else if (b.dataset.detail){ S.detail = b.dataset.detail; updateZoomCtl(); }
  else if (b.dataset.tool){ S.tool = b.dataset.tool; updateZoomCtl(); }
  else if ('guide' in b.dataset) S.guide ? stopGuide() : startGuide();
  else if ('pain' in b.dataset){ S.painView = !S.painView; updateZoomCtl(); renderBoard(); }
  else if ('play' in b.dataset) playWalk();
  else if ('fs' in b.dataset) toggleFull();
}
function toggleFull(){
  const w = document.querySelector('.canvas-wrap'); if (!w) return;
  if (document.fullscreenElement){ document.exitFullscreen(); return; }
  if (w.classList.contains('fs')){ w.classList.remove('fs'); setTimeout(() => { S.zoomAuto = true; renderBoard(); }, 30); return; }
  if (w.requestFullscreen) w.requestFullscreen().catch(() => { w.classList.add('fs'); setTimeout(() => { S.zoomAuto = true; renderBoard(); }, 30); });
  else { w.classList.add('fs'); setTimeout(() => { S.zoomAuto = true; renderBoard(); }, 30); }
}
document.addEventListener('fullscreenchange', () => { setTimeout(() => { if (S.view === 'work' && S.cur){ S.zoomAuto = true; renderBoard(); } }, 60); });

/* Hand tool: drag the canvas to move around a big map, like Miro. Also: hold Space, middle mouse, or drag empty background. */
let pan = null, swallowClick = false;
function wirePan(sc){
  sc.addEventListener('pointerdown', e => {
    if (e.button > 1 || e.target.closest('.zoomctl,button,input,select,textarea')) return;
    const onStep = e.target.closest('.step,.elabel');
    if (!(S.tool === 'hand' || S.space || e.button === 1 || !onStep)) return;
    pan = { x:e.clientX, y:e.clientY, l:sc.scrollLeft, t:sc.scrollTop, moved:false };
    try { sc.setPointerCapture(e.pointerId); } catch {}
    sc.classList.add('panning'); e.preventDefault();
  });
  sc.addEventListener('pointermove', e => {
    if (!pan) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
    sc.scrollLeft = pan.l - dx; sc.scrollTop = pan.t - dy;
  });
  const end = () => { if (!pan) return; swallowClick = pan.moved; pan = null; sc.classList.remove('panning'); setTimeout(() => { swallowClick = false; }, 0); };
  sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
  sc.addEventListener('click', e => { if (swallowClick || S.tool === 'hand'){ e.stopPropagation(); e.preventDefault(); swallowClick = false; } }, true);
}
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && S.view === 'work' && !e.target.closest?.('input,textarea,select,button,[contenteditable]')){ S.space = true; $('#scroller')?.classList.add('hand'); e.preventDefault(); }
  if ((e.key === 'v' || e.key === 'h') && S.view === 'work' && !e.metaKey && !e.ctrlKey && !e.target.closest?.('input,textarea,select,[contenteditable]')){ S.tool = e.key === 'h' ? 'hand' : 'select'; updateZoomCtl(); }
});
document.addEventListener('keyup', e => { if (e.code === 'Space'){ S.space = false; if (S.tool !== 'hand') $('#scroller')?.classList.remove('hand'); } });

/* Play: walk the process one step at a time, leaving a trail behind */
function stopPlay(){ S.playing = false; clearTimeout(S.playTimer); S.playNow = null; S.playSeen = {}; document.querySelector('#board')?.classList.remove('playing'); document.querySelectorAll('.step.now,.step.trail').forEach(x => x.classList.remove('now', 'trail')); updateZoomCtl(); }
function playWalk(){
  if (S.playing){ stopPlay(); return; }
  const m = curMap(); if (!m || !m.steps.length) return;
  S.sel = null; renderInspector();
  S.playing = true; S.playSeen = {};
  let id = (m.steps.find(s => s.kind === 'start') || m.steps[0]).id;
  document.querySelector('#board')?.classList.add('playing'); updateZoomCtl();
  const tick = () => {
    if (!S.playing) return;
    const s = m.steps.find(x => x.id === id); if (!s){ stopPlay(); return; }
    S.playSeen[id] = 1;
    document.querySelectorAll('.step.now').forEach(x => { x.classList.remove('now'); x.classList.add('trail'); });
    const el = document.querySelector('[data-step="' + CSS.escape(id) + '"]');
    el?.classList.remove('trail'); el?.classList.add('now');
    el?.scrollIntoView({ block:'center', inline:'center', behavior:'smooth' });
    const nxt = (s.next || []).filter(n => isInternal(n, m) && m.steps.some(x => x.id === n.to));
    const pick = nxt.find(n => !S.playSeen[n.to]);
    if (!pick){ S.playTimer = setTimeout(stopPlay, 1800); return; }
    id = pick.to; S.playTimer = setTimeout(tick, 1100);
  };
  tick();
}
function onBoardWheel(e){
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const sc = $('#scroller'), r = sc.getBoundingClientRect();
  setZoom(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
}
function renderBoard(){
  L.HEAD = innerWidth <= 420 ? 84 : innerWidth <= 820 ? 96 : 150; // matches the lane header width in CSS
  const m = curMap(), b = $('#board');
  if (!m.steps.length && !m.lanes.length){
    b.style.width = '100%'; b.style.height = '100%';
    b.innerHTML = `<div class="board-empty"><div><div class="label">${S.path.length > 1 ? 'Layer ' + S.path.length : 'Empty map'}</div><h3>${S.path.length > 1 ? 'Describe how “' + esc(m.title) + '” works' : 'Your map appears here'}</h3><span>People get their own lanes, technology gets its own lanes, and steps flow left to right. Say “this step has two parts” and it becomes a layer you can open.</span></div></div>`;
    return;
  }
  const g = layout(m);
  b.style.width = g.width + 'px'; b.style.height = g.height + 'px';
  const zkey = S.cur.id + '|' + m.id; S.drawNow = false; if (S.zoomKey !== zkey){ S.zoomKey = zkey; S.zoomAuto = true; S.drawNow = true; stopPlay(); }
  const sc0 = $('#scroller');
  if (S.zoomAuto && sc0 && sc0.clientWidth > 80){ const fitW = (sc0.clientWidth - 12) / g.width; S.zoom = Math.max(ZMIN, Math.min(1, S.fitFull ? fitW : Math.max(0.65, fitW))); }
  b.style.zoom = S.zoom; updateZoomCtl();
  let html = '';
  g.bands.forEach(bd => html += `<div class="band" style="top:${bd.y}px;width:${g.width}px">${bd.t}</div>`);
  g.lanes.forEach(l => html += `<div class="lane ${l.type}" style="top:${g.laneY[l.id]}px;height:${g.laneH[l.id]}px;width:${g.width}px"><div class="lane-head"><small>${l.type === 'system' ? 'Technology' : 'Person'}</small><b>${esc(l.name)}</b></div></div>`);
  // edges
  let paths = '', labels = '';
  const byId = Object.fromEntries(m.steps.map(s => [s.id, s]));
  m.steps.forEach(s => s.next.forEach((n, k) => {
    if (!isInternal(n, m)) return;
    const a = g.pos[s.id], z = g.pos[n.to]; if (!a || !z || !byId[n.to]) return;
    const ay = a.y + L.BOXH / 2, zy = z.y + L.BOXH / 2;
    let d, lx, ly;
    if (z.x > a.x){
      const sx = a.x + L.BOXW, mid = sx + (z.x - sx) / 2 + (k ? 6 : 0);
      d = `M${sx},${ay} H${mid} V${zy} H${z.x - 2}`; lx = mid; ly = ay === zy ? ay - 10 : (ay + zy) / 2;
    } else if (z.x === a.x){
      const sx = a.x + L.BOXW / 2;
      d = z.y > a.y ? `M${sx},${a.y + L.BOXH} V${z.y - 2}` : `M${a.x + L.BOXW},${ay} h18 V${zy} H${z.x + L.BOXW + 2}`;
      lx = sx + 14; ly = (a.y + L.BOXH + z.y) / 2;
    } else {
      const low = Math.max(a.y, z.y) + L.BOXH + 10;
      d = `M${a.x + L.BOXW / 2},${a.y + L.BOXH} V${low} H${z.x + L.BOXW / 2} V${z.y + L.BOXH + 2}`; lx = (a.x + z.x + L.BOXW) / 2; ly = low;
    }
    const lab = String(n.label || '').trim(), tone = /^(yes|y|ok|okay|approved?|pass(ed)?|true|done|found|clear(ed)?|success|accept(ed)?|signed|match(es)?|resolved|enough|ready)\b/i.test(lab) ? 'yes' : /^(no|n|not|fail(ed)?|reject(ed)?|denied|false|retry|missing|wait|too|stuck|nothing|blocked|cancel(led)?)\b/i.test(lab) ? 'no' : '';
    const back = z.x <= a.x && z.y !== a.y || z.x < a.x;
    const hot = S.sel && (s.id === S.sel || n.to === S.sel), dim = S.sel && !hot;
    paths += `<path d="${d}" class="e${tone ? ' e-' + tone : ''}${back ? ' e-back' : ''}${hot ? ' hot' : ''}${dim ? ' dim' : ''}" marker-end="url(#arr${tone ? '-' + tone : ''})" pathLength="1"/>`;
    if (lab) labels += `<div class="elabel${tone ? ' el-' + tone : ''}${hot ? ' hot' : ''}${dim ? ' dim' : ''}" style="left:${lx}px;top:${ly}px">${tone === 'yes' ? '✓ ' : tone === 'no' ? '✕ ' : ''}${esc(lab)}</div>`;
  }));
  html += `<svg class="edges${S.drawNow ? ' draw' : ''}" width="${g.width}" height="${g.height}" aria-hidden="true"><defs>${[['arr','--edge-strong'],['arr-yes','--ok-edge'],['arr-no','--no-edge']].map(([id, v]) => `<marker id="${id}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1,1 L11,6 L1,11 L3.5,6 z" style="fill:var(${v});stroke:none"/></marker>`).join('')}</defs>${paths}</svg>`;
  html += labels;
  const laneName = Object.fromEntries(m.lanes.map(l => [l.id, l.name]));
  const P = S.cur;
  const issueAt = {}; findIssues(P).forEach(i => { if (i.map === m.id && i.step) (issueAt[i.step] ||= []).push(i.text); });
  const parentStep = m.parent ? P.maps[m.parent.map]?.steps.find(x => x.id === m.parent.step) : null;
  m.steps.forEach(s => {
    const q = g.pos[s.id];
    const kids = s.child ? countSteps(P, s.child) : 0;
    const outs = s.next.filter(n => !isInternal(n, m)).map(n => { const tm = P.maps[n.map], ts = tm?.steps.find(x => x.id === n.to); return ts ? `<button class="xlink" data-jump="${esc(tm.id)}" data-step="${esc(ts.id)}" title="${esc(n.label || '')}">↗ ${esc(ts.label)} · ${esc(tm.id === 'm_root' ? 'main flow' : tm.title)}</button>` : ''; }).join('');
    const ins = incomingLinks(P, m.id, s.id).map(r => `<button class="xlink in" data-jump="${esc(r.map)}" data-step="${esc(r.step.id)}">↙ from ${esc(P.maps[r.map].title)}</button>`).join('');
    const back = s.kind === 'end' && parentStep && !s.next.length ? `<span class="back">↩ continues after “${esc(parentStep.label)}”</span>` : '';
    const dm = S.compare?.diff.marks[S.compare.side]?.[m.id]?.[s.id];
    const lt = (m.lanes.find(l => l.id === s.lane)?.type) === 'system' ? 'sys' : 'per';
    html += `<div class="step ${s.kind} lt-${lt}${s.pain ? ' haspain pl' + s.pain.level : ''}${S.drawNow ? ' pop' : ''}${S.sel === s.id ? ' sel' : ''}${S.fresh.has(s.id) ? ' fresh' : ''}${s.proposedRemove ? ' proposed' : ''}${dm ? ' diff-' + dm : ''}" data-step="${esc(s.id)}" role="button" tabindex="0" style="left:${q.x}px;top:${q.y}px;--d:${Math.round(q.x / L.COL) * 55}ms">
      ${s.pain ? `<span class="pain-badge l${s.pain.level}" title="Pain point${s.pain.note ? ': ' + esc(s.pain.note) : ''}">${ICON.flame}</span>` : ''}
      ${issueAt[s.id] ? `<span class="warn-dot" title="${esc(issueAt[s.id].join('\n'))}" aria-label="${esc(issueAt[s.id].join('. '))}">!</span>` : ''}
      ${s.proposedRemove ? '<span class="k rm">Remove?</span>' : ''}
      ${s.kind === 'decision' ? '<span class="k">◇ decision</span>' : s.kind === 'subprocess' ? (s.link ? '<span class="k">↗ linked process</span>' : '<span class="k">▤ subprocess</span>') : ''}
      <span>${esc(s.label)}</span>
      ${s.uses?.length ? `<span class="uses">${s.uses.filter(u => laneName[u]).map(u => `<span>${esc(laneName[u])}</span>`).join('')}</span>` : ''}
      ${s.link ? `<button class="open" data-link="${esc(s.link.id)}" data-scope="${esc(s.link.scope || 'public')}">Open ${esc(s.link.title || 'process')} ↗</button>` : s.kind === 'subprocess' ? `<button class="open" data-drill="${esc(s.id)}">${s.child ? 'Open · ' + kids + ' steps' : 'Open · empty'} ↘</button>` : ''}
      ${back}${outs || ins ? `<span class="xlinks">${outs}${ins}</span>` : ''}
    </div>`;
  });
  b.innerHTML = html;
  b.classList.toggle('painview', !!S.painView); renderPainList();
  if (S.guide) markGuide();
}

function pathTo(mapId){
  const p = S.cur, out = []; let m = p.maps[mapId], guard = 0;
  while (m && guard++ < 30){ out.unshift(m.id); m = m.parent ? p.maps[m.parent.map] : null; }
  return out[0] === 'm_root' ? out : ['m_root'];
}
function jumpTo(mapId, stepId){
  if (!S.cur.maps[mapId]) return;
  S.path = pathTo(mapId); S.sel = stepId || null; S.tab = 'map'; renderWork();
  if (stepId) document.querySelector(`[data-step="${CSS.escape(stepId)}"]`)?.scrollIntoView({block:'center', inline:'center', behavior:'smooth'});
}
function drill(stepId){
  const m = curMap(), s = m.steps.find(x => x.id === stepId); if (!s) return;
  if (!s.child){
    ensureOwned();
    const p = S.cur, mm = curMap(), ss2 = mm.steps.find(x => x.id === stepId);
    const id = 'm_' + ss2.id + '_' + Math.random().toString(36).slice(2,5);
    const lane = mm.lanes.find(l => l.id === ss2.lane);
    p.maps[id] = { id, title:ss2.label, parent:{ map:mm.id, step:ss2.id }, lanes:lane ? [{ id:rid('l'), name:lane.name, type:lane.type }] : [], steps:[] };
    ss2.kind = 'subprocess'; ss2.child = id;
    logEvent(p, { who:'human', op:'add_map', map:mm.id, id:ss2.id });
    touch(); S.path.push(id);
  } else S.path.push(s.child);
  S.sel = null; S.tab = 'map'; renderWork();
}
function onBoardClick(e){
  const lk = e.target.closest('[data-link]'); if (lk){ e.stopPropagation(); openProcess(lk.dataset.link, lk.dataset.scope === 'private' ? 'mine' : 'pub'); return; }
  const d = e.target.closest('[data-drill]'); if (d){ e.stopPropagation(); drill(d.dataset.drill); return; }
  const j = e.target.closest('[data-jump]'); if (j){ e.stopPropagation(); jumpTo(j.dataset.jump, j.dataset.step); return; }
  const st = e.target.closest('[data-step]');
  S.sel = st ? st.dataset.step : null; if (S.sel) S.checksOpen = false; renderBoard(); renderInspector(); renderChecks();
}
document.addEventListener('keydown', e => {
  const st = e.target.closest?.('[data-step]');
  if (st && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); S.sel = st.dataset.step; renderBoard(); renderInspector(); }
  if (S.guide && S.view === 'work' && !e.target.closest?.('input,textarea,select')){
    if (/^[1-9]$/.test(e.key)){ guideChoose(Number(e.key) - 1); return; }
    if (e.key === 'Backspace' || e.key === 'ArrowLeft'){ e.preventDefault(); guideBack(); return; }
    if (e.key === 'Escape'){ stopGuide(); return; }
  }
  if (e.key === 'Escape' && S.sel){ S.sel = null; renderBoard(); renderInspector(); }
});

const CORRECTIONS = [
  ['missing_after','Missing step after this', s => `There's a missing step after “${s.label}”: `],
  ['wrong_order','Wrong order', s => `“${s.label}” is in the wrong place. It should happen `],
  ['wrong_owner','Wrong person or system', s => `“${s.label}” is actually done by `],
  ['too_vague','Too vague', s => `“${s.label}” is too vague. What really happens is `],
  ['has_parts','This has parts', s => `“${s.label}” is really made of these subprocesses: `],
];
/* The processes a step can link to: your saved ones, ones shared with you, and published ones */
function linkOptions(s){
  const cur = S.cur?.id, opt = (scope, x) => `<option value="${scope}:${esc(x.id)}" ${s.link?.id === x.id ? 'selected' : ''}>${esc(x.title || 'Untitled process')}</option>`;
  const group = (name, scope, list) => list.length ? `<optgroup label="${name}">${list.map(x => opt(scope, x)).join('')}</optgroup>` : '';
  const mine = S.mine.filter(x => x.id !== cur && !x.proposalFor), shared = S.shared.filter(x => x.id !== cur && !x.proposalFor);
  return group('My processes', 'proc', mine) + group('Shared with me', 'proc', shared) + group('Published', 'pub', S.pub);
}
function renderInspector(){
  const box = $('#inspector'); const m = curMap(); const s = m.steps.find(x => x.id === S.sel);
  if (!s){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="inspector" role="dialog" aria-label="Step details">
    <div class="ins-head"><span class="label">Step · <span class="mono">${esc(s.id)}</span></span><button class="btn ghost" id="ix" aria-label="Close">✕</button></div>
    <div class="row"><label class="label" for="i-label">Name</label><input id="i-label" value="${esc(s.label)}"></div>
    <div class="row"><label class="label" for="i-lane">Lane</label><select id="i-lane">${m.lanes.map(l => `<option value="${esc(l.id)}" ${l.id === s.lane ? 'selected' : ''}>${esc(l.name)} (${l.type === 'system' ? 'technology' : 'person'})</option>`).join('')}${m.lanes.some(l=>l.id===s.lane)?'':'<option selected>Unassigned</option>'}</select></div>
    <div class="row"><label class="label" for="i-kind">Type</label><select id="i-kind">${KINDS.map(k => `<option ${k === s.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    <div class="row"><label class="label" for="i-link">Linked process</label><select id="i-link"><option value="">None</option>${linkOptions(s)}</select><p class="hint">Connect this step to a process you can open, saved or published, to build a bigger one.</p></div>
    <div class="row"><label class="label" for="i-pain">Pain point</label><select id="i-pain"><option value="0">None</option><option value="1" ${s.pain?.level === 1 ? 'selected' : ''}>Annoying</option><option value="2" ${s.pain?.level === 2 ? 'selected' : ''}>Painful</option><option value="3" ${s.pain?.level === 3 ? 'selected' : ''}>Critical</option></select>${s.pain ? `<input id="i-pain-note" placeholder="Where does it hurt?" maxlength="200" value="${esc(s.pain.note || '')}">` : ''}<p class="hint">Mark where this step is slow, error-prone, manual or costly.</p></div>
    <div class="acts"><button class="btn primary" id="i-drill">${s.link ? 'Open linked process ↗' : s.child ? 'Open subprocess ↘' : 'Break into a subprocess'}</button><button class="btn danger" id="i-del">Delete step</button></div>
    ${(() => { const mine = findIssues(S.cur).filter(i => i.map === m.id && i.step === s.id); return mine.length ? `<div class="row"><span class="label">To check</span><ul class="chk-list">${mine.map(i => issueRowHTML(i, true)).join('')}</ul></div>` : ''; })()}
    <div class="row"><span class="label">Did the AI get this wrong?</span>
      <div class="chips">${CORRECTIONS.map(c => `<button class="chip" data-corr="${c[0]}">${c[1]}</button>`).join('')}</div>
      <p class="hint">Corrections are logged as training signal, then you finish the sentence in the conversation.</p></div>
  </div>`;
  const edit = (field, val) => {
    ensureOwned(); const mm = curMap(), st = mm.steps.find(x => x.id === S.sel); if (!st) return;
    logEvent(S.cur, { who:'human', op:'edit_' + field, map:mm.id, id:st.id, before:st[field], after:val });
    st[field] = val; touch(); renderWork();
  };
  $('#ix').onclick = () => { S.sel = null; renderBoard(); renderInspector(); };
  $('#i-label').onchange = e => edit('label', e.target.value.trim() || s.label);
  $('#i-lane').onchange = e => edit('lane', e.target.value);
  $('#i-kind').onchange = e => edit('kind', e.target.value);
  $('#i-pain').onchange = e => {
    const lv = Number(e.target.value);
    ensureOwned(); const mm = curMap(), st = mm.steps.find(x => x.id === S.sel); if (!st) return;
    logEvent(S.cur, { who:'human', op:'edit_pain', map:mm.id, id:st.id, before:st.pain?.level || 0, after:lv });
    if (lv) st.pain = { level:lv, note:st.pain?.note || '' }; else delete st.pain;
    touch(); renderWork();
  };
  const pn = $('#i-pain-note'); if (pn) pn.onchange = e => { ensureOwned(); const mm = curMap(), st = mm.steps.find(x => x.id === S.sel); if (!st?.pain) return; st.pain.note = e.target.value.trim(); touch(); renderBoard(); };
  $('#i-link').onchange = e => {
    const v = e.target.value, [scope, lid] = v.split(':');
    const pr = v ? [...S.pub, ...S.mine, ...S.shared].find(x => x.id === lid) : null;
    ensureOwned(); const mm = curMap(), st = mm.steps.find(x => x.id === S.sel); if (!st) return;
    logEvent(S.cur, { who:'human', op:'edit_link', map:mm.id, id:st.id, before:st.link?.id || null, after:pr?.id || null });
    if (pr){ st.link = { id:pr.id, title:pr.title, scope:scope === 'pub' ? 'public' : 'private' }; st.kind = 'subprocess'; } else delete st.link;
    touch(); renderWork();
  };
  $('#i-drill').onclick = () => s.link ? openProcess(s.link.id, 'pub') : drill(s.id);
  $('#i-del').onclick = () => { ensureOwned(); const mm = curMap(); applyOp(S.cur, { op:'remove_step', map:mm.id, id:S.sel }, 'human'); S.sel = null; touch(); renderWork(); };
  box.querySelectorAll('[data-corr]').forEach(b => b.onclick = () => {
    const c = CORRECTIONS.find(x => x[0] === b.dataset.corr);
    ensureOwned(); logEvent(S.cur, { who:'human', op:'correction', type:c[0], map:curMap().id, id:s.id });
    touch(); S.tab = 'chat'; renderWork();
    const msg = $('#msg'); msg.value = c[2](s); msg.focus(); msg.setSelectionRange(msg.value.length, msg.value.length);
  });
}

/* ---------- Feedback, kept quiet ----------
   - thumbs on replies appear on hover (always faint on touch screens)
   - "Skip this question" under the latest question
   - one finish rating per map, inside the summary
   - one check-in per browser, after a few turns, only if nothing else was asked this session
   - the Feedback box in the bottom-right corner, always available */
const THUMB = d => `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" style="transform:${d < 0 ? 'scaleY(-1)' : 'none'}"><path d="M7 9V17H4V9h3zm2 8h5.2a2 2 0 0 0 2-1.6l1-5A2 2 0 0 0 15.2 8H12l.6-3.2A1.6 1.6 0 0 0 11 3L9 9v8z" fill="currentColor"/></svg>`;
function rateHTML(m, i){
  if (m.rated === 1) return '<span class="rate done">Thanks</span>';
  if (m.rated === -1) return m.reason ? '<span class="rate done">Thanks, noted</span>'
    : `<span class="rate why"><span class="label">What went wrong?</span>${['Wrong change','Missed something','Bad question','Confusing'].map(r => `<button class="chip" data-reason="${esc(r)}" data-idx="${i}">${esc(r)}</button>`).join('')}</span>`;
  return `<span class="rate"><button class="rbtn" data-rate="1" data-idx="${i}" aria-label="Helpful reply">${THUMB(1)}</button><button class="rbtn" data-rate="-1" data-idx="${i}" aria-label="Unhelpful reply">${THUMB(-1)}</button></span>`;
}
function rateReply(i, v){
  const p = S.cur, m = p.chat[i]; if (!m) return;
  m.rated = v; touch(); renderMsgs();
  flush().then(() => API.post('/api/feedback', { kind:'reply', rating:v, processId:p.id, turnId:m.turnId || null, context:{ reply:m.content, ask:m.ask || '' } })).catch(() => {});
}
function reasonReply(i, r){
  const p = S.cur, m = p.chat[i]; if (!m) return;
  m.reason = r; touch(); renderMsgs();
  const t0 = S.lastTurnId; if (m.turnId) S.lastTurnId = m.turnId;
  logEvent(p, { who:'human', op:'reply_reason', reason:r }); S.lastTurnId = t0;
}
function skipQuestion(i){
  const p = S.cur, m = p.chat[i]; if (!m) return;
  m.askSkipped = true; logEvent(p, { who:'human', op:'question_skipped', question:m.ask }); touch(); renderMsgs();
  $('#msg')?.focus();
}
function rateFinish(n){
  const p = S.cur; ensureOwned(); const q = S.cur;
  q.rating = n; logEvent(q, { who:'human', op:'finish_rating', rating:n }); touch(); renderMsgs();
  flush().then(() => API.post('/api/feedback', { kind:'finish', rating:n, processId:q.id, context:{ steps:stats(q).steps, layers:stats(q).depth } })).catch(() => {});
}
function finishReason(r){
  const p = S.cur; p.ratingWhy = r; logEvent(p, { who:'human', op:'finish_reason', reason:r }); touch(); renderMsgs();
}
function checkinHTML(){
  if (readOnly(S.cur) || S.busy || ls.get('ptw_checkin') || S.sessionTurns < 4 || (S.askedThisSession && !S.checkinOpen)) return '';
  S.askedThisSession = true; S.checkinOpen = true;
  return `<div class="checkin" role="group" aria-label="Quick question">
    <span>Quick one: is anything confusing so far?</span>
    <textarea id="ci-text" rows="2" placeholder="Optional"></textarea>
    <span class="prop-acts"><button class="btn sm primary" data-checkin="send">Send</button><button class="btn sm ghost" data-checkin="no">No, all good</button></span>
  </div>`;
}
function checkin(a){
  const text = $('#ci-text')?.value.trim();
  ls.set('ptw_checkin', '1'); S.checkinOpen = false;
  if (a === 'send' && text) API.post('/api/feedback', { kind:'checkin', text, processId:S.cur?.id, context:ctxSnapshot() }).catch(() => {});
  else track('checkin_declined');
  renderMsgs();
}
function ctxSnapshot(){
  const p = S.cur;
  return { view:S.view, processId:p?.id || null, title:p?.title || null, layer:p ? curMap()?.title : null, selected:S.sel || null, tab:S.tab,
    recent:p ? p.chat.filter(m => m.role !== 'note').slice(-4).map(m => ({ role:m.role, text:String(m.content).slice(0, 300) })) : [],
    screen:`${innerWidth}x${innerHeight}`, ua:navigator.userAgent.slice(0, 160) };
}
const FB_KINDS = ['Bug','Confusing','Idea','Like it'];
const FB = { open:false, kinds:new Set(), sent:false };
function renderFeedbackBox(){
  let box = document.getElementById('fbx');
  if (!box){ box = document.createElement('div'); box.id = 'fbx'; box.className = 'fbx'; document.body.appendChild(box); box.onclick = onFbClick; }
  if (!FB.open){ box.innerHTML = `<button class="fbx-pill" data-fb="open" aria-expanded="false">Feedback</button>`; return; }
  box.innerHTML = FB.sent ? `<div class="fbx-panel" role="dialog" aria-label="Feedback"><p class="ok">Thanks. We read every note.</p><button class="btn sm" data-fb="close">Close</button></div>` : `
    <div class="fbx-panel" role="dialog" aria-label="Feedback">
      <div class="ins-head"><span class="label">Tell us anything</span><button class="btn ghost sm" data-fb="close" aria-label="Close feedback">✕</button></div>
      <div class="chips">${FB_KINDS.map(k => `<button class="chip${FB.kinds.has(k) ? ' on' : ''}" data-fbk="${k}" aria-pressed="${FB.kinds.has(k)}">${k}</button>`).join('')}</div>
      <textarea id="fbx-text" rows="4" placeholder="What happened, or what would make this better?"></textarea>
      <p class="hint">We'll include what's on your screen so we can see what you mean.</p>
      <div class="prop-acts"><button class="btn primary sm" data-fb="send">Send</button></div>
    </div>`;
  setTimeout(() => document.getElementById('fbx-text')?.focus(), 0);
}
async function onFbClick(e){
  const k = e.target.closest('[data-fbk]');
  if (k){ const t = $('#fbx-text')?.value; FB.kinds.has(k.dataset.fbk) ? FB.kinds.delete(k.dataset.fbk) : FB.kinds.add(k.dataset.fbk); renderFeedbackBox(); if (t) $('#fbx-text').value = t; return; }
  const b = e.target.closest('[data-fb]'); if (!b) return;
  if (b.dataset.fb === 'open'){ FB.open = true; FB.sent = false; renderFeedbackBox(); return; }
  if (b.dataset.fb === 'close'){ FB.open = false; renderFeedbackBox(); return; }
  if (b.dataset.fb === 'send'){
    const text = $('#fbx-text').value.trim();
    if (!text && !FB.kinds.size){ $('#fbx-text').focus(); return; }
    b.disabled = true;
    try { await flush(); await API.post('/api/feedback', { kind:'button', text, reasons:[...FB.kinds], processId:S.cur && !readOnly(S.cur) ? S.cur.id : null, context:ctxSnapshot() }); FB.sent = true; FB.kinds = new Set(); }
    catch (err){ b.disabled = false; alertBox(err.message); return; }
    renderFeedbackBox(); setTimeout(() => { if (FB.sent){ FB.open = false; renderFeedbackBox(); } }, 2500);
  }
}
function alertBox(t){ S.toast = t; renderToast(); }
function renderToast(){
  let el = document.getElementById('toast');
  if (!S.toast){ el?.remove(); return; }
  if (!el){ el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(S.toast)}</span><button class="btn ghost sm" aria-label="Dismiss">✕</button>`;
  el.querySelector('button').onclick = () => { S.toast = ''; renderToast(); };
  clearTimeout(renderToast.t); renderToast.t = setTimeout(() => { S.toast = ''; renderToast(); }, 7000);
}

/* ---------- Boot ---------- */
const ALERTS = { invited:'Invite accepted. You’ll find the process under “Shared with me”.', saved:'Email confirmed. Your processes now follow you to any device.', 'signed-in':'Signed in. Your processes are here.', 'link-invalid':'That link expired or was already used. Request a new one from the account menu.', 'email-taken':'That email is already in use. Enter it again to get a sign-in link.' };
export async function mount(root, opts = {}){
  if (opts.embed){ document.body.classList.add('embed'); S.embed = true; }
  root.innerHTML = '<div id="app"></div>';
  let key = ls.get('ptw_key'); if (!key || key.length < 16){ key = freshKey(); ls.set('ptw_key', key); }
  API.key = key;
  const q = new URLSearchParams(location.search);
  if (q.get('alert') && ALERTS[q.get('alert')]){ S.toast = ALERTS[q.get('alert')]; history.replaceState(null, '', '/'); }
  S.view = 'home'; ls.set('ptw_in', '1'); S.sort = ls.get('ptw_sort') || 'new';
  render(); if (!opts.embed) renderFeedbackBox();
  try { S.me = await API.post('/api/identity', { key }); } catch {}
  S.ready = true;
  if (S.me?.email) ls.set('ptw_in', '1');
  if (S.me?.email && S.view === 'login') S.view = 'home';
  render();
  loadMine(); loadPublic();
  const ex = q.get('example'); if (ex && EXAMPLES.some(x => x.id === ex)){ ls.set('ptw_in', '1'); openProcess(ex, 'ex'); history.replaceState(null, '', '/'); }
  if (opts.open){ ls.set('ptw_in', '1'); openProcess(opts.open, 'pub').then(() => { if (opts.embed){ S.tab = 'map'; renderWork(); const l = $('#embedlink'); if (l){ l.href = location.origin + '/p/' + opts.open; l.hidden = false; } } if (q.get('guide')) startGuide(); else if (q.get('play')) setTimeout(playWalk, 400); }); }
  addEventListener('beforeunload', () => { if (dirty) flush(); if (outbox.length) navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify({ key:API.key, events:outbox })], { type:'application/json' })); });
}
