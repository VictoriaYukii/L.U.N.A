Data.ready.then(() => {
if (UI.init({ page: "performance.html", title: "Performance", scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope(), rows = D.rowsFor(sc);
  let days = D.range();
  UI.seg($("range"), [[7, "7 days"], [14, "14 days"], [30, "30 days"]], days, v => { D.setRange(v); days = v; render(); });

  function render() {
    const w = D.win(rows, days), S = D.stats(w), P = D.stats(D.win(rows, days, days)), a = D.cfg.alerts;
    $("kpis").innerHTML = [
      UI.kpi("avg latency", S.n ? Math.round(S.avg) + " ms" : "—", S.avg, P.avg, "down"), UI.kpi("p50 (median)", Math.round(S.p50) + " ms", S.p50, P.p50, "down"),
      UI.kpi("p95", Math.round(S.p95) + " ms", S.p95, P.p95, "down"), UI.kpi("p99", Math.round(S.p99) + " ms", S.p99, P.p99, "down"),
      UI.kpi("error rate", S.errRate.toFixed(1) + "%", S.errRate, P.errRate, "down"), UI.kpi("success rate", S.n ? (100 - S.errRate).toFixed(1) + "%" : "—")].join("");
    const bd = D.byDay(w, days);
    UI.lines($("lat"), bd, [{ name: "p50", color: "var(--c2)", get: d => d.ms.length ? D.pc(d.ms, 50) : null }, { name: "p95", color: "var(--c1)", get: d => d.ms.length ? D.pc(d.ms, 95) : null }], v => Math.round(v) + "ms", "Latency per day");
    UI.stacked($("err"), bd, [{ key: "rate", name: "errors", color: "var(--bad)" }], v => v.toFixed(0) + "%", "Error rate per day");
    const B = [[0, 500, "< 500 ms"], [500, 1000, "500 – 1000 ms"], [1000, 1500, "1.0 – 1.5 s"], [1500, 2000, "1.5 – 2.0 s"], [2000, 3000, "2 – 3 s"], [3000, 1e9, "> 3 s"]];
    UI.hbars($("hist"), B.map(([lo, hi, l]) => { const n = w.filter(r => r.ms >= lo && r.ms < hi).length; return { label: l, value: n + " requests", v: n }; }));
    $("slow").innerHTML = w.slice().sort((a, b) => b.ms - a.ms).slice(0, 8).map(r => `<tr><td>${D.when(r.t)}</td>${D.ADMIN && sc === "all" ? `<td>${D.esc(r.user)}</td>` : ""}<td>${D.esc(r.chat)}</td><td class="n">${r.i + r.o}</td><td class="n ${r.ms > a.p95 ? "warn" : ""}">${r.ms} ms</td><td><span class="tag ${r.status === "error" ? "bad" : "ok"}">${r.status}</span></td></tr>`).join("") || `<tr><td colspan="6">// no data</td></tr>`;
    $("slowhead").innerHTML = `<tr><th>time</th>${D.ADMIN && sc === "all" ? "<th>user</th>" : ""}<th>chat</th><th class="n">tokens</th><th class="n">latency</th><th>status</th></tr>`;
  }
  render();
}
}).catch(UI.fail);
