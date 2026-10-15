/* login.js — login page behavior + animations */
(function () {
  const $ = id => document.getElementById(id);
  Auth.check().then(me => { if (me) location.replace("index.html"); });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode = "login", busy = false;

  // ----- boot lines -----
  const lines = ["secure channel established", "awaiting credentials <span class='ok'>...</span>"];
  lines.forEach((l, k) => setTimeout(() => $("boot").insertAdjacentHTML("beforeend", "<div>&gt; " + l + "</div>"), reduce ? 0 : 250 + k * 380));

  // ----- tabs -----
  function setMode(m) {
    mode = m;
    $("tabs").dataset.mode = m;
    $("tLogin").classList.toggle("on", m === "login");
    $("tSign").classList.toggle("on", m === "signup");
    $("confirm").disabled = m === "login";
    $("pass").autocomplete = m === "login" ? "current-password" : "new-password";
    $("goText").textContent = m === "login" ? "Log in" : "Create account";
    say("");
  }
  $("tLogin").onclick = () => setMode("login");
  $("tSign").onclick = () => setMode("signup");

  Auth.status().then(st => {      // first run: no accounts yet, so go straight to creating the admin
    if (!st.hasUsers) { setMode("signup"); say("// no accounts yet. The first one becomes the admin", "ok"); }
    else if (!st.signupOpen) { $("tSign").style.display = "none"; $("tabs").style.gridTemplateColumns = "1fr"; $("tabs").dataset.single = "1"; }
  }).catch(e => say("// " + e.message + ". Start Laragon, then open api/install.php once", "err"));

  $("eye").onclick = () => {
    const show = $("pass").type === "password";
    $("pass").type = show ? "text" : "password";
    $("confirm").type = show ? "text" : "password";
    $("eye").textContent = show ? "hide" : "show";
    $("eye").setAttribute("aria-label", show ? "Hide password" : "Show password");
  };

  function say(t, cls) { const m = $("msg"); m.textContent = t; m.className = "msg" + (cls ? " " + cls : ""); }
  function fail(t) {
    say(t, "err");
    const c = $("card"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
  }
  function success() {
    say("> access granted", "ok");
    $("card").classList.add("granted");
    $("flash").classList.add("on");
    setTimeout(() => $("stage").classList.add("out"), reduce ? 0 : 450);
    setTimeout(() => location.href = "index.html", reduce ? 50 : 1100);
  }

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    if (busy) return;
    const u = $("user").value, p = $("pass").value;
    if (!u.trim() || !p) return fail("enter a username and password");
    if (mode === "signup" && p !== $("confirm").value) return fail("passwords do not match");
    busy = true; say("");
    $("go").classList.add("busy"); $("goText").textContent = "authenticating...";
    const rem = $("remember").checked;
    const job = mode === "login" ? Auth.login(u, p, rem) : Auth.signup(u, p, rem);
    let err = null;
    await Promise.all([job.catch(x => { err = x; }), new Promise(r => setTimeout(r, reduce ? 0 : 1100))]);
    $("go").classList.remove("busy");
    $("goText").textContent = mode === "login" ? "Log in" : "Create account";
    busy = false;
    err ? fail(err.message) : success();
  });

  // ----- animated background: drifting network + crescent moon -----
  const cv = $("bg"), cx = cv.getContext("2d");
  let W, H, pts = [], mx = 0, my = 0;
  function size() {
    const d = devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.min(95, Math.floor(W * H / 15000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28, r: Math.random() * 1.4 + .4, z: Math.random() * .8 + .2 }));
  }
  function moon() {
    const x = W * .85, y = Math.min(H * .14, 120), R = Math.max(26, Math.min(W, H) * .045);
    const g = cx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * .5);
    g.addColorStop(0, "rgba(190,215,245,.22)"); g.addColorStop(.12, "rgba(120,160,220,.08)"); g.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); cx.arc(x + R * .55, y - R * .15, R * .92, 0, 7); cx.clip("evenodd");
    cx.shadowColor = "rgba(190,215,245,.9)"; cx.shadowBlur = 24; cx.fillStyle = "#dbe6f5";
    cx.beginPath(); cx.arc(x, y, R, 0, 7); cx.fill(); cx.restore();
  }
  function frame() {
    cx.clearRect(0, 0, W, H); moon();
    const ox = (mx - W / 2) * .01, oy = (my - H / 2) * .01;
    for (const p of pts) {
      if (!reduce) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
      p.dx = p.x + ox * p.z * 6; p.dy = p.y + oy * p.z * 6;
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.dx - b.dx, a.dy - b.dy);
      if (d < 130) { cx.strokeStyle = "rgba(63,127,216," + (.2 * (1 - d / 130)) + ")"; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(a.dx, a.dy); cx.lineTo(b.dx, b.dy); cx.stroke(); }
    }
    for (const p of pts) { cx.fillStyle = "rgba(201,216,234," + (.35 + .45 * p.z) + ")"; cx.beginPath(); cx.arc(p.dx, p.dy, p.r, 0, 7); cx.fill(); }
    if (!reduce) requestAnimationFrame(frame);
  }
  addEventListener("resize", () => { size(); if (reduce) frame(); });
  addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; });
  mx = innerWidth / 2; my = innerHeight / 2;
  size(); frame();
})();
