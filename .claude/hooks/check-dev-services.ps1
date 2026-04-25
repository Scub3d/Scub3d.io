function Test-TcpPort($Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        if ($task.Wait(500)) { $client.Close(); return $true }
        $client.Close()
    } catch { }
    return $false
}

$functionsUp = Test-TcpPort 2053
$storageUp   = Test-TcpPort 9199
$arServerUp  = Test-TcpPort 8765

$storageSeeded = $null
if ($storageUp) {
    try {
        $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:9199/storage/v1/b/dynamic.scub3d.io/o?maxResults=1' -TimeoutSec 2 -ErrorAction Stop
        $storageSeeded = [bool]$resp.items
    } catch {
        $storageSeeded = $false
    }
}

$lines = @()
$lines += "Firebase functions emulator (port 2053): $(if ($functionsUp) { 'UP' } else { 'DOWN' })"
$lines += "Firebase storage emulator (port 9199): $(if ($storageUp) { 'UP' } else { 'DOWN' })"
$lines += "AR test server (port 8765): $(if ($arServerUp) { 'UP' } else { 'DOWN' })"
if ($storageUp) {
    $seedStatus = if ($storageSeeded) { 'seeded' } else { 'empty (run: cd functions && npm run seed-emulator)' }
    $lines += "Storage bucket dynamic.scub3d.io: $seedStatus"
}

$hint = if (-not $functionsUp -or -not $storageUp) {
    "`nStart emulator: cd functions && npm run serve (runs on ports 2053 + 9199)."
} else { "" }
if (-not $arServerUp) {
    $hint += "`nStart AR test server: python tooling/serve_ar_test.py (http://localhost:8765)."
}

$context = "Local dev services status:`n" + ($lines -join "`n") + $hint

$out = @{
    hookSpecificOutput = @{
        hookEventName     = 'SessionStart'
        additionalContext = $context
    }
}

$out | ConvertTo-Json -Depth 5 -Compress
