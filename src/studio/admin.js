// Admin dashboard: what people did, what they told us, and what to change.
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
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '—';

const A = { tab:'overview', days:30, fbStatus:'new', session:null, busy:false };

function bars(rows, label, val){
  const max = Math.max(1, ...rows.map(val));
  return rows.length ? `<ul class="bars">${rows.map(r => `<li><span class="bl">${esc(label(r))}</span><span class="bt"><b style="width:${(100 * val(r) / max).toFixed(1)}%"></b></span><span class="bv">${val(r)}</span></li>`).join('')}</ul>` : '<p class="hint">No data yet.</p>';
}
function daily(rows){
  if (!rows.length) return '<p class="hint">No turns yet.</p>';
  const max = Math.max(1, ...rows.map(r => r.turns)), w = 640, h = 120, bw = Math.max(4, Math.floor(w / rows.length) - 3);
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h + 20}" role="img" aria-label="Turns per day">
    <line x1="0" y1="${h}" x2="${w}" y2="${h}" style="stroke:var(--line)"/>
    ${rows.map((r, i) => { const bh = Math.max(2, h * r.turns / max), x = i * (bw + 3); return `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="2" style="fill:var(--accent)"><title>${new Date(r.day).toLocaleDateString()}: ${r.turns}</title></rect>`; }).join('')}
    <text x="0" y="${h + 16}" style="fill:var(--muted);font-size:11px">${new Date(rows[0].day).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</text>
    <text x="${w}" y="${h + 16}" text-anchor="end" style="fill:var(--muted);font-size:11px">${new Date(rows[rows.length-1].day).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · peak ${max}</text>
  </svg></div>`;
}

async function overview(el){
  const d = await api('/api/admin/overview?days=' + A.days);
  const cr = await api('/api/admin/credits').catch(() => ({ users:[] }));
  const credits = `<section class="panel"><h3>Low on credits</h3><p class="hint">People with ${cr.lowAtOrBelow ?? 20} credits or fewer left (everyone starts with 100). Paused people can't use the mapper until you give them more.</p>
    ${cr.users.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Who</th><th>Left</th><th>Status</th><th>Last seen</th></tr></thead><tbody>${cr.users.map(u => `<tr><td>${esc(u.email || u.handle)}</td><td>${u.credits}</td><td>${u.paused ? 'Paused' : 'Low'}</td><td>${when(u.lastSeenAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Nobody is low right now.</p>'}</section>`;
  const q = Object.fromEntries(d.questions.map(x => [x.outcome, x.count]));
  const qTotal = (q.answered || 0) + (q.skipped || 0) + (q.ignored || 0);
  const chk = Object.entries(d.checks);
  const rem = Object.fromEntries(d.removals.map(r => [r.verdict, r.count]));
  const aie = await api('/api/admin/ai-errors').catch(() => ({ errors:[] }));
  const aiPanel = aie.errors.length ? `<section class="panel"><h3>Latest AI errors</h3><p class="hint">If people see "could not answer", the reason is here.</p><ul class="ops">${aie.errors.map(x => `<li><span class="hint">${when(x.at)}</span> <code>${esc(x.model)}</code> ${esc(String(x.error).slice(0, 220))}</li>`).join('')}</ul></section>` : '';
  const adopt = `<section class="panel"><h3>Put your name on the starter library</h3><p class="hint">The processes my agents built are published under temporary guest accounts. This moves all of them onto your account and names it. Run it again after new ones are added.</p><div class="row-in"><input id="adopt-name" value="Brian" maxlength="24" aria-label="Username"><button class="btn primary sm" data-adopt>Move them to my account</button></div><p class="hint" id="adopt-msg" role="status"></p></section>`;
  el.innerHTML = aiPanel + adopt + credits + `
  <div class="kpis">
    <div><span class="label">People</span><b>${d.users}</b><small>${d.verified} with email · ${d.newUsers} new</small></div>
    <div><span class="label">Processes</span><b>${d.processes}</b><small>${d.finished} finished</small></div>
    <div><span class="label">Turns</span><b>${d.turns}</b><small>last ${d.days} days</small></div>
    <div><span class="label">AI cost</span><b>${money(d.ai.cost)}</b><small>${d.ai.calls} calls · ${d.ai.avgLatency} ms avg</small></div>
    <div><span class="label">Finish rating</span><b>${d.finish.avg ? d.finish.avg.toFixed(1) + '/5' : '—'}</b><small>${d.finish.count} ratings</small></div>
    <div><span class="label">Replies</span><b>${d.thumbs.up}↑ ${d.thumbs.down}↓</b><small>thumbs</small></div>
    <div><span class="label">New feedback</span><b>${d.newFeedback}</b><small><button class="linkish" data-goto="feedback">Review</button></small></div>
  </div>
  <section class="panel"><h3>Turns per day</h3>${daily(d.daily)}</section>
  <div class="grid2">
    <section class="panel"><h3>What people corrected</h3><p class="hint">Messages the engine classified as corrections, by kind.</p>${bars(d.corrections, r => r.category, r => r.count)}</section>
    <section class="panel"><h3>What people's messages were</h3>${bars(d.messageTypes, r => r.type, r => r.count)}</section>
    <section class="panel"><h3>Interview questions</h3>
      <p>${pct(q.answered || 0, qTotal)} answered · ${pct(q.skipped || 0, qTotal)} skipped · ${pct(q.ignored || 0, qTotal)} ignored</p>
      <p class="hint">An answered question changed the map by ${d.avgInfoGain != null ? d.avgInfoGain.toFixed(1) : '—'} steps on average. That number is the interviewer's training signal.</p></section>
    <section class="panel"><h3>Self-checks people reviewed</h3>
      ${chk.length ? `<table class="tbl"><thead><tr><th>Check</th><th>“Right as is”</th><th>Sent to fix</th><th>Checker right</th></tr></thead><tbody>${chk.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.dismissed}</td><td>${v.fixed}</td><td>${pct(v.fixed, v.fixed + v.dismissed)}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">No checks reviewed yet.</p>'}</section>
    <section class="panel"><h3>Proposed removals</h3><p>${rem.removed || 0} removed · ${rem.kept || 0} kept · ${rem.pending || 0} waiting</p><p class="hint">Kept means the AI was wrong to remove the step.</p></section>
    <section class="panel"><h3>Community</h3>
      <p>${d.community.published} public processes · ${d.community.shares} new shares</p>
      <p>Suggested changes: ${d.community.proposals.map(p => esc(p.status) + ' ' + p.count).join(' · ') || 'none yet'}</p>
      <p>Votes: ${d.community.votes.map(v => (v.choice === 'after' ? 'after is better ' : 'before is better ') + v.count).join(' · ') || 'none yet'}</p>
      <p class="hint">Each vote is a human preference between two versions of a process.</p></section>
    <section class="panel"><h3>Everything people did</h3>${bars(d.events.slice(0, 14), r => r.type.replace(/_/g, ' '), r => r.count)}</section>
  </div>`;
}

async function feedback(el){
  const d = await api('/api/admin/feedback?status=' + A.fbStatus);
  el.innerHTML = `<div class="seg">${['new','reviewed','done','all'].map(s => `<button class="btn sm${A.fbStatus === s ? ' primary' : ''}" data-fbs="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
  ${d.feedback.length ? d.feedback.map(f => `<article class="panel fb">
    <header><span class="pill">${esc({ button:'Feedback box', reply:'Reply rating', finish:'Finish rating', checkin:'Check-in' }[f.kind] || f.kind)}</span>
      ${f.rating != null ? `<b>${f.kind === 'reply' ? (f.rating > 0 ? '👍' : '👎') : f.rating + '/5'}</b>` : ''}
      ${f.reasons.map(r => `<span class="chip">${esc(r)}</span>`).join('')}
      <span class="hint">${esc(f.who)} · ${when(f.created)}${f.process ? ' · ' + esc(f.process) : ''}</span></header>
    ${f.text ? `<p class="fbtext">${esc(f.text)}</p>` : ''}
    ${f.context ? `<details><summary>What was on screen</summary><pre>${esc(JSON.stringify(f.context, null, 2))}</pre></details>` : ''}
    <footer>${f.processId ? `<button class="btn sm" data-open="${esc(f.processId)}">Open session</button>` : ''}${f.status !== 'reviewed' ? `<button class="btn sm" data-fbset="reviewed" data-id="${f.id}">Mark reviewed</button>` : ''}${f.status !== 'done' ? `<button class="btn sm" data-fbset="done" data-id="${f.id}">Done</button>` : ''}</footer>
  </article>`).join('') : '<p class="hint">Nothing here.</p>'}`;
}

async function sessions(el){
  if (A.session) return session(el, A.session);
  const d = await api('/api/admin/sessions');
  el.innerHTML = d.sessions.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Process</th><th>Who</th><th>Turns</th><th>Corrections</th><th>Steps</th><th>Rating</th><th>Cost</th><th>Updated</th></tr></thead><tbody>
    ${d.sessions.map(s => `<tr class="click" data-open="${esc(s.id)}"><td><b>${esc(s.title)}</b>${s.status === 'done' ? ' <span class="pill pub">Finished</span>' : ''}</td><td>${esc(s.who)}</td><td>${s.turns}</td><td>${s.corrections}</td><td>${s.steps} · ${s.layers}L</td><td>${s.rating ?? '—'}</td><td>${money(s.cost)}</td><td>${when(s.updated)}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="hint">No sessions yet.</p>';
}

async function session(el, id){
  const d = await api('/api/admin/sessions/' + id);
  const qByTurn = Object.fromEntries(d.questions.map(q => [q.askedTurnId, q]));
  const cost = d.calls.reduce((a, c) => a + c.costUsd, 0);
  const maps = Object.values(d.process.doc?.maps || {});
  el.innerHTML = `<button class="btn ghost sm" data-back>← All sessions</button>
  <h2>${esc(d.process.title)}</h2>
  <p class="hint">${esc(d.process.who)} · ${d.turns.length} turns · ${d.calls.length} AI calls · ${money(cost)} · ${maps.length} layers</p>
  <div class="grid2 wide">
    <section class="panel"><h3>Conversation and what the engine did</h3>
      ${d.turns.map(t => { const q = qByTurn[t.id]; return `<div class="turn">
        <p class="u">${esc(t.userText)}</p>
        <p class="tags">${t.feedbackType ? `<span class="pill${t.feedbackType === 'correction' ? ' warn' : ''}">${esc(t.feedbackType)}${t.feedbackCategory && t.feedbackType === 'correction' ? ' · ' + esc(t.feedbackCategory) : ''}</span>` : ''}
          <span class="hint">${t.opsApplied} changes${t.removalsProposed ? ' · ' + t.removalsProposed + ' removals proposed' : ''}${t.checksFound ? ` · checks found ${t.checksFound}, repaired ${t.checksRepaired}` : ''}${t.outcome ? ' · ' + esc(t.outcome) : ''}${t.retyped ? ' · retyped' : ''}</span></p>
        <p class="a">${esc(t.replySay || '')}${t.replyAsk ? `<br><b>${esc(t.replyAsk)}</b>${q?.outcome ? ` <span class="hint">(${esc(q.outcome)}${q.infoGain != null ? ', +' + q.infoGain : ''})</span>` : ''}` : ''}</p>
        <details><summary>${t.ops.length} AI changes</summary><ul class="ops">${t.ops.map(o => `<li><code>${esc(o.pass)} ${esc(o.op)}</code> ${esc(o.result)}${o.humanVerdict ? ' → ' + esc(o.humanVerdict) : ''} <span class="hint">${esc(JSON.stringify(o.payload)).slice(0, 220)}</span></li>`).join('')}</ul></details>
      </div>`; }).join('') || '<p class="hint">No turns recorded.</p>'}
    </section>
    <div class="col">
      <section class="panel"><h3>Final map</h3>${maps.map(m => `<p><b>${esc(m.title)}</b> <span class="hint">${m.lanes.length} lanes · ${m.steps.length} steps</span><br><span class="hint">${esc(m.steps.map(s => s.label).join(' → '))}</span></p>`).join('')}</section>
      <section class="panel"><h3>Feedback</h3>${d.feedback.map(f => `<p><span class="pill">${esc(f.kind)}</span> ${f.rating ?? ''} ${esc(f.reasons.join(', '))} ${esc(f.text || '')}</p>`).join('') || '<p class="hint">None.</p>'}</section>
      <section class="panel"><h3>Actions</h3><ul class="ops">${d.events.map(e => `<li><span class="hint">${when(e.createdAt)}</span> <code>${esc(e.who)}</code> ${esc(e.type.replace(/_/g, ' '))} <span class="hint">${esc(e.data ? JSON.stringify(e.data) : '').slice(0, 140)}</span></li>`).join('') || '<li class="hint">None.</li>'}</ul></section>
    </div>
  </div>`;
}

async function suggestions(el){
  const d = await api('/api/admin/suggestions');
  el.innerHTML = `<div class="seg"><button class="btn primary sm" data-gen ${A.busy ? 'disabled' : ''}>${A.busy ? 'Reading recent data…' : 'Suggest changes from recent data'}</button><span class="hint">Asks Claude to read the last 30 days of corrections, feedback and question outcomes.</span></div>
  ${d.suggestions.map(s => `<article class="panel sug ${s.status}">
    <header><h3>${esc(s.title)}</h3><span class="pill">${s.source === 'analysis' ? 'From Claude’s review' : 'Generated from data'}</span><span class="pill">${esc(s.status)}</span></header>
    <p>${esc(s.body)}</p>${s.evidence?.note ? `<p class="hint">Evidence: ${esc(s.evidence.note)}</p>` : ''}
    <footer>${['planned','done','dismissed','open'].filter(x => x !== s.status).map(x => `<button class="btn sm" data-sug="${x}" data-id="${s.id}">${{ planned:'Plan it', done:'Mark done', dismissed:'Dismiss', open:'Reopen' }[x]}</button>`).join('')}</footer>
  </article>`).join('')}`;
}

function training(el){
  el.innerHTML = `<section class="panel"><h3>Training data</h3>
    <p>Every mapping turn is stored as one training example:</p>
    <ul>
      <li><b>The supervised pair:</b> the map before the message, the message, and the map after.</li>
      <li><b>Every AI change</b> with the object before and after, which pass made it (main or repair), and the person's later verdict (kept, removed).</li>
      <li><b>The interviewer's question</b>, whether it was answered, skipped or ignored, and how many map changes the answer produced.</li>
      <li><b>How the person's message was classified:</b> new info, answer, correction (by kind), confusion, done.</li>
      <li><b>Self-check results</b> before and after, and which checks people marked right or sent to fix.</li>
      <li><b>Every AI call:</b> instructions, prompt, raw output, tokens, cost, latency and engine version.</li>
    </ul>
    <p>Every vote on a suggested change to a public process is stored as a preference pair: the version before, the version after, and which one people judged better.</p>
    <p class="seg"><button class="btn primary sm" data-export="turns">Download turns (JSONL)</button><button class="btn sm" data-export="votes">Download preference pairs (JSONL)</button></p>
    <p class="hint">Deleting a process deletes its training records too.</p></section>`;
}

const TABS = { overview, feedback, sessions, suggestions, training };
async function draw(){
  const root = $('#adm');
  root.innerHTML = `<div class="top"><div class="mark"><i>f</i><span class="wm"><b>forks</b><em>.world</em></span></div><span class="pill">Admin</span><div class="grow"></div><a class="btn ghost sm" href="/">Back to the app</a></div>
  <div class="home"><div class="home-in">
    <nav class="seg">${Object.keys(TABS).map(t => `<button class="btn sm${A.tab === t ? ' primary' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      ${A.tab === 'overview' ? `<select id="days" aria-label="Period">${[7,30,90,365].map(n => `<option value="${n}" ${A.days === n ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select>` : ''}</nav>
    <div id="body"><p class="hint">Loading…</p></div>
  </div></div>`;
  const body = $('#body');
  try { await TABS[A.tab](body); }
  catch (e){ body.innerHTML = e.status === 403 ? `<section class="panel"><h3>Admins only</h3><p>Open <a href="/">the app</a>, choose your name in the top right, and save or sign in with your admin email. Then come back here.</p></section>` : `<p class="hint">${esc(e.message || 'Something went wrong.')}</p>`; }
}

export function mountAdmin(root){
  root.innerHTML = '<div id="adm"></div>';
  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-tab]'); if (t){ A.tab = t.dataset.tab; A.session = null; return draw(); }
    const g = e.target.closest('[data-goto]'); if (g){ A.tab = g.dataset.goto; return draw(); }
    const fs = e.target.closest('[data-fbs]'); if (fs){ A.fbStatus = fs.dataset.fbs; return draw(); }
    const fset = e.target.closest('[data-fbset]'); if (fset){ await api('/api/admin/feedback', { method:'PATCH', body:JSON.stringify({ id:fset.dataset.id, status:fset.dataset.fbset }) }); return draw(); }
    if (e.target.closest('[data-adopt]')){ const msg = $('#adopt-msg'); msg.textContent = 'Working…'; try { const r = await api('/api/admin/adopt', { method:'POST', body:JSON.stringify({ handle:$('#adopt-name').value }) }); msg.textContent = 'Done. ' + r.published + ' public and ' + r.processes + ' total processes now belong to “' + r.name + '”.'; } catch (err){ msg.textContent = err.message || 'Could not do that.'; } return; }
    const o = e.target.closest('[data-open]'); if (o){ A.tab = 'sessions'; A.session = o.dataset.open; return draw(); }
    if (e.target.closest('[data-back]')){ A.session = null; return draw(); }
    const s = e.target.closest('[data-sug]'); if (s){ await api('/api/admin/suggestions', { method:'PATCH', body:JSON.stringify({ id:s.dataset.id, status:s.dataset.sug }) }); return draw(); }
    if (e.target.closest('[data-gen]')){ A.busy = true; draw(); try { await api('/api/admin/suggestions', { method:'POST', body:'{}' }); } catch (err){ alert(err.message); } A.busy = false; return draw(); }
    const ex = e.target.closest('[data-export]'); if (ex){
      const kind = ex.dataset.export;
      const r = await fetch('/api/admin/export' + (kind === 'votes' ? '?kind=votes' : ''), { headers:{ 'x-ptw-key':key() } });
      if (!r.ok) return;
      const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a');
      a.href = url; a.download = 'processtheworld-' + kind + '.jsonl'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  });
  root.addEventListener('change', e => { if (e.target.id === 'days'){ A.days = +e.target.value; draw(); } });
  draw();
}
