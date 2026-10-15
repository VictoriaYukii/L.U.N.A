Data.ready.then(() => {
if (UI.init({ page: "users.html", title: "Users", admin: true })) {
  const D = Data, $ = id => document.getElementById(id);
  const say = (t, bad) => { const m = $("umsg"); m.textContent = t; m.className = "msg" + (bad ? " err" : ""); };
  function render() {
    const data = D.users.map(x => { const r = D.win(D.logOf(x.username), 30), T = D.stats(r).T, q = x.quota || D.cfg.userLim; return Object.assign({}, x, { n: r.length, T, q, p: Math.round(T / q * 100) }); });
    $("kpis").innerHTML = [UI.kpi("users", data.length), UI.kpi("admins", data.filter(x => x.role === "admin").length), UI.kpi("over quota", data.filter(x => x.p >= 100).length), UI.kpi("active · 30d", data.filter(x => x.n > 0).length)].join("");
    $("signup").checked = D.signupOpen;
    $("ubody").innerHTML = data.map(x => `<tr><td>${D.esc(x.username)}${x.username === D.ME ? " <em>(you)</em>" : ""}</td><td><span class="role ${x.role}">${x.role}</span></td><td>${new Date(x.created).toLocaleDateString()}</td><td class="n">${x.n}</td><td class="n">${D.fmt(x.T)}</td>
<td class="n"><input class="q" data-u="${D.esc(x.username)}" type="number" min="1" value="${x.q}" aria-label="Quota for ${D.esc(x.username)}"></td><td class="n ${x.p >= 100 ? "bad" : x.p >= D.cfg.alerts.warn ? "warn" : ""}">${x.p}%</td>
<td class="n"><div class="acts"><button class="ghost sm" data-a="view" data-u="${D.esc(x.username)}">view</button><button class="ghost sm" data-a="role" data-u="${D.esc(x.username)}" data-r="${x.role === "admin" ? "user" : "admin"}">${x.role === "admin" ? "make user" : "make admin"}</button><button class="ghost sm" data-a="pw" data-u="${D.esc(x.username)}">reset password</button>${x.username === D.ME ? "" : `<button class="ghost sm" data-a="del" data-u="${D.esc(x.username)}">delete</button>`}</div></td></tr>`).join("");
  }
  $("ubody").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return; const u = b.dataset.u, a = b.dataset.a;
    try {
      if (a === "view") { D.setScope(u); location.href = "usage.html"; return; }
      if (a === "role") { await D.setRole(u, b.dataset.r); if (u === D.ME && b.dataset.r === "user") return location.replace("index.html"); say("// " + u + " is now " + b.dataset.r); }
      if (a === "pw") { const p = prompt("New password for '" + u + "' (8-72 characters). Share it with them privately."); if (!p) return; await D.resetPassword(u, p); say("// password reset for " + u); }
      if (a === "del") { if (!confirm("Delete user '" + u + "' and ALL their requests? This cannot be undone.")) return; await D.removeUser(u); say("// deleted " + u); }
      render();
    } catch (err) { say("// " + err.message, true); }
  });
  $("ubody").addEventListener("change", async e => {
    if (!e.target.classList.contains("q")) return;
    try { const v = parseFloat(e.target.value); await D.setQuota(e.target.dataset.u, v > 0 ? v : null); say("// quota updated for " + e.target.dataset.u); } catch (err) { say("// " + err.message, true); }
    render();
  });
  $("signup").onchange = async e => { try { await D.setSignup(e.target.checked); say("// new sign-ups are now " + (D.signupOpen ? "open" : "closed")); } catch (err) { say("// " + err.message, true); e.target.checked = D.signupOpen; } };
  render();
}
}).catch(UI.fail);
