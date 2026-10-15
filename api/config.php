<?php
// Database + app settings. The defaults match a fresh Laragon install (MySQL user "root", no password).
// On a real server, change these (or set the AIMON_* environment variables) and use a strong password.
return [
    'db_host' => getenv('AIMON_DB_HOST') ?: '127.0.0.1',
    'db_port' => (int)(getenv('AIMON_DB_PORT') ?: 3306),
    'db_name' => getenv('AIMON_DB_NAME') ?: 'ai_monitor',
    'db_user' => getenv('AIMON_DB_USER') ?: 'root',
    'db_pass' => getenv('AIMON_DB_PASS') !== false ? getenv('AIMON_DB_PASS') : '',
    'session_days' => 30,        // how long "keep me signed in" lasts
    'trust_proxy' => false,      // set true only if you run behind a proxy that sets X-Forwarded-For
    'debug' => false,            // true shows raw error messages in API responses (development only)
];
