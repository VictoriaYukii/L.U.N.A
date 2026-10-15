/* data.js — loads everything from the backend once (bootstrap), then answers questions about it for every page */
const Data = (function () {
  const DAY = 864e5, SCK = "ai-scope-v1", RK = "ai-range-v1";
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  // ----- config (shared by everyone, edited by admins) -----
  const DEF = { name: "Atlas", model: "your-model-name", provider: "your-provider", version: "v1.0", ctx: 128000, temp: 0.7, max: 1024, pi: 3, po: 15,
    lim: 2000000, userLim: 500000, prompt: "You are Atlas, a helpful assistant.", alerts: { warn: 85, p95: 2500, err: 5 } };
  const cfg = Object.assign({}, DEF, { alerts: Object.assign({}, DEF.alerts) });
  const D = { cfg, DAY, me: null, ME: "", ADMIN: false, rows: [], users: [], keys: [], signupOpen: true, truncated: false };

  // ----- load: one request gets the signed-in user, settings and the data this user is allowed to see -----
  D.ready = API.get("bootstrap.php").then(b => {
    D.me = b.me; D.ME = b.me.username; D.ADMIN = b.me.role === "admin";
    const c = b.config || {}; Object.assign(cfg, c); cfg.alerts = Object.assign({}, DEF.alerts, c.alerts || {});
    D.rows = (b.rows || []).map(a => ({ t: a[0], user: a[1], chat: a[2], i: a[3], o: a[4], ms: a[5], status: a[6] ? "error" : "ok" })).sort((x, y) => x.t - y.t);
    D.users = b.users || []; D.keys = b.keys || []; D.signupOpen = b.signupOpen !== false; D.truncated = !!b.truncated;
  });

  // ----- formatting -----
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n));
  const cost = (i, o) => i / 1e6 * cfg.pi + o / 1e6 * cfg.po;
  const money = v => "$" + (v < 1 ? v.toFixed(4) : v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString());
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const when = t => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

  // ----- sample data (only used when someone clicks "load sample data") -----
  const CHATS = ["Support bot", "Code help", "Research", "Daily brief", "Brainstorm", "Data cleanup"];
  function sample(u) {
    let s = 7 + [...u].reduce((a, c) => a + c.charCodeAt(0), 0); const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const out = [], now = Date.now(), mid = new Date(); mid.setHours(0, 0, 0, 0);
    for (let d = 29; d >= 0; d--) {
      const c = 2 + Math.floor(r() * 6), base = mid.getTime() - d * DAY;
      for (let k = 0; k < c; k++) {
        let t = base + (7 + r() * 14) * 36e5; if (t > now) t = now - Math.floor(r() * 36e5 * 3);
        const slow = r() < .08, err = r() < .04;
        out.push({ t: Math.floor(t), chat: CHATS[Math.floor(r() * CHATS.length)], i: Math.floor(300 + r() * 2800), o: err ? 0 : Math.floor(80 + r() * 1000), ms: Math.floor(400 + r() * 1700 + (slow ? 2200 : 0)), status: err ? "error" : "ok" });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  }

  // ----- who / what the current person can see (the server already filtered the rows; this just slices them) -----
  const people = () => D.ADMIN ? D.users.map(u => ({ user: u.username, role: u.role, quota: u.quota, created: u.created })) : [{ user: D.ME }];
  const logOf = u => D.rows.filter(r => r.user === u);
  const rowsFor = sc => sc === "all" ? D.rows.slice() : D.rows.filter(r => r.user === sc);
  function scope() {
    if (!D.ADMIN) return D.ME;
    const s = ss.get(SCK) || "all";
    return s === "all" || people().some(x => x.user === s) ? s : "all";
  }
  const setScope = v => ss.set(SCK, v);
  const range = () => parseInt(ss.get(RK)) || 14;
  const setRange = v => ss.set(RK, String(v));
  const quotaOf = u => D.ADMIN ? ((D.users.find(z => z.username === u) || {}).quota || cfg.userLim) : ((D.me && D.me.quota) || cfg.userLim);
  const budget = sc => sc === "all" ? cfg.lim : quotaOf(sc);

  // ----- writes (every one goes to the server, which re-checks permissions) -----
  D.addReq = rec => API.post("requests.php?action=add", rec).then(r => { D.rows.push({ t: r.t, user: D.ME, chat: r.chat, i: r.i, o: r.o, ms: r.ms, status: r.status }); return r; });
  D.clearMine = () => API.post("requests.php?action=clear").then(() => { D.rows = D.rows.filter(r => r.user !== D.ME); });
  D.resetSample = async () => {
    const rows = sample(D.ME);
    await API.post("requests.php?action=clear");
    for (let k = 0; k < rows.length; k += 1000) await API.post("requests.php?action=bulk", { rows: rows.slice(k, k + 1000) });
    D.rows = D.rows.filter(r => r.user !== D.ME).concat(rows.map(r => Object.assign({ user: D.ME }, r)));
  };
  const admin = (action, body) => API.post("admin.php?action=" + action, body).then(r => { D.users = r.users || D.users; D.keys = r.keys || D.keys; D.signupOpen = r.signupOpen !== false; return r; });
  D.setRole = (user, role) => admin("setRole", { user, role });
  D.setQuota = (user, quota) => admin("setQuota", { user, quota });
  D.removeUser = user => admin("deleteUser", { user }).then(r => { D.rows = D.rows.filter(x => x.user !== user); return r; });
  D.resetPassword = (user, password) => admin("resetPassword", { user, password });
  D.setSignup = open => admin("setSignup", { open });
  D.createKey = name => admin("createKey", { name });
  D.revokeKey = id => admin("revokeKey", { id });
  let saveTimer;   // settings are saved a moment after you stop typing; resolves with the reply or the error
  D.saveCfg = () => { clearTimeout(saveTimer); return new Promise(res => { saveTimer = setTimeout(() => API.post("admin.php?action=saveConfig", { config: cfg }).then(res, res), 400); }); };

  // ----- time windows + aggregates -----
  function win(rows, days, back) {
    back = back || 0; const m = new Date(); m.setHours(0, 0, 0, 0);
    const end = m.getTime() + DAY - back * DAY, start = end - days * DAY;
    return rows.filter(r => r.t >= start && r.t < end);
  }
  function pc(sorted, p) { if (!sorted.length) return 0; return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(p / 100 * sorted.length) - 1))]; }
  function stats(rows) {
    const n = rows.length, I = rows.reduce((a, r) => a + r.i, 0), O = rows.reduce((a, r) => a + r.o, 0);
    const ms = rows.map(r => r.ms).sort((a, b) => a - b), err = rows.filter(r => r.status === "error").length;
    return { n, I, O, T: I + O, cost: cost(I, O), avg: n ? ms.reduce((a, b) => a + b, 0) / n : 0, p50: pc(ms, 50), p95: pc(ms, 95), p99: pc(ms, 99), err, errRate: n ? err / n * 100 : 0, ms };
  }
  function byDay(rows, days) {
    const m = new Date(); m.setHours(0, 0, 0, 0); const base = m.getTime(), out = [];
    for (let d = days - 1; d >= 0; d--) { const t = base - d * DAY, dt = new Date(t); out.push({ t, label: String(dt.getDate()), date: dt.toLocaleDateString([], { month: "short", day: "numeric" }), i: 0, o: 0, n: 0, err: 0, ms: [] }); }
    rows.forEach(r => { const e = out[Math.floor((r.t - (base - (days - 1) * DAY)) / DAY)]; if (e) { e.i += r.i; e.o += r.o; e.n++; if (r.status === "error") e.err++; e.ms.push(r.ms); } });
    out.forEach(e => { e.cost = cost(e.i, e.o); e.ms.sort((a, b) => a - b); e.rate = e.n ? e.err / e.n * 100 : 0; });
    return out;
  }
  function group(rows, fn) {
    const g = {}; rows.forEach(r => { const k = fn(r); (g[k] || (g[k] = [])).push(r); });
    return Object.keys(g).map(key => { const S = stats(g[key]); return Object.assign({ key, rows: g[key] }, S); }).sort((a, b) => b.T - a.T);
  }
  function byHour(rows) { const h = Array(24).fill(0); rows.forEach(r => { h[new Date(r.t).getHours()] += r.i + r.o; }); return h; }

  // ----- alerts, evaluated live from the logged data in the current scope -----
  function alerts() {
    const out = [], sc = scope(), rows = rowsFor(sc), a = cfg.alerts, B = budget(sc);
    const S30 = stats(win(rows, 30)), pct = S30.T / B * 100, W = stats(win(rows, 7)), noun = sc === "all" ? "System token budget" : "Token quota";
    if (pct >= 100) out.push({ lvl: "crit", title: noun + " exceeded", detail: fmt(S30.T) + " of " + fmt(B) + " used in the last 30 days (" + pct.toFixed(0) + "%)" });
    else if (pct >= a.warn) out.push({ lvl: "warn", title: noun + " nearly used up", detail: fmt(S30.T) + " of " + fmt(B) + " used in the last 30 days (" + pct.toFixed(0) + "%)" });
    if (W.n >= 5 && W.p95 > a.p95) out.push({ lvl: W.p95 > a.p95 * 1.5 ? "crit" : "warn", title: "High latency", detail: "p95 is " + Math.round(W.p95) + " ms over the last 7 days (limit " + a.p95 + " ms)" });
    if (W.n >= 5 && W.errRate > a.err) out.push({ lvl: W.errRate > a.err * 2 ? "crit" : "warn", title: "Elevated error rate", detail: W.errRate.toFixed(1) + "% of requests failed in the last 7 days (limit " + a.err + "%)" });
    if (D.ADMIN && sc === "all") {
      const over = people().filter(x => stats(win(logOf(x.user), 30)).T >= quotaOf(x.user)).map(x => x.user);
      if (over.length) out.push({ lvl: "warn", title: over.length + (over.length > 1 ? " users are" : " user is") + " over quota", detail: over.join(", ") });
    }
    return out;
  }

  // ----- csv -----
  function csv(rows, cols) {
    const q = v => { let s = String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    return [cols.map(c => q(c[0])).join(",")].concat(rows.map(r => cols.map(c => q(c[1](r))).join(","))).join("\n");
  }
  function download(name, text, mime) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/csv" })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  return Object.assign(D, { fmt, cost, money, esc, when, sample, people, logOf, rowsFor, scope, setScope, range, setRange, quotaOf, budget, win, pc, stats, byDay, group, byHour, alerts, csv, download });
})();
