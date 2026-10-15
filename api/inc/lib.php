<?php
declare(strict_types=1);
ini_set('display_errors', '0');
$GLOBALS['AIMON_CONFIG'] = require __DIR__ . '/../config.php';

// Small fallbacks so the app also runs on hosts without the mbstring extension.
if (!function_exists('mb_substr')) {
    function mb_substr(string $s, int $start, ?int $len = null): string { return implode('', array_slice(preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: [], $start, $len)); }
}
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $s): int { return count(preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: []); }
}

function cfg(string $k, $d = null) { return $GLOBALS['AIMON_CONFIG'][$k] ?? $d; }

set_exception_handler(function (Throwable $e) {
    error_log('[ai-monitor] ' . $e->getMessage());
    $m = $e->getMessage();
    if ($e instanceof PDOException && (str_contains($m, '[2002]') || str_contains($m, '[1049]') || str_contains($m, '[1045]'))) {
        $msg = "can't reach the database. Start MySQL in Laragon, then open api/install.php once";
    } elseif ($e instanceof PDOException && str_contains($m, '1146')) {
        $msg = 'database tables are missing. Open api/install.php once';
    } else {
        $msg = cfg('debug') ? $m : 'server error (see the PHP error log)';
    }
    if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode(['error' => $msg]);
    exit;
});

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', cfg('db_host'), cfg('db_port'), cfg('db_name'));
    $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function jsonHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
}
function out($data, int $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function fail(string $msg, int $code = 400) { out(['error' => $msg], $code); }

function body(): array {
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === false) fail('content-type must be application/json', 415);
    $raw = (string)file_get_contents('php://input');
    if ($raw === '') return [];
    if (strlen($raw) > 2_000_000) fail('request too large', 413);
    $j = json_decode($raw, true);
    if (!is_array($j)) fail('invalid JSON', 400);
    return $j;
}

// ---------- sessions ----------
function isHttps(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (cfg('trust_proxy') && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}
function cookiePath(): string {   // scope cookies to the app folder so other sites on the same host don't see them
    $p = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x.php'))), '/');
    return $p . '/';
}
function cookieOpts(): array {
    return ['path' => cookiePath(), 'secure' => isHttps(), 'httponly' => true, 'samesite' => 'Lax'];
}
function startSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $days = (int)cfg('session_days', 30);
    ini_set('session.gc_maxlifetime', (string)($days * 86400));
    ini_set('session.use_strict_mode', '1');
    session_name('aimon');
    session_set_cookie_params(['lifetime' => isset($_COOKIE['aimon_r']) ? $days * 86400 : 0] + cookieOpts());
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
function beginLogin(int $uid, bool $remember): void {
    $days = (int)cfg('session_days', 30);
    if ($remember) { setcookie('aimon_r', '1', ['expires' => time() + $days * 86400] + cookieOpts()); $_COOKIE['aimon_r'] = '1'; }
    else { setcookie('aimon_r', '', ['expires' => 1] + cookieOpts()); unset($_COOKIE['aimon_r']); }
    startSession();
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
function endSession(): void {
    startSession();
    $_SESSION = [];
    session_destroy();
    setcookie('aimon', '', ['expires' => 1] + cookieOpts());
    setcookie('aimon_r', '', ['expires' => 1] + cookieOpts());
}
function currentUser(): ?array {
    if (!isset($_COOKIE['aimon'])) return null;   // no session cookie, so nobody is signed in (and we don't create junk sessions)
    startSession();
    $id = $_SESSION['uid'] ?? null;
    if (!$id) return null;
    $s = db()->prepare('SELECT id, username, role, quota, created_at FROM users WHERE id = ?');
    $s->execute([$id]);
    $u = $s->fetch();
    if (!$u) { $_SESSION = []; return null; }
    return $u;
}
function requireCsrf(): void {
    $t = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals((string)($_SESSION['csrf'] ?? ''), $t)) fail('security token missing or expired, reload the page', 403);
}
function requireLogin(bool $csrf = false): array {
    $u = currentUser();
    if (!$u) fail('not signed in', 401);
    if ($csrf) requireCsrf();
    return $u;
}
function requireAdmin(bool $csrf = true): array {
    $u = requireLogin($csrf);
    if ($u['role'] !== 'admin') fail('admins only', 403);
    return $u;
}
function pubUser(array $u): array {
    return ['username' => $u['username'], 'role' => $u['role'], 'quota' => $u['quota'] !== null ? (int)$u['quota'] : null, 'created' => strtotime((string)$u['created_at']) * 1000];
}

// ---------- settings + rate limiting ----------
function getSetting(string $k, ?string $d = null): ?string {
    $s = db()->prepare('SELECT v FROM settings WHERE k = ?');
    $s->execute([$k]);
    $v = $s->fetchColumn();
    return $v === false ? $d : (string)$v;
}
function setSetting(string $k, string $v): void {
    db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')->execute([$k, $v]);
}
function clientIp(): string {
    if (cfg('trust_proxy') && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
function failCount(string $kind, string $col, string $val, int $window): int {
    if (!in_array($col, ['ip', 'username'], true)) throw new InvalidArgumentException('bad column');
    $s = db()->prepare("SELECT COUNT(*) FROM login_attempts WHERE kind = ? AND $col = ? AND ts >= ?");
    $s->execute([$kind, $val, time() - $window]);
    return (int)$s->fetchColumn();
}
function recordAttempt(string $kind, string $name = ''): void {
    db()->prepare('INSERT INTO login_attempts (kind, ip, username, ts) VALUES (?, ?, ?, ?)')->execute([$kind, clientIp(), $name, time()]);
    if (random_int(1, 50) === 1) db()->prepare('DELETE FROM login_attempts WHERE ts < ?')->execute([time() - 86400]);
}

// ---------- validation ----------
function validPassword(string $pw): void {
    if (strlen($pw) < 8 || strlen($pw) > 72) fail('password must be 8 to 72 characters', 422);
}
function intField($v, string $name, int $max): int {
    if (is_string($v) && is_numeric($v)) $v = $v + 0;
    if (!is_int($v) && !(is_float($v) && is_finite($v))) fail("$name must be a number", 422);
    $v = (int)round($v);
    if ($v < 0 || $v > $max) fail("$name is out of range", 422);
    return $v;
}
// Turns one incoming request record into a clean [ts_ms, chat, in, out, ms, status] row.
function cleanRow(array $r): array {
    $chat = trim((string)($r['chat'] ?? 'General'));
    $chat = mb_substr($chat === '' ? 'General' : $chat, 0, 40);
    $status = ($r['status'] ?? 'ok') === 'error' ? 'error' : 'ok';
    $now = (int)(microtime(true) * 1000);
    $t = isset($r['t']) ? intField($r['t'], 't', 4_000_000_000_000) : $now;
    if ($t < $now - 400 * 86400000 || $t > $now + 300000) fail('timestamp is outside the allowed range', 422);
    return [$t, $chat, intField($r['i'] ?? 0, 'input tokens', 100_000_000), intField($r['o'] ?? 0, 'output tokens', 100_000_000), intField($r['ms'] ?? 0, 'latency', 3_600_000), $status];
}
function listUsers(): array {
    return array_map('pubUser', db()->query('SELECT username, role, quota, created_at FROM users ORDER BY created_at, id')->fetchAll());
}
function listKeys(): array {
    $rows = db()->query('SELECT id, name, prefix, created_at, last_used, revoked FROM api_keys ORDER BY id DESC')->fetchAll();
    return array_map(fn($k) => ['id' => (int)$k['id'], 'name' => $k['name'], 'prefix' => $k['prefix'], 'created' => strtotime((string)$k['created_at']) * 1000,
        'lastUsed' => $k['last_used'] ? strtotime((string)$k['last_used']) * 1000 : null, 'revoked' => (bool)$k['revoked']], $rows);
}
