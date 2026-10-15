/* ui.js — app shell (sidebar + top bar) and small chart helpers */
const UI = (function () {
  const D = Data, $ = id => document.getElementById(id), esc = D.esc;
  const NAV = [
    ["Monitor", [["index.html", "Overview"], ["usage.html", "Token usage"], ["requests.html", "Requests"], ["chats.html", "Chats"], ["performance.html", "Performance"], ["alerts.html", "Alerts"]]],
    ["Admin", [["costs.html", "Costs"], ["users.html", "Users"], ["settings.html", "Settings"]], true],
    ["Account", [["account.html", "My account"]]]
  ];

  function init(o) {
    if (o.admin && !D.ADMIN) { location.replace("index.html"); return false; }
    document.title = o.title + " — " + (D.cfg.name || "AI") + " Monitor";
    const al = D.alerts(), worst = al.some(a => a.lvl === "crit") ? "crit" : al.length ? "warn" : "ok";
    const nav = NAV.filter(g => !g[2] || D.ADMIN).map(g => `<div class="grp">${g[0].toLowerCase()}</div>` + g[1].map(([h, l]) =>
      `<a class="item${h === o.page ? " on" : ""}" href="${h}"${h === o.page ? ' aria-current="page"' : ""}>${l}${h === "alerts.html" && al.length ? `<span class="badge">${al.length}</span>` : ""}</a>`).join("")).join("");
    let scopeSel = "";
    if (D.ADMIN && o.scope) {
      const sc = D.scope();
      scopeSel = `<label for="scope" style="margin:0">viewing</label><select id="scope"><option value="all"${sc === "all" ? " selected" : ""}>all users</option>` +
        D.people().map(x => `<option value="${x.user}"${sc === x.user ? " selected" : ""}>${x.user}</option>`).join("") + "</select>";
    }
    const shell = document.createElement("div"); shell.className = "shell";
    shell.innerHTML = `<aside class="nav" id="nav"><a class="brand" href="index.html"><span class="orb"></span><b>${esc((D.cfg.name || "AI").toUpperCase())}</b></a>${nav}</aside>
<div class="content"><header class="top"><button class="ghost sm menu" id="menu" aria-label="Open menu">menu</button><h1>${esc(o.title)}</h1><span class="spacer"></span>${scopeSel}
<span class="led ${worst === "crit" ? "bad" : worst === "warn" ? "warn" : "ok"}">${worst === "crit" ? "ALERT" : worst === "warn" ? "WARNING" : "ONLINE"}</span>
<div class="who"><span class="role ${D.ADMIN ? "admin" : "user"}">${D.ADMIN ? "admin" : "user"}</span><span>${esc(D.ME)}</span><button class="ghost sm" id="logout">Log out</button></div></header></div><div class="scrim" id="scrim"></div>`;
    document.body.prepend(shell);
    shell.querySelector(".content").appendChild($("main"));
    $("logout").onclick = () => Auth.logout();
    const toggle = f => { $("nav").classList.toggle("open", f); $("scrim").classList.toggle("on", f); };
    $("menu").onclick = () => toggle(!$("nav").classList.contains("open")); $("scrim").onclick = () => toggle(false);
    if ($("scope")) $("scope").onchange = e => { D.setScope(e.target.value); location.reload(); };
    motion(worst);
    if (D.truncated) $("main").insertAdjacentHTML("afterbegin", '<p class="note" style="margin:0 0 14px">// showing the most recent 50,000 requests only</p>');
    document.documentElement.classList.add("ready");
    return true;
  }

  // ----- motion: count-up numbers, page fades, ambient effects -----
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function countUp(el) {
    if (el.dataset.anim) return; el.dataset.anim = "1";
    const txt = el.textContent.trim(), nums = txt.match(/\d[\d,]*\.?\d*/g);
    if (!nums || nums.length !== 1) return;                       // only plain "one number" values
    const m = txt.match(/\d[\d,]*\.?\d*/), ns = m[0], pre = txt.slice(0, m.index), suf = txt.slice(m.index + ns.length);
    const dec = (ns.split(".")[1] || "").length, comma = ns.includes(","), val = parseFloat(ns.replace(/,/g, ""));
    if (!(val > 0)) return;
    const fmtv = v => { let t = v.toFixed(dec); if (comma) { const [a, b] = t.split("."); t = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (b ? "." + b : ""); } return pre + t + suf; };
    const t0 = performance.now();
    (function step(t) { const p = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - p, 3); el.textContent = p < 1 ? fmtv(val * e) : txt; if (p < 1) requestAnimationFrame(step); })(t0);
  }
  function motion(worst) {
    const nav = $("nav");
    nav.insertAdjacentHTML("beforeend", `<div class="pulse" aria-hidden="true"><svg viewBox="0 0 200 40" preserveAspectRatio="none"><path class="base" d="M0 20H40l6-12 8 26 8-20 5 6H110l6-12 8 26 8-20 5 6H200"/><path class="ecg" pathLength="200" d="M0 20H40l6-12 8 26 8-20 5 6H110l6-12 8 26 8-20 5 6H200"/></svg><span>${worst === "crit" ? "link degraded" : worst === "warn" ? "link unstable" : "link stable"}</span></div>`);
    if (REDUCE) return;
    document.body.insertAdjacentHTML("beforeend", '<div class="sweep" aria-hidden="true"></div>');
    const scan = () => document.querySelectorAll("main .kpi strong, main .stat strong, main .big").forEach(countUp);
    new MutationObserver(() => requestAnimationFrame(scan)).observe($("main"), { childList: true, subtree: true });
    requestAnimationFrame(scan);
    document.addEventListener("click", e => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button || a.target || /^(https?:|#|mailto:)/.test(a.getAttribute("href"))) return;
      e.preventDefault(); document.body.classList.add("leaving"); setTimeout(() => { location.href = a.href; }, 170);
    });
    addEventListener("pageshow", () => document.body.classList.remove("leaving"));
  }

  // ----- shown when the backend can't be reached or something unexpected breaks -----
  function fail(err) {
    if (err && err.status === 401) return;
    console.error(err);
    document.documentElement.classList.add("ready");
    const net = err && (err.network || /database|install/i.test(err.message || ""));
    (document.getElementById("main") || document.body).innerHTML = `<div class="panel" style="max-width:640px;margin:60px auto"><h2 style="color:var(--bad)">can't load the dashboard</h2><p>${esc((err && err.message) || "unknown error")}</p>` +
      (net ? `<p class="note">// start Apache and MySQL in Laragon, open <a href="api/install.php">api/install.php</a> once, and open this site through its Laragon address (not by double-clicking the file).</p>` : "") +
      `<div class="row"><button onclick="location.reload()">Try again</button><a href="login.html">Back to login</a></div></div>`;
  }

  // ----- widgets -----
  function kpi(label, val, cur, prev, good) {
    let d = "";
    if (cur !== undefined && prev > 0) { const p = (cur - prev) / prev * 100; if (Math.abs(p) >= .5) { const up = p > 0, cls = !good ? "" : ((good === "up") === up ? "ok" : "bad"); d = `<span class="dl ${cls}">${up ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}% vs previous period</span>`; } }
    return `<div class="panel kpi"><span>${label}</span><strong>${val}</strong>${d}</div>`;
  }
  function seg(el, opts, val, cb) {
    const draw = v => { el.innerHTML = opts.map(([k, l]) => `<button type="button" data-v="${k}" class="${k == v ? "on" : ""}">${l}</button>`).join(""); };
    el.className = "seg"; draw(val);
    el.onclick = e => { const b = e.target.closest("button"); if (!b) return; const v = isNaN(b.dataset.v) ? b.dataset.v : +b.dataset.v; draw(v); cb(v); };
  }
  function cells(el, I, O, B) {
    while (el.children.length < 50) el.appendChild(document.createElement("i"));
    const ci = Math.min(50, Math.round(I / B * 50)), co = Math.min(50 - ci, Math.round(O / B * 50));
    [...el.children].forEach((c, k) => { c.className = k < ci ? "a" : k < ci + co ? "b" : ""; c.style.setProperty("--k", k); });
  }
  function nice(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  const P = { l: 46, r: 8, t: 10, b: 26 }, W = 640, H = 230;
  function frame(svg, max, fmtv, days) {
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const ih = H - P.t - P.b, step = (W - P.l - P.r) / days.length, every = Math.ceil(days.length / 14);
    const grid = [0, .5, 1].map(f => { const y = P.t + ih * (1 - f); return `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${P.l - 6}" y="${y + 3}" text-anchor="end">${fmtv(max * f)}</text>`; }).join("");
    const labs = days.map((d, j) => j % every === 0 ? `<text x="${P.l + (j + .5) * step}" y="${H - 8}" text-anchor="middle">${d.label}</text>` : "").join("");
    return { grid: grid + labs, ih, step };
  }
  function stacked(svg, days, series, fmtv, label) {
    const max = nice(Math.max(1, ...days.map(d => series.reduce((a, s) => a + d[s.key], 0)))), f = frame(svg, max, fmtv, days), bw = Math.max(2, f.step * .68);
    svg.setAttribute("aria-label", label || "chart");
    svg.innerHTML = f.grid + days.map((d, j) => {
      let y = H - P.b; const x = P.l + j * f.step + (f.step - bw) / 2;
      return `<g class="bar" style="--j:${j}"><title>${d.date}: ` + series.map(s => s.name + " " + fmtv(d[s.key])).join(", ") + `</title>` + series.map(s => { const h = d[s.key] / max * f.ih; y -= h; return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${s.color}"/>`; }).join("") + "</g>";
    }).join("");
  }
  function lines(svg, days, series, fmtv, label) {
    const max = nice(Math.max(1, ...days.flatMap(d => series.map(s => s.get(d) || 0)))), f = frame(svg, max, fmtv, days);
    svg.setAttribute("aria-label", label || "chart");
    svg.innerHTML = f.grid + series.map(s => {
      let path = "", dots = "", pen = false;
      days.forEach((d, j) => { const v = s.get(d); if (v == null) { pen = false; return; } const x = P.l + (j + .5) * f.step, y = P.t + f.ih * (1 - v / max); path += (pen ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); pen = true; dots += `<circle class="dot" style="--j:${j}" cx="${x}" cy="${y}" r="2.6" fill="${s.color}"><title>${d.date}: ${s.name} ${fmtv(v)}</title></circle>`; });
      return `<path class="ln" pathLength="1" d="${path}" fill="none" stroke="${s.color}" stroke-width="2"/>` + dots;
    }).join("");
  }
  function hbars(el, items, empty) {
    const mx = Math.max(1, ...items.map(i => i.v));
    el.innerHTML = items.map((i, n) => `<div class="hb" style="--n:${n}"><div class="t"><span>${i.label}</span><span>${i.value}</span></div>${i.sub ? `<div class="m">${i.sub}</div>` : ""}<div class="bar"><i style="width:${i.v / mx * 100}%"></i></div></div>`).join("") || `<div class="m" style="color:var(--mute)">${empty || "// no data in this range"}</div>`;
  }
  function heat(el, arr) {
    const mx = Math.max(1, ...arr);
    el.className = "heat"; el.innerHTML = arr.map((v, h) => `<i style="--k:${h};opacity:${(.08 + .92 * v / mx).toFixed(2)}" title="${String(h).padStart(2, "0")}:00 — ${D.fmt(v)} tokens"></i>`).join("");
  }
  function alertList(el, list, ok) {
    el.innerHTML = list.length ? list.map(a => `<div class="alert ${a.lvl}"><div class="d"><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join("")
      : `<div class="alert good"><div class="d"><b>${ok || "All clear"}</b><small>nothing needs your attention right now</small></div></div>`;
  }
  return { init, fail, esc, kpi, seg, cells, stacked, lines, hbars, heat, alertList };
})();
