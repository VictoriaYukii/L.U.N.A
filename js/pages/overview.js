Data.ready.then(() => {
if (UI.init({ page: "index.html", title: "Overview", scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope(), all = sc === "all", rows = D.rowsFor(sc);

  // headline numbers: last 7 days vs the 7 days before
  const w7 = D.win(rows, 7), S = D.stats(w7), Pv = D.stats(D.win(rows, 7, 7));
  const k = [
    UI.kpi("tokens · 7d", D.fmt(S.T), S.T, Pv.T),
    UI.kpi("requests · 7d", S.n, S.n, Pv.n),
    UI.kpi("avg latency · 7d", S.n ? Math.round(S.avg) + " ms" : "—", S.avg, Pv.avg, "down"),
    UI.kpi("error rate · 7d", S.errRate.toFixed(1) + "%", S.errRate, Pv.errRate, "down"),
    D.ADMIN ? UI.kpi("est. cost · 7d", D.money(S.cost), S.cost, Pv.cost) : UI.kpi("chats · 7d", new Set(w7.map(r => r.chat)).size)
  ];
  $("kpis").innerHTML = k.join("");

  // budget gauge (rolling 30 days)
  const S30 = D.stats(D.win(rows, 30)), B = D.budget(sc), pct = S30.T / B * 100, what = all ? "system budget" : "quota";
  $("budTitle").textContent = (all ? "token budget" : "token quota") + " · 30 days";
  $("used").textContent = D.fmt(S30.T) + " tokens";
  $("ofLimit").textContent = pct.toFixed(1) + "% of " + D.fmt(B) + " " + what;
  UI.cells($("cells"), S30.I, S30.O, B);
  $("cells").setAttribute("aria-label", pct.toFixed(1) + "% of " + what + " used");
  $("lIn").textContent = D.fmt(S30.I); $("lOut").textContent = D.fmt(S30.O);

  UI.stacked($("chart"), D.byDay(D.win(rows, 14), 14), [{ key: "i", name: "input", color: "var(--c1)" }, { key: "o", name: "output", color: "var(--c2)" }], D.fmt, "Daily token usage, last 14 days");
  UI.alertList($("alerts"), D.alerts(), "All systems nominal");

  $("con").innerHTML = rows.slice().sort((a, b) => a.t - b.t).slice(-8).reverse().map(x =>
    `<div>[${D.when(x.t)}] <b>${x.status === "error" ? "ERR" : "REQ"}</b>${all ? " user=<em>" + D.esc(x.user) + "</em>" : ""} chat="${D.esc(x.chat)}" tok=<em>${x.i + x.o}</em> lat=${x.ms}ms</div>`).join("") || "<div>// no requests yet</div>";

  UI.hbars($("chats"), D.group(D.win(rows, 30), r => r.chat).slice(0, 6).map(g => ({ label: D.esc(g.key), value: D.fmt(g.T), sub: g.n + " requests · avg " + Math.round(g.avg) + " ms", v: g.T })), "// no chats yet");

  const lines = ["initializing monitor...", "signed in as " + D.ME + " <span class='ok'>(" + (D.ADMIN ? "admin" : "user") + ")</span>", "reading token ledger ... <span class='ok'>ok</span>"];
  const b = $("boot");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) b.innerHTML = lines.map(l => "<div>&gt; " + l + "</div>").join("");
  else lines.forEach((l, i) => setTimeout(() => b.insertAdjacentHTML("beforeend", "<div>&gt; " + l + "</div>"), i * 300));
}
}).catch(UI.fail);
