Data.ready.then(() => {
if (UI.init({ page: "alerts.html", title: "Alerts", scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope();
  UI.alertList($("list"), D.alerts(), "All clear");
  const a = D.cfg.alerts;

  if (D.ADMIN) {
    $("rules").remove();
    $("warn").value = a.warn; $("p95").value = a.p95; $("err").value = a.err;
    [["warn", "warn", 1, 100], ["p95", "p95", 1, 1e7], ["err", "err", 0, 100]].forEach(([id, k, lo, hi]) => $(id).addEventListener("input", e => {
      const v = parseFloat(e.target.value); if (isNaN(v) || v < lo || v > hi) return;
      a[k] = v; UI.alertList($("list"), D.alerts(), "All clear"); $("saved").textContent = "// saving..."; D.saveCfg().then(r => { $("saved").textContent = r instanceof Error ? "// couldn't save: " + r.message : "// saved"; setTimeout(() => $("saved").textContent = "", 1800); });
    }));
    if (sc === "all") {
      $("usersPanel").innerHTML = D.people().map(x => { const T = D.stats(D.win(D.logOf(x.user), 30)).T, q = D.quotaOf(x.user), p = T / q * 100; return `<tr><td>${x.user}</td><td class="n">${D.fmt(T)}</td><td class="n">${D.fmt(q)}</td><td class="n ${p >= 100 ? "bad" : p >= a.warn ? "warn" : "ok"}">${p.toFixed(0)}%</td></tr>`; }).join("");
    } else $("usersWrap").remove();
  } else {
    $("ruleform").remove(); $("usersWrap").remove();
    $("rules").innerHTML = `<div class="stats"><div class="stat"><span>quota warning at</span><strong>${a.warn}%</strong></div><div class="stat"><span>p95 latency above</span><strong>${a.p95} ms</strong></div><div class="stat"><span>error rate above</span><strong>${a.err}%</strong></div></div><p class="note">// thresholds are set by an admin</p>`;
  }
}
}).catch(UI.fail);
