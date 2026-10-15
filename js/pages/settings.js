Data.ready.then(() => {
if (UI.init({ page: "settings.html", title: "Settings", admin: true })) {
  const D = Data, $ = id => document.getElementById(id), cfg = D.cfg;
  const F = { cName: ["name"], cModel: ["model"], cProv: ["provider"], cVer: ["version"], cCtx: ["ctx", 1], cTemp: ["temp", 1], cMax: ["max", 1], cPi: ["pi", 1], cPo: ["po", 1], cLim: ["lim", 1], cUq: ["userLim", 1], cPrompt: ["prompt"] };
  let timer;
  for (const id in F) {
    $(id).value = cfg[F[id][0]];
    $(id).addEventListener("input", e => {
      const [k, num] = F[id]; let v = e.target.value;
      if (num) { v = parseFloat(v); if (isNaN(v) || v < 0 || ((k === "lim" || k === "userLim") && v <= 0)) return; }
      cfg[k] = v; $("saved").textContent = "// saving...";
      D.saveCfg().then(r => { $("saved").textContent = r instanceof Error ? "// couldn't save: " + r.message : "// saved"; clearTimeout(timer); timer = setTimeout(() => $("saved").textContent = "", 1800); });
    });
  }

  // ----- API keys: how your real AI reports requests to this dashboard -----
  const endpoint = location.origin + location.pathname.replace(/[^/]*$/, "") + "api/ingest.php";
  const say = (t, bad) => { const m = $("kmsg"); m.textContent = t; m.className = "msg " + (bad ? "err" : "ok"); };
  function keys() {
    $("ktable").innerHTML = D.keys.map(k => `<tr><td>${D.esc(k.name)}</td><td>${D.esc(k.prefix)}…</td><td>${new Date(k.created).toLocaleDateString()}</td><td>${k.lastUsed ? D.when(k.lastUsed) : "never"}</td><td><span class="tag ${k.revoked ? "bad" : "ok"}">${k.revoked ? "revoked" : "active"}</span></td><td class="n">${k.revoked ? "" : `<button class="ghost sm" data-id="${k.id}">revoke</button>`}</td></tr>`).join("") || `<tr><td colspan="6">// no keys yet</td></tr>`;
  }
  $("snippet").textContent = `curl -X POST ${endpoint} \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"user":"alice","chat":"Support bot","input_tokens":1200,"output_tokens":450,"latency_ms":900,"status":"ok"}'`;
  $("kadd").onclick = async () => {
    const name = $("kname").value.trim(); if (!name) return say("// give the key a name first", true);
    try {
      const r = await D.createKey(name); $("kname").value = ""; keys();
      $("newkey").innerHTML = `<div class="keybox"><b>copy this key now. It won't be shown again:</b><br><code id="thekey">${D.esc(r.key)}</code></div>`;
      say("// key created");
    } catch (err) { say("// " + err.message, true); }
  };
  $("ktable").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b || !confirm("Revoke this key? Anything using it will stop being able to report requests.")) return;
    try { await D.revokeKey(+b.dataset.id); keys(); say("// key revoked"); } catch (err) { say("// " + err.message, true); }
  });
  keys();

  $("export").onclick = () => { location.href = "api/admin.php?action=export"; };
}
}).catch(UI.fail);
