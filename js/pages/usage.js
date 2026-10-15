Data.ready.then(() => {
if (UI.init({ page: "usage.html", title: "Token usage", scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope(), all = sc === "all", rows = D.rowsFor(sc);
  let days = D.range();
  UI.seg($("range"), [[7, "7 days"], [14, "14 days"], [30, "30 days"]], days, v => { D.setRange(v); days = v; render(); });

  function render() {
    const w = D.win(rows, days), S = D.stats(w), bd = D.byDay(w, days);
    const peak = bd.reduce((a, d) => d.i + d.o > a.v ? { v: d.i + d.o, date: d.date } : a, { v: 0, date: "—" });
    const perDay = S.T / days, B = D.budget(sc), left = Math.max(0, B - D.stats(D.win(rows, 30)).T);
    const eta = perDay > 0 ? Math.floor(left / perDay) + " days" : "—";
    const st = [["input tokens", D.fmt(S.I)], ["output tokens", D.fmt(S.O)], ["input : output", S.O ? (S.I / S.O).toFixed(1) + " : 1" : "—"], ["avg tokens / request", S.n ? D.fmt(S.T / S.n) : "0"],
      ["peak day", peak.v ? D.fmt(peak.v) + " · " + peak.date : "—"], ["run rate", D.fmt(perDay) + " / day"], ["budget left at this pace", eta]];
    $("stats").innerHTML = st.map(s => `<div class="stat"><span>${s[0]}</span><strong>${s[1]}</strong></div>`).join("");
    UI.stacked($("chart"), bd, [{ key: "i", name: "input", color: "var(--c1)" }, { key: "o", name: "output", color: "var(--c2)" }], D.fmt, "Daily token usage");
    $("chartTitle").textContent = "daily tokens — last " + days + " days";
    UI.hbars($("byChat"), D.group(w, r => r.chat).slice(0, 8).map(g => ({ label: D.esc(g.key), value: D.fmt(g.T), sub: g.n + " requests · " + (S.T ? (g.T / S.T * 100).toFixed(0) : 0) + "% of usage", v: g.T })));
    if (all && D.ADMIN) {
      $("sideTitle").textContent = "by user";
      UI.hbars($("side"), D.group(w, r => r.user).map(g => ({ label: D.esc(g.key), value: D.fmt(g.T), sub: g.n + " requests · " + (g.T / Math.max(1, D.quotaOf(g.key)) * 100).toFixed(0) + "% of one quota", v: g.T })));
    } else {
      $("sideTitle").textContent = "input vs output";
      $("side").innerHTML = `<div class="hb"><div class="t"><span>input</span><span>${D.fmt(S.I)}</span></div><div class="bar"><i style="width:${S.T ? S.I / S.T * 100 : 0}%"></i></div></div><div class="hb"><div class="t"><span>output</span><span>${D.fmt(S.O)}</span></div><div class="bar"><i style="width:${S.T ? S.O / S.T * 100 : 0}%;background:var(--c2)"></i></div></div><p class="note">// output tokens usually cost more than input tokens</p>`;
    }
    UI.heat($("heat"), D.byHour(w));
  }
  $("exp").onclick = () => { const bd = D.byDay(D.win(rows, days), days); D.download("token-usage-" + days + "d.csv", D.csv(bd, [["date", d => new Date(d.t).toISOString().slice(0, 10)], ["input_tokens", d => d.i], ["output_tokens", d => d.o], ["total_tokens", d => d.i + d.o], ["requests", d => d.n]])); };
  render();
}
}).catch(UI.fail);
