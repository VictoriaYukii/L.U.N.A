<?php
declare(strict_types=1);
require __DIR__ . '/inc/lib.php';
jsonHeaders();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'status' && $method === 'GET') {   // public: lets the login page know what to show
    $n = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
    out(['hasUsers' => $n > 0, 'signupOpen' => $n === 0 || getSetting('signup_open', '1') === '1']);
}
if ($method !== 'POST') fail('POST required', 405);

if ($action === 'signup') {
    $in = body();
    $name = strtolower(trim((string)($in['username'] ?? '')));
    $pw = (string)($in['password'] ?? '');
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $name)) fail('username: 3-20 letters, numbers or _', 422);
    validPassword($pw);
    if (failCount('signup', 'ip', clientIp(), 3600) >= 10) fail('too many sign-ups from this address, try again later', 429);
    $pdo = db();
    $pdo->beginTransaction();
    $n = (int)$pdo->query('SELECT COUNT(*) FROM users FOR UPDATE')->fetchColumn();
    if ($n > 0 && getSetting('signup_open', '1') !== '1') { $pdo->rollBack(); fail('sign-ups are closed. Ask an admin for an account', 403); }
    try {
        $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
            ->execute([$name, password_hash($pw, PASSWORD_DEFAULT), $n === 0 ? 'admin' : 'user']);   // the very first account is the admin
    } catch (PDOException $e) {
        $pdo->rollBack();
        if ($e->getCode() === '23000') fail('that username is already taken', 409);
        throw $e;
    }
    $id = (int)$pdo->lastInsertId();
    $pdo->commit();
    recordAttempt('signup');
    beginLogin($id, !empty($in['remember']));
    $s = $pdo->prepare('SELECT username, role, quota, created_at FROM users WHERE id = ?');
    $s->execute([$id]);
    out(['user' => pubUser($s->fetch()), 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'login') {
    $in = body();
    $name = strtolower(trim((string)($in['username'] ?? '')));
    $pw = (string)($in['password'] ?? '');
    if (failCount('login', 'ip', clientIp(), 600) >= 20 || ($name !== '' && failCount('login', 'username', $name, 600) >= 6)) {
        fail('too many attempts, try again in a few minutes', 429);
    }
    $s = db()->prepare('SELECT id, username, password_hash, role, quota, created_at FROM users WHERE username = ?');
    $s->execute([$name]);
    $row = $s->fetch();
    $ok = password_verify($pw, $row['password_hash'] ?? password_hash('dummy-value', PASSWORD_DEFAULT));   // same work whether or not the user exists
    if (!$row || !$ok) { recordAttempt('login', $name); fail('invalid username or password', 401); }
    if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), $row['id']]);
    }
    db()->prepare("DELETE FROM login_attempts WHERE kind = 'login' AND username = ?")->execute([$name]);
    beginLogin((int)$row['id'], !empty($in['remember']));
    out(['user' => pubUser($row), 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'logout') { endSession(); out(['ok' => true]); }

if ($action === 'password') {
    $u = requireLogin(true);
    $in = body();
    $s = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
    $s->execute([$u['id']]);
    if (!password_verify((string)($in['old'] ?? ''), (string)$s->fetchColumn())) fail('current password is incorrect', 403);
    validPassword((string)($in['new'] ?? ''));
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash((string)$in['new'], PASSWORD_DEFAULT), $u['id']]);
    session_regenerate_id(true);
    out(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

fail('unknown action', 404);
