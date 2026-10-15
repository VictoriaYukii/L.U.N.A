/* api.js — talks to the PHP backend (api/*.php). Sessions live in a secure cookie; no passwords or data are kept in the browser. */
const API = (function () {
  let csrf = "";
  async function call(method, path, body) {
    let res;
    try {
      res = await fetch("api/" + path, {
        method, credentials: "same-origin",
        headers: Object.assign({ Accept: "application/json" }, body !== undefined ? { "Content-Type": "application/json", "X-CSRF-Token": csrf } : {}),
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw Object.assign(new Error("can't reach the backend"), { network: true }); }
    let j = null; try { j = await res.json(); } catch (e) {}
    if (res.status === 401 && !path.startsWith("auth.php") && !path.startsWith("bootstrap.php?light") && !/login\.html$/.test(location.pathname)) {
      location.replace("login.html");
      throw Object.assign(new Error("signed out"), { status: 401 });
    }
    if (!res.ok) throw Object.assign(new Error((j && j.error) || (res.status === 404 ? "backend not found. Open the site through Laragon (http://ai-dashboard.test), not as a file" : "server error (" + res.status + ")")), { status: res.status, network: res.status === 404 });
    if (j && j.csrf) csrf = j.csrf;
    return j;
  }
  return { get: p => call("GET", p), post: (p, b) => call("POST", p, b === undefined ? {} : b) };
})();

const Auth = {
  status: () => API.get("auth.php?action=status"),
  check: () => API.get("bootstrap.php?light=1").then(j => j.me, () => null),
  signup: (u, p, remember) => API.post("auth.php?action=signup", { username: u, password: p, remember: !!remember }),
  login: (u, p, remember) => API.post("auth.php?action=login", { username: u, password: p, remember: !!remember }),
  changePassword: (oldPw, newPw) => API.post("auth.php?action=password", { old: oldPw, new: newPw }),
  logout: async () => { try { await API.post("auth.php?action=logout"); } catch (e) {} location.replace("login.html"); }
};
