// Admin dashboard: usage, creating and publishing, what to improve, and every piece of feedback.
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = () => { try { return localStorage.getItem('ptw_key') || ''; } catch { return ''; } };
async function api(path, opts = {}){
  const r = await fetch(path, { ...opts, headers:{ 'content-type':'application/json', 'x-ptw-key':key(), ...(opts.headers || {}) } });
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) throw { status:r.status, message:d?.error || 'Request failed.' };
  return d;
}
const money = n => '$' + (n < 1 ? (n || 0).toFixed(4) : n.toFixed(2));
const when = d => new Date(d).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
const day = d => new Date(d).toLocaleDateString(undefined, { month:'short', day:'numeric' });
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';
const nice = s => String(s || '').replace(/_/g, ' ');

const A = { tab:'usage', days:90, fbStatus:'all', fbKind:'all', fbQ:'', memberKind:'all', session:null, busy:false };
const TAB_NAMES = { usage:'Usage', improve:'What to improve', feedback:'Feedback' };

function bars(rows, label, val){
  const max = Math.max(1, ...rows.map(val));
  return rows.length ? `<ul class="bars">${rows.map(r => `<li><span class="bl">${esc(label(r))}</span><span class="bt"><b style="width:${(100 * val(r) / max).toFixed(1)}%"></b></span><span class="bv">${val(r)}</span></li>`).join('')}</ul>` : '<p class="hint">No data yet.</p>';
}
function chart(rows, title, color = 'var(--accent)'){
  if (!rows.length) return '<p class="hint">No data yet.</p>';
  const max = Math.max(1, ...rows.map(r => r.n)), w = 640, h = 110, bw = Math.max(4, Math.floor(w / rows.length) - 3);
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h + 20}" role="img" aria-label="${esc(title)}">
    <line x1="0" y1="${h}" x2="${w}" y2="${h}" style="stroke:var(--line)"/>
    ${rows.map((r, i) => { const bh = Math.max(2, h * r.n / max), x = i * (bw + 3); return `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="2" style="fill:${color}"><title>${day(r.day)}: ${r.n}</title></rect>`; }).join('')}
    <text x="0" y="${h + 16}" style="fill:var(--muted);font-size:11px">${day(rows[0].day)}</text>
    <text x="${w}" y="${h + 16}" text-anchor="end" style="fill:var(--muted);font-size:11px">${day(rows[rows.length - 1].day)} · peak ${max}</text>
  </svg></div>`;
}
const kpi = (label, value, small = '') => `<div><span class="label">${label}</span><b>${value}</b><small>${small}</small></div>`;

/* ---------- Usage: who comes, who joins, who is running low ---------- */
async function usage(el){
  const [d, mem, low] = await Promise.all([
    api('/api/admin/usage?days=' + A.days),
    api('/api/admin/members' + (A.memberKind === 'all' ? '' : '?kind=' + A.memberKind)),
    api('/api/admin/members?low=1'),
  ]);
  const m = d.members;
  const table = rows => rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Who</th><th>Kind</th><th>Credits</th><th>Processes</th><th>Published</th><th>Joined</th><th>Last seen</th></tr></thead><tbody>${rows.map(u => `<tr><td>${esc(u.email || u.handle)}${u.email ? ` <span class="hint">${esc(u.handle)}</span>` : ''}</td><td>${u.kind === 'email' ? 'Email' : 'Guest'}</td><td>${u.credits}</td><td>${u.processes}</td><td>${u.published}</td><td>${day(u.joined)}</td><td>${when(u.lastSeen)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Nobody here.</p>';
  el.innerHTML = `
  <div class="kpis">
    ${kpi('Members', m.total, `${m.email} with email · ${m.guests} guests`)}
    ${kpi('Joined', m.newTotal, `last ${d.days} days · ${m.newEmail} added an email`)}
    ${kpi('Active', d.active, `last ${d.days} days · ${d.returning} came back`)}
    ${kpi('Low on credits', low.members.length, '20 or fewer left')}
    ${kpi('AI agent calls', d.agent.calls, `${d.agent.sources} sources`)}
  </div>
  <div class="grid2">
    <section class="panel"><h3>People active each day</h3>${chart(d.dailyActive, 'Active people per day')}</section>
    <section class="panel"><h3>New members each day</h3>${chart(d.dailyNew, 'New members per day', 'var(--system)')}</section>
    <section class="panel"><h3>What people do</h3>${bars(d.events, r => nice(r.type), r => r.count)}</section>
    <section class="panel"><h3>AI agents (Claude, ChatGPT, API)</h3><p class="hint">Calls from outside the website. They never use credits.</p>${chart(d.dailyAgent, 'Agent calls per day', 'var(--person)')}</section>
  </div>
  <section class="panel"><h3>Who the guests are</h3>
    <p class="hint">A guest account is created automatically the first time a browser opens the site, and when an AI agent saves a process without a key. Nobody signs up.</p>
    <ul class="ops"><li><b>${d.guestKinds.used}</b> used the app (made actions or talked to the mapper)</li><li><b>${d.guestKinds.api}</b> only made a process through the API or an AI agent</li><li><b>${d.guestKinds.visitors}</b> did nothing: people who only looked, search engine and link preview bots, and tests</li></ul></section>
  <section class="panel"><h3>Who is low on credits</h3><p class="hint">Everyone starts with 100. At 0 the mapper pauses until you add more.</p>${table(low.members)}</section>
  <section class="panel"><h3>Members</h3>
    <div class="seg">${[['all', 'Everyone'], ['email', 'Email members'], ['guest', 'Guests']].map(([k, n]) => `<button class="btn sm${A.memberKind === k ? ' primary' : ''}" data-mkind="${k}">${n}</button>`).join('')}</div>
    ${table(mem.members)}</section>
  <p class="hint">For page views and where visitors come from, open Analytics in the Vercel project.</p>`;
}

async function session(el, id){
  const d = await api('/api/admin/sessions/' + id);
  const qByTurn = Object.fromEntries(d.questions.map(q => [q.askedTurnId, q]));
  const cost = d.calls.reduce((a, c) => a + c.costUsd, 0);
  const maps = Object.values(d.process.doc?.maps || {});
  el.innerHTML = `<button class="btn ghost sm" data-back>← Back</button>
  <h2>${esc(d.process.title)}</h2>
  <p class="hint">${esc(d.process.who)} · ${d.turns.length} turns · ${d.calls.length} AI calls · ${money(cost)} · ${maps.length} layers</p>
  <div class="grid2 wide">
    <section class="panel"><h3>Conversation and what the engine did</h3>
      ${d.turns.map(t => { const q = qByTurn[t.id]; return `<div class="turn">
        <p class="u">${esc(t.userText)}</p>
        <p class="tags">${t.feedbackType ? `<span class="pill${t.feedbackType === 'correction' ? ' warn' : ''}">${esc(t.feedbackType)}${t.feedbackCategory && t.feedbackType === 'correction' ? ' · ' + esc(t.feedbackCategory) : ''}</span>` : ''}
          <span class="hint">${t.opsApplied} changes${t.removalsProposed ? ' · ' + t.removalsProposed + ' removals proposed' : ''}${t.checksFound ? ` · checks found ${t.checksFound}, repaired ${t.checksRepaired}` : ''}${t.outcome ? ' · ' + esc(t.outcome) : ''}</span></p>
        <p class="a">${esc(t.replySay || '')}${t.replyAsk ? `<br><b>${esc(t.replyAsk)}</b>${q?.outcome ? ` <span class="hint">(${esc(q.outcome)}${q.infoGain != null ? ', +' + q.infoGain : ''})</span>` : ''}` : ''}</p>
        <details><summary>${t.ops.length} AI changes</summary><ul class="ops">${t.ops.map(o => `<li><code>${esc(o.pass)} ${esc(o.op)}</code> ${esc(o.result)}${o.humanVerdict ? ' → ' + esc(o.humanVerdict) : ''} <span class="hint">${esc(JSON.stringify(o.payload)).slice(0, 220)}</span></li>`).join('')}</ul></details>
      </div>`; }).join('') || '<p class="hint">No turns recorded. This one was built by an AI agent or imported.</p>'}
    </section>
    <div class="col">
      <section class="panel"><h3>Final map</h3>${maps.map(m => `<p><b>${esc(m.title)}</b> <span class="hint">${m.lanes.length} lanes · ${m.steps.length} steps</span><br><span class="hint">${esc(m.steps.map(s => s.label).join(' → '))}</span></p>`).join('')}</section>
      <section class="panel"><h3>Feedback</h3>${d.feedback.map(f => `<p><span class="pill">${esc(f.kind)}</span> ${f.rating ?? ''} ${esc(f.reasons.join(', '))} ${esc(f.text || '')}</p>`).join('') || '<p class="hint">None.</p>'}</section>
      <section class="panel"><h3>Actions</h3><ul class="ops">${d.events.map(e => `<li><span class="hint">${when(e.createdAt)}</span> <code>${esc(e.who)}</code> ${esc(nice(e.type))} <span class="hint">${esc(e.data ? JSON.stringify(e.data) : '').slice(0, 140)}</span></li>`).join('') || '<li class="hint">None.</li>'}</ul></section>
    </div>
  </div>`;
}

/* ---------- What to improve: plain text about the process builder ---------- */
async function improve(el){
  const d = await api('/api/admin/improve?days=' + A.days);
  const list = (rows, fn) => rows.length ? '<ul class="plain">' + rows.map(r => '<li>' + fn(r) + '</li>').join('') + '</ul>' : '<p class="hint">Nothing yet.</p>';
  const open = d.suggestions.filter(x => x.status === 'open' || x.status === 'planned'), closed = d.suggestions.filter(x => x.status === 'done' || x.status === 'dismissed');
  const sug = x => `<article class="plain-item"><p><b>${esc(x.title)}</b> <span class="hint">${esc(x.status)}</span></p><p>${esc(x.body)}</p>${x.evidence?.note ? `<p class="hint">${esc(x.evidence.note)}</p>` : ''}<p>${['planned', 'done', 'dismissed', 'open'].filter(k => k !== x.status).map(k => `<button class="btn sm" data-sug="${k}" data-id="${x.id}">${{ planned:'Plan it', done:'Mark done', dismissed:'Dismiss', open:'Reopen' }[k]}</button>`).join(' ')}</p></article>`;
  el.innerHTML = `
  <h2>Feedback people filled out</h2>
  <p class="hint">${d.forms.length} so far, newest first.</p>
  ${list(d.forms, f => `<b>${esc(f.who)}</b> <span class="hint">${day(f.created)}</span>${f.reasons.length ? ' <span class="hint">(' + esc(f.reasons.join(', ')) + ')</span>' : ''}<br>${esc(f.text || '')}${f.processId ? ` <button class="linkish" data-open="${esc(f.processId)}">Open the process</button>` : ''}`)}
  <h2>Where the builder got it wrong</h2>
  <p class="hint">${d.turns} messages in the last ${d.days} days. These are the ones where people corrected it or got confused.</p>
  ${d.wrong.length ? '<p>' + d.wrong.map(w => esc(nice(w.category)) + ' (' + w.count + ')').join(', ') + '</p>' : ''}
  ${list(d.corrections, c => `“${esc(String(c.text).slice(0, 220))}” <span class="hint">${esc(nice(c.category || c.type))}</span>`)}
  <h2>Questions people skipped</h2>
  ${list(d.skipped, q => esc(q))}
  <h2>Suggested changes</h2>
  <p class="hint">Only when 3 or more different people hit the same problem.</p>
  <p><button class="btn primary sm" data-gen ${A.busy ? 'disabled' : ''}>${A.busy ? 'Reading…' : 'Look for problems that 3 or more people ran into'}</button></p>
  ${open.map(sug).join('') || '<p class="hint">None.</p>'}
  ${closed.length ? `<details><summary>${closed.length} done or dismissed</summary>${closed.map(sug).join('')}</details>` : ''}`;
}
/* ---------- Feedback: everything ---------- */
const KINDS = { button:'Feedback box', reply:'Reply rating', finish:'Finish rating', checkin:'Check-in' };
async function feedback(el){
  const d = await api('/api/admin/feedback?status=all');
  const intr = await api('/api/admin/interest').catch(() => ({ interest:[] }));
  const needle = A.fbQ.trim().toLowerCase();
  const rows = d.feedback.filter(f => (A.fbStatus === 'all' || f.status === A.fbStatus) && (A.fbKind === 'all' || f.kind === A.fbKind) && (!needle || ((f.text || '') + ' ' + f.reasons.join(' ') + ' ' + f.who + ' ' + (f.process || '')).toLowerCase().includes(needle)));
  const count = s => d.feedback.filter(f => f.status === s).length;
  el.innerHTML = `<section class="panel"><div class="seg">
      ${[['all', 'All ' + d.feedback.length], ['new', 'New ' + count('new')], ['reviewed', 'Reviewed ' + count('reviewed')], ['done', 'Done ' + count('done')]].map(([k, n]) => `<button class="btn sm${A.fbStatus === k ? ' primary' : ''}" data-fbs="${k}">${n}</button>`).join('')}
      <select id="fbkind" aria-label="Kind"><option value="all">All kinds</option>${Object.entries(KINDS).map(([k, n]) => `<option value="${k}" ${A.fbKind === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <input id="fbq" type="search" placeholder="Search feedback" value="${esc(A.fbQ)}" aria-label="Search feedback">
      <button class="btn sm" data-csv>Download CSV</button></div>
    <p class="hint">${rows.length} shown</p></section>
  ${rows.map(f => `<article class="panel fb">
    <header><span class="pill">${esc(KINDS[f.kind] || f.kind)}</span>
      ${f.rating != null ? `<b>${f.kind === 'reply' ? (f.rating > 0 ? '👍' : '👎') : f.rating + '/5'}</b>` : ''}
      ${f.reasons.map(r => `<span class="chip">${esc(r)}</span>`).join('')}
      <span class="hint">${esc(f.who)} · ${when(f.created)}${f.process ? ' · ' + esc(f.process) : ''} · ${esc(f.status)}</span></header>
    ${f.text ? `<p class="fbtext">${esc(f.text)}</p>` : ''}
    ${f.context ? `<details><summary>What was on screen</summary><pre>${esc(JSON.stringify(f.context, null, 2))}</pre></details>` : ''}
    <footer>${f.processId ? `<button class="btn sm" data-open="${esc(f.processId)}">Open the process</button>` : ''}${f.status !== 'reviewed' ? `<button class="btn sm" data-fbset="reviewed" data-id="${f.id}">Mark reviewed</button>` : ''}${f.status !== 'done' ? `<button class="btn sm" data-fbset="done" data-id="${f.id}">Done</button>` : ''}</footer>
  </article>`).join('') || '<p class="hint">Nothing here.</p>'}
  ${intr.interest.length ? `<section class="panel"><h3>Early access requests</h3><ul class="ops">${intr.interest.map(x => `<li>${esc(x.email)} <span class="hint">${esc(x.kind)} · ${day(x.createdAt)}${x.note ? ' · ' + esc(x.note) : ''}</span></li>`).join('')}</ul></section>` : ''}`;
  A.fbRows = rows;
}

const TABS = { usage, improve, feedback };
async function draw(){
  const root = $('#adm');
  const periodTabs = ['usage', 'improve'];
  root.innerHTML = `<div class="top"><div class="mark"><i>f</i><span class="wm"><b>forks</b><em>.world</em></span></div><span class="pill">Admin</span><div class="grow"></div><a class="btn ghost sm" href="/">Back to the app</a></div>
  <div class="home"><div class="home-in">
    <nav class="seg">${Object.keys(TABS).map(t => `<button class="btn sm${A.tab === t ? ' primary' : ''}" data-tab="${t}">${TAB_NAMES[t]}</button>`).join('')}
      ${periodTabs.includes(A.tab) && !A.session ? `<select id="days" aria-label="Period">${[7, 30, 90, 365].map(n => `<option value="${n}" ${A.days === n ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select>` : ''}</nav>
    <div id="body"><p class="hint">Loading…</p></div>
  </div></div>`;
  const body = $('#body');
  try { await (A.session ? session(body, A.session) : TABS[A.tab](body)); }
  catch (e){ body.innerHTML = e.status === 403 ? `<section class="panel"><h3>Admins only</h3><p>Open <a href="/">the app</a>, choose your name in the top right, and sign in with your admin email. Then come back here.</p></section>` : `<p class="hint">${esc(e.message || 'Something went wrong.')}</p>`; }
}

function csv(rows){
  const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return ['When,Who,Kind,Rating,Reasons,Text,Process,Status', ...rows.map(f => [f.created, f.who, f.kind, f.rating, f.reasons.join('; '), f.text, f.process, f.status].map(cell).join(','))].join('\n');
}
function download(blob, name){ const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }

export function mountAdmin(root){
  root.innerHTML = '<div id="adm"></div>';
  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-tab]'); if (t){ A.tab = t.dataset.tab; A.session = null; return draw(); }
    const mk = e.target.closest('[data-mkind]'); if (mk){ A.memberKind = mk.dataset.mkind; return draw(); }
    const fs = e.target.closest('[data-fbs]'); if (fs){ A.fbStatus = fs.dataset.fbs; return draw(); }
    const fset = e.target.closest('[data-fbset]'); if (fset){ await api('/api/admin/feedback', { method:'PATCH', body:JSON.stringify({ id:fset.dataset.id, status:fset.dataset.fbset }) }); return draw(); }
    if (e.target.closest('[data-csv]')){ download(new Blob([csv(A.fbRows || [])], { type:'text/csv' }), 'forks-world-feedback.csv'); return; }
    const rz = e.target.closest('[data-reset]'); if (rz){ const what = rz.dataset.reset; if (!confirm(what === 'analytics' ? 'Clear all dashboard data (actions, interview turns, AI call logs, feedback, suggestions)? Processes and the library stay. This cannot be undone.' : 'Remove guest accounts that never made anything? This cannot be undone.')) return; const msg = $('#reset-msg'); msg.textContent = 'Working…'; try { await api('/api/admin/reset', { method:'POST', body:JSON.stringify({ what }) }); } catch (err){ msg.textContent = err.message || 'Could not do that.'; return; } return draw(); }
    if (e.target.closest('[data-adopt]')){ const msg = $('#adopt-msg'); msg.textContent = 'Working…'; try { const r = await api('/api/admin/adopt', { method:'POST', body:JSON.stringify({ handle:$('#adopt-name').value }) }); msg.textContent = 'Done. ' + r.published + ' public and ' + r.processes + ' total processes now belong to “' + r.name + '”.'; } catch (err){ msg.textContent = err.message || 'Could not do that.'; } return; }
    const o = e.target.closest('[data-open]'); if (o){ A.session = o.dataset.open; return draw(); }
    if (e.target.closest('[data-back]')){ A.session = null; return draw(); }
    const s = e.target.closest('[data-sug]'); if (s){ await api('/api/admin/suggestions', { method:'PATCH', body:JSON.stringify({ id:s.dataset.id, status:s.dataset.sug }) }); return draw(); }
    if (e.target.closest('[data-gen]')){ A.busy = true; draw(); try { const r = await api('/api/admin/suggestions', { method:'POST', body:'{}' }); if (!r.added) alert('Nothing yet. No problem has come up for 3 or more people.'); } catch (err){ alert(err.message); } A.busy = false; return draw(); }
    const ex = e.target.closest('[data-export]'); if (ex){
      const kind = ex.dataset.export;
      const r = await fetch('/api/admin/export' + (kind === 'votes' ? '?kind=votes' : ''), { headers:{ 'x-ptw-key':key() } });
      if (r.ok) download(await r.blob(), 'processtheworld-' + kind + '.jsonl');
    }
  });
  root.addEventListener('change', e => {
    if (e.target.id === 'days'){ A.days = +e.target.value; draw(); }
    if (e.target.id === 'fbkind'){ A.fbKind = e.target.value; draw(); }
  });
  let qt; root.addEventListener('input', e => { if (e.target.id === 'fbq'){ A.fbQ = e.target.value; clearTimeout(qt); qt = setTimeout(async () => { await draw(); const i = $('#fbq'); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); } });
  draw();
}
