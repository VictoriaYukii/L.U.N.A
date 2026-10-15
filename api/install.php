<?php
declare(strict_types=1);
// Run this once in your browser (http://ai-dashboard.test/api/install.php). It creates the database and tables.
// It is safe to re-run, and it refuses to do anything once the first account exists. Delete this file on a live server.
require __DIR__ . '/inc/lib.php';
header('Content-Type: text/html; charset=utf-8');
set_exception_handler(null);
function page(string $title, string $msg, bool $ok): void {
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install</title>'
       . '<body style="font:15px/1.6 ui-monospace,Consolas,monospace;background:#03060d;color:#dde7f3;max-width:640px;margin:48px auto;padding:0 20px">'
       . '<h2 style="color:' . ($ok ? '#7dffc4' : '#ff5c7a') . '">' . htmlspecialchars($title) . '</h2><p>' . $msg . '</p></body>';
    exit;
}
$name = (string)cfg('db_name');
if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) page('Bad config', 'db_name in api/config.php may only contain letters, numbers and underscores.', false);
try {
    $root = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', cfg('db_host'), cfg('db_port')), cfg('db_user'), cfg('db_pass'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) {
    page('Cannot reach MySQL', 'Start MySQL in Laragon (Start All), then reload this page.<br><br>Check <code>api/config.php</code> if you changed the MySQL user or password.<br><br><small>' . htmlspecialchars($e->getMessage()) . '</small>', false);
}
try {
    $root->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo = db();
    $has = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'")->fetchColumn();
    if ($has && (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
        page('Already installed', 'Accounts already exist, so nothing was changed. <a style="color:#c9d8ea" href="../login.html">Go to the login page</a>. You can delete <code>api/install.php</code> now.', true);
    }
    foreach (array_filter(array_map('trim', preg_split('/;\s*\n/', (string)file_get_contents(__DIR__ . '/../database/schema.sql')))) as $sql) $pdo->exec($sql);
    $pdo->exec("INSERT IGNORE INTO settings (k, v) VALUES ('config', '{}'), ('signup_open', '1')");
} catch (Throwable $e) {
    page('Install failed', htmlspecialchars($e->getMessage()), false);
}
page('Database ready', 'Database <code>' . htmlspecialchars($name) . '</code> and its tables are set up.<br><br><a style="color:#c9d8ea" href="../login.html">Open the login page</a> and create your account. <b>The first account becomes the admin.</b>', true);
