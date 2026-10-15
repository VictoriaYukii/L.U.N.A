<?php
declare(strict_types=1);
require __DIR__ . '/inc/lib.php';
jsonHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);
$u = requireLogin(true);       // you can only ever write to your own account
$in = body();
$action = $_GET['action'] ?? '';
$ins = 'INSERT INTO requests (user_id, ts_ms, chat, input_tokens, output_tokens, latency_ms, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

if ($action === 'add') {
    [$t, $chat, $i, $o, $ms, $status] = cleanRow($in);
    db()->prepare($ins)->execute([$u['id'], $t, $chat, $i, $o, $ms, $status, 'manual']);
    out(['t' => $t, 'chat' => $chat, 'i' => $i, 'o' => $o, 'ms' => $ms, 'status' => $status]);
}
if ($action === 'bulk') {
    $rows = $in['rows'] ?? null;
    if (!is_array($rows) || count($rows) > 2000) fail('send up to 2000 rows', 422);
    $pdo = db();
    $pdo->beginTransaction();
    $st = $pdo->prepare($ins);
    foreach ($rows as $r) {
        if (!is_array($r)) { $pdo->rollBack(); fail('each row must be an object', 422); }
        [$t, $chat, $i, $o, $ms, $status] = cleanRow($r);
        $st->execute([$u['id'], $t, $chat, $i, $o, $ms, $status, 'manual']);
    }
    $pdo->commit();
    out(['inserted' => count($rows)]);
}
if ($action === 'clear') {
    $s = db()->prepare('DELETE FROM requests WHERE user_id = ?');
    $s->execute([$u['id']]);
    out(['deleted' => $s->rowCount()]);
}
fail('unknown action', 404);
