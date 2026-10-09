
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rid = p => p + Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const KINDS = ['start','task','decision','subprocess','end'];
const ss = { get(k){ try { return sessionStorage.getItem(k); } catch { return null; } }, set(k,v){ try { sessionStorage.setItem(k,v); } catch {} } };

/* ---------- Example processes (shown as examples, read-only until you change them) ---------- */
const st = (id,lane,label,kind,next=[],extra={}) => ({id,lane,label,kind,uses:[],next:next.map(n=>typeof n==='string'?{to:n}:{to:n[0],label:n[1]}),...extra});
const EX_EGG = {
  id:'ex_egg', example:true, visibility:'public', title:'Fry an egg', updatedAt:0,
  maps:{
    m_root:{ id:'m_root', title:'Fry an egg', parent:null,
      lanes:[{id:'e_cook',name:'Cook',type:'person'},{id:'e_stove',name:'Stove',type:'system'}],
      steps:[
        st('f1','e_cook','Want a fried egg','start',['f2']),
        st('f2','e_cook','Prepare the pan','subprocess',['f3'],{child:'m_f2'}),
        st('f3','e_cook','Crack the egg','subprocess',['f4'],{child:'m_f3'}),
        st('f4','e_stove','Cook until whites set','task',['f5']),
        st('f5','e_cook','Over easy?','decision',[['f6','Yes'],['f7','No']]),
        st('f6','e_cook','Flip gently','task',['f7'],{uses:[]}),
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
  id:'ex_car', example:true, visibility:'public', title:'Start a car', updatedAt:0,
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
  id:'ex_tea', example:true, visibility:'public', title:'Make a cup of tea', updatedAt:0,
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
  mine:[], pub:[], cur:null, path:['m_root'], sel:null, busy:false, ctl:null,
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
  const copy = clone(p);
  const from = p.readonly ? `“${p.title}” by ${p.publishedBy}` : 'this example';
  delete copy.example; delete copy.readonly; delete copy.publishedBy; delete copy.publicId; delete copy.mine;
  copy.id = rid('p'); copy.events = []; copy.undo = null; copy.rating = null;
  if (p.readonly){ copy.forkedFrom = p.publicId; API.post('/api/public/' + p.publicId, {}).catch(()=>{}); }
  copy.chat = (copy.chat || []).concat([{ role:'note', content:`Saved your own private copy of ${from}.` }]);
  S.cur = copy;
  track('copy_made', { from:p.publicId || p.id, example:!!p.example }, copy.id);
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
      if (s.kind === 'subprocess' && !s.child) out.push({ kind:'sub_no_child', map:m.id, step:s.id, text:`“${s.label}” has no detail yet` });
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
const ERR = {
  not_configured:'The mapper isn’t set up yet. Try again soon.',
  rate_limited:'Too many requests right now. Wait a moment, then send again.',
  upstream_error:'The mapper was interrupted. Send your message again.',
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
  if (!r.ok){ let d = {}; try { d = await r.json(); } catch {} throw { code:d.code || (r.status === 429 ? 'rate_limited' : 'upstream_error'), message:d.error }; }
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
    status:p.status || 'interviewing', forkedFrom:p.forkedFrom || null, rating:p.rating ?? null, dismissed:(p.dismissed || []).slice(-200),
    maps:p.maps, undo:keptUndo(p), chat:p.chat.filter(x=>!x.pending).slice(-40), events:(p.events||[]).slice(-300) };
}
function touch(){ if (!S.cur || readOnly(S.cur)) return; S.cur.updatedAt = Date.now(); dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900); setSave('Unsaved changes'); }
async function flush(){
  if (savePromise){ await savePromise; if (!dirty) return; }
  const p = S.cur; if (!p || readOnly(p) || !dirty) return;
  dirty = false; clearTimeout(saveTimer);
  savePromise = (async () => {
    setSave('Saving…');
    try {
      await API.put('/api/processes/' + p.id, { doc:serialize(p) });
      setSave('Saved');
      const row = { id:p.id, title:p.title, status:p.status, ...stats(p), stepCount:stats(p).steps, laneTypes:stats(p).lanes.map(l => l.type), updatedAt:p.updatedAt, publicId:p.publicId || null };
      S.mine = [row, ...S.mine.filter(x => x.id !== p.id)];
    } catch (e){ dirty = true; setSave(e?.status === 413 ? 'Too large to save' : 'Not saved — will retry'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 5000); }
  })();
  try { await savePromise; } finally { savePromise = null; }
}
async function deleteProcess(id){
  S.confirmDel = null;
  if (S.cur?.id === id){ clearTimeout(saveTimer); dirty = false; }
  S.mine = S.mine.filter(x => x.id !== id);
  S.pub = S.pub.filter(x => x.processId !== id && x.id !== S.cur?.publicId);
  if (S.cur?.id === id){ S.cur = null; S.view = 'home'; }
  render();
  try { await API.del('/api/processes/' + id); } catch { S.notice = 'Could not delete that process. Try again.'; render(); }
}
async function publish(){
  const p = S.cur; if (!p || readOnly(p) || S.busy) return;
  S.confirmPub = false; dirty = true;
  try {
    await flush();
    const d = await API.post('/api/processes/' + p.id + '/publish', {});
    const first = !p.publicId;
    p.publicId = d.publicId;
    logEvent(p, { who:'human', op:first ? 'publish' : 'publish_update' });
    p.chat.push({ role:'note', content:first ? `Published as ${S.me?.handle}. Anyone can open a read-only copy; changes they make stay private to them.` : 'Updated the published version.' });
    touch(); loadPublic();
  } catch (e){ p.chat.push({ role:'note', content:'Could not publish: ' + (e?.message || 'try again.') }); }
  renderWork();
}
async function unpublish(){
  const p = S.cur; if (!p?.publicId) return;
  try {
    await API.del('/api/processes/' + p.id + '/publish');
    p.publicId = null; logEvent(p, { who:'human', op:'unpublish' });
    p.chat.push({ role:'note', content:'Removed from public processes.' }); touch(); loadPublic();
  } catch {}
  renderWork();
}
async function loadMine(){ try { S.mine = (await API.get('/api/processes')).processes; } catch {} if (S.view === 'home') render(); }
async function loadPublic(){ try { S.pub = (await API.get('/api/public')).processes; } catch {} if (S.view === 'home') render(); }

/* ---------- Layout ---------- */
const L = { HEAD:150, COL:196, BOXW:158, BOXH:60, ROWGAP:16, PADX:28, PADY:16, BAND:22 };
function layout(m){
  const ids = new Set(m.steps.map(s => s.id));
  const preds = {}; m.steps.forEach(s => preds[s.id] = []);
  m.steps.forEach(s => s.next.forEach(n => { if (isInternal(n, m) && ids.has(n.to)) preds[n.to].push(s.id); }));
  const col = {}, visiting = new Set();
  const depth = id => {
    if (id in col) return col[id]; if (visiting.has(id)) return -1;
    visiting.add(id); let d = 0;
    for (const p of preds[id]){ const pd = depth(p); if (pd >= 0) d = Math.max(d, pd + 1); }
    visiting.delete(id); col[id] = d; return d;
  };
  m.steps.forEach(s => depth(s.id));
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
  const panel = !S.acct ? '' : me.email ? `
    <div class="acct-panel" role="dialog" aria-label="Account">
      <p>Signed in as <b>${esc(me.email)}</b>. You map as <b>${esc(me.handle)}</b>.</p>
      ${me.isAdmin ? '<a class="btn sm" href="/admin">Admin dashboard</a>' : ''}
      <button class="btn sm" data-acct="signout">Sign out on this device</button>
    </div>` : `
    <div class="acct-panel" role="dialog" aria-label="Account">
      <p>You're mapping as <b>${esc(me.handle)}</b>. Add your email to keep your processes on any device, or to sign in.</p>
      ${emailFormHTML('acct')}
    </div>`;
  return `${me.isAdmin ? '<a class="btn sm admin-link" href="/admin">Admin dashboard</a>' : ''}<div class="acct"><button class="btn ghost acct-btn" data-acct="toggle" aria-expanded="${S.acct}">${esc(me.email ? me.email.split('@')[0] : me.handle)} ▾</button>${panel}</div>`;
}
function wireAcct(root){
  root.querySelectorAll('[data-acct]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (b.dataset.acct === 'toggle'){ S.acct = !S.acct; render(); return; }
    if (b.dataset.acct === 'signout'){ ls.del('ptw_key'); location.href = '/'; }
  });
  wireEmailForm(root);
}
/* One box for signing up and signing in: email, plus an optional username */
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
      msg.textContent = `Check ${email} for a link. It may land in spam.`; track('email_link_requested');
      f.elements.email.value = ''; f.elements.handle.value = '';
    } catch (err){ msg.textContent = err.message; }
    btn.disabled = false;
  });
}
document.addEventListener('click', e => { if (S.acct && !e.target.closest('.acct')){ S.acct = false; render(); } });

function renderLogin(app){
  app.innerHTML = `
  <div class="top"><div class="mark"><i>PW</i>Process the World</div></div>
  <div class="login"><div class="login-card">
    <h1>Explain how work gets done. Watch it become a map.</h1>
    <p>Describe a process in your own words. Each message updates a swim-lane map of the people, steps and technology involved, and any step can open into its own layer of detail.</p>
    <div class="lanes-demo">
      <div class="p">PERSON <span>Cook · Cracks the egg into the pan</span></div>
      <div class="p">PERSON <span>Driver · Presses the brake and Start</span></div>
      <div class="s">SYSTEM <span>Kettle · Boils the water and clicks off</span></div>
    </div>
    <div class="login-box">${emailFormHTML('li')}</div>
    <button class="linkish" id="go">Or start mapping without an email</button>
  </div></div>`;
  $('#go').onclick = () => { ls.set('ptw_in','1'); S.view = 'home'; render(); };
  wireEmailForm(app);
}

function cardHTML(p, kind){
  const st = p.stepCount != null ? { steps:p.stepCount, depth:p.depth } : stats(p);
  const types = p.laneTypes || (p.maps?.m_root?.lanes || []).map(l => l.type);
  const when = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
  const del = kind === 'mine' ? (S.confirmDel === p.id
    ? `<div class="card-del"><span>Delete “${esc(p.title || 'Untitled process')}”? This can't be undone${p.publicId ? ', and the public copy goes too' : ''}.</span><span class="prop-acts"><button class="btn danger sm" data-del-yes="${esc(p.id)}">Delete</button><button class="btn sm" data-del-no>Cancel</button></span></div>`
    : `<button class="card-x" data-del="${esc(p.id)}" aria-label="Delete ${esc(p.title || 'process')}" title="Delete">Delete</button>`) : '';
  const badge = kind === 'mine' ? (p.publicId ? '<span class="pill pub">Public</span>' : '<span class="pill">Private</span>')
    : p.example ? '<span class="pill ex">Example</span>' : '<span class="pill pub">Public</span>';
  const by = kind === 'pub' ? `<span class="by">Published by ${esc(p.processId && S.mine.some(m => m.id === p.processId) ? 'you' : p.authorName)}</span>` : p.example ? '<span class="by">By Process the World</span>' : '';
  return `<div class="card-wrap">${del}<button class="card" data-open="${esc(p.id)}" data-kind="${kind}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      ${badge}
      <span class="mono" style="color:var(--muted);${kind === 'mine' ? 'margin-right:58px' : ''}">${esc(when)}</span>
    </div>
    <h3>${esc(p.title || 'Untitled process')}</h3>
    ${by}
    <div class="spark">${types.slice(0,8).map(t => `<b class="${t==='system'?'s':''}"></b>`).join('') || '<b style="background:var(--line)"></b>'}</div>
    <div class="meta"><span>${st.steps} steps</span><span>${st.depth} ${st.depth === 1 ? 'layer' : 'layers'}</span><span>${types.filter(t=>t!=='system').length} people · ${types.filter(t=>t==='system').length} tech</span></div>
  </button></div>`;
}

function renderHome(app){
  app.innerHTML = `
  <div class="top"><div class="mark"><i>PW</i>Process the World</div><div class="grow"></div>
    ${S.notice ? `<span class="save" style="color:var(--danger)">${esc(S.notice)}</span>` : ''}
    <button class="btn primary" id="new">New process</button>${acctHTML()}</div>
  <div class="home"><div class="home-in">
    <div class="home-head"><div><div class="label">Library</div><h1>${S.me ? 'Hi, ' + esc(S.me.handle) : 'Your processes'}</h1></div></div>
    <section class="sec">
      <div class="sec-head"><h2>My processes</h2><p>Private to you unless you publish them.</p></div>
      ${S.mine.length ? `<div class="cards">${S.mine.map(p => cardHTML(p,'mine')).join('')}</div>` :
        `<div class="empty"><b style="color:var(--ink)">No processes yet</b><span>Start one and describe it in your own words, or open a public one below and make it your own.</span><button class="btn" id="new2">New process</button></div>`}
    </section>
    <section class="sec">
      <div class="sec-head"><h2>Public processes</h2><p>Open any of these to explore. Changing one makes your own private copy.</p></div>
      <div class="cards">${S.pub.map(p => cardHTML(p,'pub')).join('')}${EXAMPLES.map(p => cardHTML(p,'ex')).join('')}</div>
    </section>
  </div></div>`;
  const start = () => { S.cur = newProcess(); S.path = ['m_root']; S.sel = null; S.view = 'work'; S.tab = 'chat'; track('process_started', {}, S.cur.id); render(); };
  $('#new').onclick = start; const n2 = $('#new2'); if (n2) n2.onclick = start;
  wireAcct(app);
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { S.confirmDel = b.dataset.del; render(); });
  app.querySelectorAll('[data-del-no]').forEach(b => b.onclick = () => { S.confirmDel = null; render(); });
  app.querySelectorAll('[data-del-yes]').forEach(b => b.onclick = () => deleteProcess(b.dataset.delYes));
  app.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProcess(b.dataset.open, b.dataset.kind));
}
async function openProcess(id, kind){
  let p = null;
  try {
    if (kind === 'ex') p = clone(EXAMPLES.find(x => x.id === id));
    else if (kind === 'pub'){
      const d = await API.get('/api/public/' + id);
      if (S.mine.some(m => m.id === d.processId)) return openProcess(d.processId, 'mine');
      p = { ...d.doc, id:'pub_' + id, readonly:true, publishedBy:d.authorName, publicId:id };
      track('public_opened', { publicId:id }, null);
    } else {
      const d = await API.get('/api/processes/' + id);
      p = { ...d.doc, publicId:d.publicId || null };
    }
  } catch { S.notice = 'Could not open that process. Try again.'; render(); return; }
  if (!p) return;
  p.chat = p.chat || []; p.events = p.events || [];
  S.cur = p; S.path = ['m_root']; S.sel = null; S.view = 'work'; S.checksOpen = false; S.confirmPub = false; S.confirmDel = null;
  S.tab = p.maps.m_root.steps.length ? 'map' : 'chat'; render();
}

const STARTERS = [
  'How I make pancakes from scratch.',
  'How to change a flat bike tire.',
  'Doing laundry. It has three parts: sort, wash, and dry and fold.'
];

function renderWorkShell(app){
  app.innerHTML = `
  <div class="top">
    <button class="btn ghost" id="back" aria-label="Back to library">← Library</button>
    <div class="grow"><input class="title-in" id="title" aria-label="Process name"></div>
    <span id="vis"></span>
    <span class="save" id="save"></span>
    <span id="wpub"></span>
    <span id="wdel"></span>
    <span id="wacct"></span>
  </div>
  <div class="tabs" id="tabs"><button data-tab="chat">Conversation</button><button data-tab="map">Map</button></div>
  <div class="work" id="work">
    <aside class="chat">
      <div class="msgs" id="msgs"></div>
      <div class="composer">
        <textarea id="msg" placeholder="Describe the process in your own words… (tip: use your keyboard's dictation to talk instead of type)" aria-label="Describe the process"></textarea>
        <div class="composer-row">
          <label class="toggle"><input type="checkbox" id="deep"> Deeper thinking (slower)</label>
          <div style="display:flex;gap:8px"><button class="btn" id="finish">Finish map</button><button class="btn" id="stop" hidden>Stop</button><button class="btn primary" id="sendb">Send</button></div>
        </div>
      </div>
    </aside>
    <section class="canvas-wrap">
      <div class="crumbs" id="crumbs"></div>
      <div class="scroller" id="scroller"><div class="board" id="board"></div></div>
      <div id="inspector"></div>
      <div id="checks"></div>
    </section>
  </div>`;
  $('#back').onclick = () => { flush(); S.view = 'home'; S.cur = null; S.confirmDel = null; render(); };
  $('#wpub').onclick = e => { const b = e.target.closest('[data-wpub]'); if (!b) return;
    const a = b.dataset.wpub;
    if (a === 'ask'){ S.confirmPub = true; renderWork(); }
    else if (a === 'no'){ S.confirmPub = false; renderWork(); }
    else if (a === 'yes' || a === 'update') publish();
    else if (a === 'unpublish') unpublish(); };
  $('#wdel').onclick = e => { const b = e.target.closest('[data-wdel]'); if (!b) return;
    if (b.dataset.wdel === 'ask'){ S.confirmDel = S.cur.id; renderWork(); }
    else if (b.dataset.wdel === 'no'){ S.confirmDel = null; renderWork(); }
    else deleteProcess(S.cur.id); };
  $('#title').onchange = e => { ensureOwned(); const v = e.target.value.trim() || 'Untitled process'; logEvent(S.cur,{who:'human',op:'rename_process',before:S.cur.title,after:v}); S.cur.title = v; S.cur.maps.m_root.title = v; touch(); renderWork(); };
  const msg = $('#msg');
  msg.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(msg.value); } };
  $('#sendb').onclick = () => send(msg.value);
  $('#stop').onclick = () => S.ctl?.abort();
  $('#finish').onclick = () => S.cur?.status === 'done' ? resume() : finish();
  $('#deep').checked = S.deep; $('#deep').onchange = e => S.deep = e.target.checked;
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

function renderWork(fromStream){
  if (S.view !== 'work' || !S.cur) return;
  const p = S.cur;
  // validate path
  S.path = S.path.filter(id => p.maps[id]); if (!S.path.length) S.path = ['m_root'];
  const t = $('#title'); if (document.activeElement !== t) t.value = p.title;
  $('#vis').innerHTML = p.example ? '<span class="pill ex">Example</span>' : p.readonly ? `<span class="pill pub">Public</span> <span class="by">Published by ${esc(p.publishedBy)}</span>` : p.publicId ? '<span class="pill pub">Public</span>' : '<span class="pill">Private</span>';
  $('#save').textContent = readOnly(p) ? 'Changes make a private copy' : S.save;
  $('#wpub').innerHTML = readOnly(p) ? '' : S.confirmPub
    ? `<span class="hint">Publish a read-only copy as ${esc(S.me?.handle || 'you')}? Your conversation stays private.</span> <button class="btn primary sm" data-wpub="yes">Publish</button> <button class="btn sm" data-wpub="no">Cancel</button>`
    : p.publicId ? `<button class="btn sm" data-wpub="update" title="Replace the public copy with this version">Update public copy</button> <button class="btn ghost sm" data-wpub="unpublish">Unpublish</button>`
    : p.maps.m_root.steps.length ? `<button class="btn sm" data-wpub="ask">Make public</button>` : '';
  const wa = $('#wacct'); wa.innerHTML = acctHTML(); wireAcct(wa);
  $('#wdel').innerHTML = readOnly(p) ? '' : S.confirmDel === p.id
    ? `<span class="hint">Delete this process?</span> <button class="btn danger sm" data-wdel="yes">Delete</button> <button class="btn sm" data-wdel="no">Cancel</button>`
    : `<button class="btn ghost danger sm" data-wdel="ask">Delete</button>`;
  $('#work').dataset.tab = S.tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#stop').hidden = !S.busy; $('#sendb').disabled = S.busy;
  const fb = $('#finish'); fb.textContent = p.status === 'done' ? 'Resume interview' : 'Finish map'; fb.disabled = S.busy;
  if (S.checksOpen && !findIssues(p).length) S.checksOpen = false;
  renderMsgs(); renderCrumbs(); renderBoard(); renderInspector(); renderChecks();
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

function renderBoard(){
  const m = curMap(), b = $('#board');
  if (!m.steps.length && !m.lanes.length){
    b.style.width = '100%'; b.style.height = '100%';
    b.innerHTML = `<div class="board-empty"><div><div class="label">${S.path.length > 1 ? 'Layer ' + S.path.length : 'Empty map'}</div><h3>${S.path.length > 1 ? 'Describe how “' + esc(m.title) + '” works' : 'Your map appears here'}</h3><span>People get their own lanes, technology gets its own lanes, and steps flow left to right. Say “this step has two parts” and it becomes a layer you can open.</span></div></div>`;
    return;
  }
  const g = layout(m);
  b.style.width = g.width + 'px'; b.style.height = g.height + 'px';
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
    paths += `<path d="${d}" marker-end="url(#arr)"/>`;
    if (n.label) labels += `<div class="elabel" style="left:${lx}px;top:${ly}px">${esc(n.label)}</div>`;
  }));
  html += `<svg class="edges" width="${g.width}" height="${g.height}" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--edge);stroke:none"/></marker></defs>${paths}</svg>`;
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
    html += `<div class="step ${s.kind}${S.sel === s.id ? ' sel' : ''}${S.fresh.has(s.id) ? ' fresh' : ''}${s.proposedRemove ? ' proposed' : ''}" data-step="${esc(s.id)}" role="button" tabindex="0" style="left:${q.x}px;top:${q.y}px">
      ${issueAt[s.id] ? `<span class="warn-dot" title="${esc(issueAt[s.id].join('\n'))}" aria-label="${esc(issueAt[s.id].join('. '))}">!</span>` : ''}
      ${s.proposedRemove ? '<span class="k rm">Remove?</span>' : ''}
      ${s.kind === 'decision' ? '<span class="k">◇ decision</span>' : s.kind === 'subprocess' ? '<span class="k">▤ subprocess</span>' : ''}
      <span>${esc(s.label)}</span>
      ${s.uses?.length ? `<span class="uses">${s.uses.filter(u => laneName[u]).map(u => `<span>${esc(laneName[u])}</span>`).join('')}</span>` : ''}
      ${s.kind === 'subprocess' ? `<button class="open" data-drill="${esc(s.id)}">${s.child ? 'Open · ' + kids + ' steps' : 'Open · empty'} ↘</button>` : ''}
      ${back}${outs || ins ? `<span class="xlinks">${outs}${ins}</span>` : ''}
    </div>`;
  });
  b.innerHTML = html;
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
  const d = e.target.closest('[data-drill]'); if (d){ e.stopPropagation(); drill(d.dataset.drill); return; }
  const j = e.target.closest('[data-jump]'); if (j){ e.stopPropagation(); jumpTo(j.dataset.jump, j.dataset.step); return; }
  const st = e.target.closest('[data-step]');
  S.sel = st ? st.dataset.step : null; if (S.sel) S.checksOpen = false; renderBoard(); renderInspector(); renderChecks();
}
document.addEventListener('keydown', e => {
  const st = e.target.closest?.('[data-step]');
  if (st && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); S.sel = st.dataset.step; renderBoard(); renderInspector(); }
  if (e.key === 'Escape' && S.sel){ S.sel = null; renderBoard(); renderInspector(); }
});

const CORRECTIONS = [
  ['missing_after','Missing step after this', s => `There's a missing step after “${s.label}”: `],
  ['wrong_order','Wrong order', s => `“${s.label}” is in the wrong place. It should happen `],
  ['wrong_owner','Wrong person or system', s => `“${s.label}” is actually done by `],
  ['too_vague','Too vague', s => `“${s.label}” is too vague. What really happens is `],
  ['has_parts','This has parts', s => `“${s.label}” is really made of these subprocesses: `],
];
function renderInspector(){
  const box = $('#inspector'); const m = curMap(); const s = m.steps.find(x => x.id === S.sel);
  if (!s){ box.innerHTML = ''; return; }
  box.innerHTML = `<div class="inspector" role="dialog" aria-label="Step details">
    <div class="ins-head"><span class="label">Step · <span class="mono">${esc(s.id)}</span></span><button class="btn ghost" id="ix" aria-label="Close">✕</button></div>
    <div class="row"><label class="label" for="i-label">Name</label><input id="i-label" value="${esc(s.label)}"></div>
    <div class="row"><label class="label" for="i-lane">Lane</label><select id="i-lane">${m.lanes.map(l => `<option value="${esc(l.id)}" ${l.id === s.lane ? 'selected' : ''}>${esc(l.name)} (${l.type === 'system' ? 'technology' : 'person'})</option>`).join('')}${m.lanes.some(l=>l.id===s.lane)?'':'<option selected>Unassigned</option>'}</select></div>
    <div class="row"><label class="label" for="i-kind">Type</label><select id="i-kind">${KINDS.map(k => `<option ${k === s.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    <div class="acts"><button class="btn primary" id="i-drill">${s.child ? 'Open subprocess ↘' : 'Break into a subprocess'}</button><button class="btn danger" id="i-del">Delete step</button></div>
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
  $('#i-drill').onclick = () => drill(s.id);
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
const ALERTS = { saved:'Email confirmed. Your processes now follow you to any device.', 'signed-in':'Signed in. Your processes are here.', 'link-invalid':'That link expired or was already used. Request a new one from the account menu.', 'email-taken':'That email is already in use. Enter it again to get a sign-in link.' };
export async function mount(root){
  root.innerHTML = '<div id="app"></div>';
  let key = ls.get('ptw_key'); if (!key || key.length < 16){ key = freshKey(); ls.set('ptw_key', key); }
  API.key = key;
  const q = new URLSearchParams(location.search);
  if (q.get('alert') && ALERTS[q.get('alert')]){ S.toast = ALERTS[q.get('alert')]; history.replaceState(null, '', '/'); }
  S.view = ls.get('ptw_in') ? 'home' : 'login';
  render(); renderFeedbackBox();
  try { S.me = await API.post('/api/identity', { key }); } catch {}
  S.ready = true;
  if (S.me?.email) ls.set('ptw_in', '1');
  if (S.me?.email && S.view === 'login') S.view = 'home';
  render();
  loadMine(); loadPublic();
  addEventListener('beforeunload', () => { if (dirty) flush(); if (outbox.length) navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify({ key:API.key, events:outbox })], { type:'application/json' })); });
}
