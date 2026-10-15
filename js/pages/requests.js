Data.ready.then(() => {
if (UI.init({ page: "requests.html", title: "Requests", scope: true })) {
  const D = Data, $ = id => document.getElementById(id), sc = D.scope(), all = sc === "all", rows = D.rowsFor(sc).sort((a, b) => b.t - a.t);
  const PER = 12; let page = 0;
  const showUser = D.ADMIN && all, cols = ["time", ...(showUser ? ["user"] : []), "chat", "input", "output", "total", "latency", "status", ...(D.ADMIN ? ["cost"] : [])];
  $("thead").innerHTML = "<tr>" + cols.map(c => `<th class="${["input", "output", "total", "latency", "cost"].includes(c) ? "n" : ""}">${c}</th>`).join("") + "</tr>";

  const filtered = () => { const q = $("q").value.trim().toLowerCase(), s = $("fs").value; return rows.filter(r => (!q || r.chat.toLowerCase().includes(q) || (r.user || "").includes(q)) && (!s || r.status === s)); };
  function render() {
    const f = filtered(), pages = Math.max(1, Math.ceil(f.length / PER)); page = Math.min(page, pages - 1);
    $("tb").innerHTML = f.slice(page * PER, page * PER + PER).map(r => `<tr><td>${D.when(r.t)}</td>${showUser ? `<td>${D.esc(r.user)}</td>` : ""}<td>${D.esc(r.chat)}</td><td class="n">${r.i.toLocaleString()}</td><td class="n">${r.o.toLocaleString()}</td><td class="n">${(r.i + r.o).toLocaleString()}</td><td class="n">${r.ms} ms</td><td><span class="tag ${r.status === "error" ? "bad" : "ok"}">${r.status}</span></td>${D.ADMIN ? `<td class="n">${D.money(D.cost(r.i, r.o))}</td>` : ""}</tr>`).join("") || `<tr><td colspan="${cols.length}">// no requests match</td></tr>`;
    $("pinfo").textContent = f.length + " requests · page " + (page + 1) + " of " + pages;
    $("prev").disabled = page === 0; $("next").disabled = page >= pages - 1;
  }
  $("q").oninput = () => { page = 0; render(); }; $("fs").onchange = () => { page = 0; render(); };
  $("prev").onclick = () => { page--; render(); }; $("next").onclick = () => { page++; render(); };
  $("exp").onclick = () => D.download("requests.csv", D.csv(filtered(), [["time", r => new Date(r.t).toISOString()], ["user", r => r.user], ["chat", r => r.chat], ["input_tokens", r => r.i], ["output_tokens", r => r.o], ["latency_ms", r => r.ms], ["status", r => r.status]]));

  $("add").onclick = async () => {
    const i = parseInt($("fi").value), o = parseInt($("fo").value), ms = parseInt($("fm").value), m = $("amsg");
    if (!(i >= 0) || !(o >= 0) || !(ms >= 0)) { m.className = "msg err"; m.textContent = "// tokens and latency must be numbers"; return; }
    try {
      await D.addReq({ chat: $("fc").value.trim().slice(0, 40) || "General", i, o, ms, status: $("fst").value });
      m.className = "msg ok"; m.textContent = "// saved to your account";
      setTimeout(() => location.reload(), 350);
    } catch (err) { m.className = "msg err"; m.textContent = "// " + err.message; }
  };
  render();
}
}).catch(UI.fail);
