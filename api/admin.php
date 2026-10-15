<?php
declare(strict_types=1);
require __DIR__ . '/inc/lib.php';
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'export' && $method === 'GET') {          // CSV of every request (admin only)
    requireAdmin(false);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="requests.csv"');
    header('X-Content-Type-Options: nosniff');
    $q = fn($v) => '"' . str_replace('"', '""', preg_match('/^[=+\-@]/', (string)$v) ? "'" . $v : (string)$v) . '"';
    echo "time,user,chat,input_tokens,output_tokens,latency_ms,status,source\n";
    $s = db()->query('SELECT r.ts_ms, u.username, r.chat, r.input_tokens, r.output_tokens, r.latency_ms, r.status, r.source FROM requests r JOIN users u ON u.id = r.user_id ORDER BY r.ts_ms');
    while ($r = $s->fetch()) echo implode(',', [$q(gmdate('c', intdiv((int)$r['ts_ms'], 1000))), $q($r['username']), $q($r['chat']), $r['input_tokens'], $r['output_tokens'], $r['latency_ms'], $q($r['status']), $q($r['source'])]), "\n";
    exit;
}

jsonHeaders();
if ($method !== 'POST') fail('POST required', 405);
$me = requireAdmin(true);        // signed in + admin + valid CSRF token, checked on the server for every action
$in = body();
$pdo = db();
$reply = fn() => out(['ok' => true, 'users' => listUsers(), 'keys' => listKeys(), 'signupOpen' => getSetting('signup_open', '1') === '1']);

function target(PDO $pdo, $name): array {
    $s = $pdo->prepare('SELECT id, username, role FROM users WHERE username = ?');
    $s->execute([strtolower(trim((string)$name))]);
    return $s->fetch() ?: fail('no such user', 404);
}
function cleanConfig(array $in): array {
    $o = [];
    foreach (['name' => 60, 'model' => 80, 'provider' => 80, 'version' => 40, 'prompt' => 8000] as $k => $max) {
        if (array_key_exists($k, $in)) { if (!is_string($in[$k])) fail("$k must be text", 422); $o[$k] = mb_substr($in[$k], 0, $max); }
    }
    foreach (['ctx', 'temp', 'max', 'pi', 'po', 'lim', 'userLim'] as $k) {
        if (array_key_exists($k, $in)) {
            if (!is_numeric($in[$k]) || $in[$k] < 0 || $in[$k] > 1e12) fail("$k must be a number, 0 or more", 422);
            if (in_array($k, ['lim', 'userLim'], true) && $in[$k] <= 0) fail("$k must be greater than 0", 422);
            $o[$k] = $in[$k] + 0;
        }
    }
    if (isset($in['alerts']) && is_array($in['alerts'])) {
        foreach (['warn', 'p95', 'err'] as $k) {
            if (array_key_exists($k, $in['alerts'])) {
                $v = $in['alerts'][$k];
                if (!is_numeric($v) || $v < 0 || $v > 1e7) fail("alert $k must be a number", 422);
                $o['alerts'][$k] = $v + 0;
            }
        }
    }
    return $o;
}

switch ($action) {
    case 'setRole':
        $t = target($pdo, $in['user'] ?? '');
        $role = $in['role'] ?? '';
        if (!in_array($role, ['admin', 'user'], true)) fail('invalid role', 422);
        $pdo->beginTransaction();
        $admins = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' FOR UPDATE")->fetchColumn();
        if ($t['role'] === 'admin' && $role === 'user' && $admins <= 1) { $pdo->rollBack(); fail('there must be at least one admin', 409); }
        $pdo->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $t['id']]);
        $pdo->commit();
        $reply();
    case 'setQuota':
        $t = target($pdo, $in['user'] ?? '');
        $q = $in['quota'] ?? null;
        if ($q === null || $q === '' || $q === 0) $q = null;
        else { if (!is_numeric($q) || $q < 1 || $q > 1e12) fail('quota must be a positive number', 422); $q = (int)$q; }
        $pdo->prepare('UPDATE users SET quota = ? WHERE id = ?')->execute([$q, $t['id']]);
        $reply();
    case 'deleteUser':
        $t = target($pdo, $in['user'] ?? '');
        if ((int)$t['id'] === (int)$me['id']) fail("you can't delete your own account", 409);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$t['id']]);    // their requests go with them
        $reply();
    case 'resetPassword':
        $t = target($pdo, $in['user'] ?? '');
        validPassword((string)($in['password'] ?? ''));
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash((string)$in['password'], PASSWORD_DEFAULT), $t['id']]);
        $reply();
    case 'saveConfig':
        $cur = json_decode(getSetting('config', '{}') ?? '{}', true);
        setSetting('config', json_encode(array_replace_recursive(is_array($cur) ? $cur : [], cleanConfig((array)($in['config'] ?? [])))));
        $reply();
    case 'setSignup':
        setSetting('signup_open', !empty($in['open']) ? '1' : '0');
        $reply();
    case 'createKey':
        $name = trim((string)($in['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 60) fail('give the key a name (up to 60 characters)', 422);
        $key = 'aimon_' . bin2hex(random_bytes(20));
        $pdo->prepare('INSERT INTO api_keys (name, key_hash, prefix, created_by) VALUES (?, ?, ?, ?)')->execute([$name, hash('sha256', $key), substr($key, 0, 12), $me['id']]);
        out(['ok' => true, 'key' => $key, 'users' => listUsers(), 'keys' => listKeys(), 'signupOpen' => getSetting('signup_open', '1') === '1']);   // the full key is shown only this once
    case 'revokeKey':
        $pdo->prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?')->execute([(int)($in['id'] ?? 0)]);
        $reply();
}
fail('unknown action', 404);
