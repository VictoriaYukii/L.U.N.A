Data.ready.then(() => {
if (UI.init({ page: "costs.html", title: "Costs", admin: true, scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope(), all = sc === "all", rows = D.rowsFor(sc);
  let days = D.range();
  UI.seg($("range"), [[7, "7 days"], [14, "14 days"], [30, "30 days"]], days, v => { D.setRange(v); days = v; render(); });
  function render() {
    const w = D.win(rows, days), S = D.stats(w), P = D.stats(D.win(rows, days, days)), ci = S.I / 1e6 * D.cfg.pi, co = S.O / 1e6 * D.cfg.po;
    $("kpis").innerHTML = [UI.kpi("total cost", D.money(S.cost), S.cost, P.cost), UI.kpi("input cost", D.money(ci)), UI.kpi("output cost", D.money(co)),
      UI.kpi("cost / 1k requests", S.n ? D.money(S.cost / S.n * 1000) : "—"), UI.kpi("projected · 30 days", D.money(S.cost / days * 30)),
      UI.kpi("pricing", "$" + D.cfg.pi + " in · $" + D.cfg.po + " out")].join("");
    $("pricingNote").textContent = "// prices are per 1M tokens and can be changed in Settings";
    UI.stacked($("chart"), D.byDay(w, days), [{ key: "cost", name: "cost", color: "var(--c1)" }], D.money, "Cost per day");
    $("byChat").innerHTML = D.group(w, r => r.chat).map(g => `<tr><td>${D.esc(g.key)}</td><td class="n">${g.n}</td><td class="n">${D.fmt(g.T)}</td><td class="n">${D.money(g.cost)}</td><td class="n">${S.cost ? (g.cost / S.cost * 100).toFixed(0) : 0}%</td></tr>`).join("") || `<tr><td colspan="5">// no data</td></tr>`;
    if (all) $("byUser").innerHTML = D.group(w, r => r.user).map(g => `<tr><td>${D.esc(g.key)}</td><td class="n">${g.n}</td><td class="n">${D.fmt(g.T)}</td><td class="n">${D.money(g.cost)}</td><td class="n">${S.cost ? (g.cost / S.cost * 100).toFixed(0) : 0}%</td></tr>`).join("");
    else $("userWrap").remove();
  }
  $("exp").onclick = () => D.download("costs.csv", D.csv(D.byDay(D.win(rows, days), days), [["date", d => new Date(d.t).toISOString().slice(0, 10)], ["requests", d => d.n], ["input_tokens", d => d.i], ["output_tokens", d => d.o], ["cost_usd", d => d.cost.toFixed(4)]]));
  render();
}
}).catch(UI.fail);
