Data.ready.then(() => {
if (UI.init({ page: "account.html", title: "My account" })) {
  const D = Data, $ = id => document.getElementById(id), rows = D.logOf(D.ME);
  const S = D.stats(D.win(rows, 30)), B = D.quotaOf(D.ME), pct = S.T / B * 100;
  $("profile").innerHTML = [["username", D.esc(D.ME)], ["role", D.ADMIN ? "admin" : "user"], ["member since", new Date(D.me.created).toLocaleDateString()], ["token quota", D.fmt(B) + " / 30 days"]].map(s => `<div class="stat"><span>${s[0]}</span><strong style="font-size:15px">${s[1]}</strong></div>`).join("");
  $("used").textContent = D.fmt(S.T) + " tokens"; $("ofLimit").textContent = pct.toFixed(1) + "% of your " + D.fmt(B) + " quota";
  UI.cells($("cells"), S.I, S.O, B); $("cells").setAttribute("aria-label", pct.toFixed(1) + "% of quota used");

  const say = (id, t, cls) => { const m = $(id); m.textContent = t; m.className = "msg " + (cls || ""); };
  $("pwform").addEventListener("submit", async e => {
    e.preventDefault();
    if ($("np").value !== $("np2").value) return say("pmsg", "// new passwords do not match", "err");
    try { await Auth.changePassword($("op").value, $("np").value); say("pmsg", "// password updated", "ok"); e.target.reset(); } catch (err) { say("pmsg", "// " + err.message, "err"); }
  });
  $("exp").onclick = () => D.download("my-requests.csv", D.csv(rows, [["time", r => new Date(r.t).toISOString()], ["chat", r => r.chat], ["input_tokens", r => r.i], ["output_tokens", r => r.o], ["latency_ms", r => r.ms], ["status", r => r.status]]));
  $("sample").onclick = async () => { if (!confirm("This DELETES your logged requests and replaces them with generated sample data. Continue?")) return; try { await D.resetSample(); location.reload(); } catch (err) { say("dmsg", "// " + err.message, "err"); } };
  $("clear").onclick = async () => { if (!confirm("Permanently delete all of your logged requests?")) return; try { await D.clearMine(); location.reload(); } catch (err) { say("dmsg", "// " + err.message, "err"); } };
}
}).catch(UI.fail);
