<?php
declare(strict_types=1);
// Your real AI calls this to report each request:  POST /api/ingest.php
//   Authorization: Bearer aimon_xxxxxxxx      (create a key in Settings)
//   {"user":"alice","chat":"Support bot","input_tokens":1200,"output_tokens":450,"latency_ms":900,"status":"ok"}
// or send {"events":[ ... up to 500 of the above ... ]}
require __DIR__ . '/inc/lib.php';
jsonHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);

$hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($hdr === '' && function_exists('getallheaders')) foreach (getallheaders() as $k => $v) if (strtolower($k) === 'authorization') $hdr = $v;
$key = preg_match('/^Bearer\s+(\S+)$/i', $hdr, $m) ? $m[1] : ($_SERVER['HTTP_X_API_KEY'] ?? '');
if ($key === '') fail('missing API key', 401);
$pdo = db();
$s = $pdo->prepare('SELECT id, created_by, revoked FROM api_keys WHERE key_hash = ?');
$s->execute([hash('sha256', $key)]);
$k = $s->fetch();
if (!$k || $k['revoked']) fail('invalid or revoked API key', 401);

$in = body();
$events = isset($in['events']) && is_array($in['events']) ? $in['events'] : [$in];
if (!$events || count($events) > 500) fail('send between 1 and 500 events', 422);

$byName = [];
$find = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$ins = $pdo->prepare('INSERT INTO requests (user_id, ts_ms, chat, input_tokens, output_tokens, latency_ms, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
$pdo->beginTransaction();
foreach ($events as $e) {
    if (!is_array($e)) { $pdo->rollBack(); fail('each event must be an object', 422); }
    $name = strtolower(trim((string)($e['user'] ?? $e['username'] ?? '')));
    if ($name === '') $uid = (int)$k['created_by'];
    else {
        if (!isset($byName[$name])) { $find->execute([$name]); $byName[$name] = $find->fetchColumn(); }
        if ($byName[$name] === false) { $pdo->rollBack(); fail("unknown user: $name", 422); }
        $uid = (int)$byName[$name];
    }
    [$t, $chat, $i, $o, $ms, $status] = cleanRow([
        'chat' => $e['chat'] ?? 'General', 'status' => $e['status'] ?? 'ok',
        'i' => $e['input_tokens'] ?? $e['i'] ?? 0, 'o' => $e['output_tokens'] ?? $e['o'] ?? 0, 'ms' => $e['latency_ms'] ?? $e['ms'] ?? 0,
    ] + (isset($e['timestamp_ms']) ? ['t' => $e['timestamp_ms']] : []));
    $ins->execute([$uid, $t, $chat, $i, $o, $ms, $status, 'api']);
}
$pdo->commit();
$pdo->prepare('UPDATE api_keys SET last_used = NOW() WHERE id = ?')->execute([$k['id']]);
out(['ok' => true, 'inserted' => count($events)]);
