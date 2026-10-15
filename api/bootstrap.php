<?php
declare(strict_types=1);
require __DIR__ . '/inc/lib.php';
jsonHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('GET required', 405);
$u = requireLogin();
$out = ['me' => pubUser($u), 'csrf' => $_SESSION['csrf']];
if (isset($_GET['light'])) out($out);

const MAX_ROWS = 50000;
$since = (int)((time() - 65 * 86400) * 1000);   // 30 days + the 30 before it, for "vs previous period"
$admin = $u['role'] === 'admin';
$sql = 'SELECT r.ts_ms, u.username, r.chat, r.input_tokens, r.output_tokens, r.latency_ms, r.status FROM requests r JOIN users u ON u.id = r.user_id WHERE r.ts_ms >= ?'
     . ($admin ? '' : ' AND r.user_id = ?') . ' ORDER BY r.ts_ms DESC LIMIT ' . (MAX_ROWS + 1);
$s = db()->prepare($sql);
$s->execute($admin ? [$since] : [$since, $u['id']]);
$rows = [];
while ($r = $s->fetch()) $rows[] = [(int)$r['ts_ms'], $r['username'], $r['chat'], (int)$r['input_tokens'], (int)$r['output_tokens'], (int)$r['latency_ms'], $r['status'] === 'error' ? 1 : 0];
$truncated = count($rows) > MAX_ROWS;
if ($truncated) array_pop($rows);

$cfg = json_decode(getSetting('config', '{}') ?? '{}', true);
$out += ['config' => is_array($cfg) ? $cfg : [], 'rows' => $rows, 'truncated' => $truncated, 'serverTime' => (int)(microtime(true) * 1000)];
if ($admin) $out += ['users' => listUsers(), 'keys' => listKeys(), 'signupOpen' => getSetting('signup_open', '1') === '1'];
out($out);
