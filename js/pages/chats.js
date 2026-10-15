Data.ready.then(() => {
if (UI.init({ page: "chats.html", title: "Chats", scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope(), all = sc === "all", rows = D.rowsFor(sc);
  const keyOf = r => (all ? r.user + "/" : "") + r.chat;
  const groups = D.group(rows, keyOf).map(g => Object.assign(g, { name: g.rows[0].chat, user: g.rows[0].user, last: Math.max(...g.rows.map(r => r.t)), first: Math.min(...g.rows.map(r => r.t)) })).sort((a, b) => b.last - a.last);
  let sel = ""; try { sel = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
  if (!groups.some(g => g.key === sel)) sel = groups[0] ? groups[0].key : "";

  function list() {
    const q = $("q").value.trim().toLowerCase();
    $("list").innerHTML = groups.filter(g => !q || g.name.toLowerCase().includes(q) || g.user.includes(q)).map(g =>
      `<button type="button" class="citem${g.key === sel ? " on" : ""}" data-k="${D.esc(g.key)}">${D.esc(g.name)}${all ? ` <em style="color:var(--mute);font-style:normal">@${D.esc(g.user)}</em>` : ""}<span class="m">${g.n} requests · ${D.fmt(g.T)} tokens · ${D.when(g.last)}</span></button>`).join("") || `<p class="note">// no chats found</p>`;
  }
  function detail() {
    const g = groups.find(x => x.key === sel);
    if (!g) { $("detail").innerHTML = `<div class="panel"><p class="note">// no chats yet. log a request on the Requests page to start one.</p></div>`; return; }
    const st = [["requests", g.n], ["tokens", D.fmt(g.T)], ["avg latency", Math.round(g.avg) + " ms"], ["errors", g.err], ["first seen", D.when(g.first)], ["last active", D.when(g.last)]].concat(D.ADMIN ? [["est. cost", D.money(g.cost)]] : []);
    $("detail").innerHTML = `<div class="panel"><h2 style="font-size:16px;color:var(--c2)">${D.esc(g.name)}${all ? " @" + D.esc(g.user) : ""}</h2><div class="stats">${st.map(s => `<div class="stat"><span>${s[0]}</span><strong style="font-size:15px">${s[1]}</strong></div>`).join("")}</div></div>
<div class="panel" style="margin-top:22px"><h2>tokens per day — last 30 days</h2><svg id="dchart" role="img"></svg></div>
<div class="panel scroll" style="margin-top:22px"><h2>latest requests</h2><table><thead><tr><th>time</th><th class="n">input</th><th class="n">output</th><th class="n">latency</th><th>status</th></tr></thead><tbody>${g.rows.slice().sort((a, b) => b.t - a.t).slice(0, 10).map(r => `<tr><td>${D.when(r.t)}</td><td class="n">${r.i}</td><td class="n">${r.o}</td><td class="n">${r.ms} ms</td><td><span class="tag ${r.status === "error" ? "bad" : "ok"}">${r.status}</span></td></tr>`).join("")}</tbody></table></div>`;
    UI.stacked($("dchart"), D.byDay(D.win(g.rows, 30), 30), [{ key: "i", name: "input", color: "var(--c1)" }, { key: "o", name: "output", color: "var(--c2)" }], D.fmt, "Tokens per day for this chat");
  }
  $("list").onclick = e => { const b = e.target.closest("button"); if (!b) return; sel = b.dataset.k; history.replaceState(null, "", "#" + encodeURIComponent(sel)); list(); detail(); };
  $("q").oninput = list;
  list(); detail();
}
}).catch(UI.fail);
