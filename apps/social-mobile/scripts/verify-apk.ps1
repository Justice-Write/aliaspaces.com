param([Parameter(Mandatory)][string]$Apk)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$appRoot = Split-Path $PSScriptRoot
$expected = @('index.html', 'live.html', 'pantry.html', 'akasha.html', 'error.html')
$expected += @(Get-ChildItem -LiteralPath "$appRoot\src" -File -Recurse | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($appRoot, $_.FullName).Replace('\','/')
    if ($_.Extension -notin @('.js', '.css')) { throw "Unexpected source payload type: $relative" }
    $relative
})
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Apk))
try {
    $entries = @($archive.Entries | Where-Object { $_.FullName.StartsWith('assets/www/') -and $_.Name })
    $actual = @($entries | ForEach-Object { $_.FullName.Substring('assets/www/'.Length) })
    if (@(Compare-Object ($expected | Sort-Object) ($actual | Sort-Object)).Count) { throw 'APK web payload differs from the explicit source allowlist.' }
    foreach ($entry in $entries) {
        $relative = $entry.FullName.Substring('assets/www/'.Length)
        $stream = $entry.Open()
        try {
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $packedHash = [Convert]::ToHexString($sha.ComputeHash($stream)) } finally { $sha.Dispose() }
        } finally { $stream.Dispose() }
        if ($packedHash -ne (Get-FileHash -LiteralPath (Join-Path $appRoot $relative) -Algorithm SHA256).Hash) { throw "Stale packaged web asset: $relative" }
    }
    foreach ($entry in $archive.Entries | Where-Object { $_.FullName.StartsWith('assets/') -and -not $_.FullName.StartsWith('assets/www/') -and $_.Name }) {
        if ($entry.FullName -in @('assets/dexopt/baseline.prof', 'assets/dexopt/baseline.profm')) { continue }
        if ($entry.FullName -ne 'assets/app-guide.json') { throw "Unexpected native asset: $($entry.FullName)" }
        $stream = $entry.Open()
        try {
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $packedHash = [Convert]::ToHexString($sha.ComputeHash($stream)) } finally { $sha.Dispose() }
        } finally { $stream.Dispose() }
        if ($packedHash -ne (Get-FileHash -LiteralPath "$appRoot\android\app\src\main\assets\app-guide.json" -Algorithm SHA256).Hash) { throw 'Packaged app guide differs from source.' }
    }
    $forbidden = @($archive.Entries | Where-Object { $_.FullName -match '(^|/)(status-handoff\.md|\.env[^/]*|debug\.keystore|local\.properties|node_modules|evidence|fixtures)(/|$)' })
    if ($forbidden.Count) { throw 'APK contains development or private material.' }
    if (@($archive.Entries | Where-Object { $_.FullName -match '\.(tar|bak|sqlite|db|backup)$|akasha-test-|PhoneAcceptance|private-app-data' }).Count) { throw 'APK contains a personal-data archive, database or acceptance fixture.' }
    Write-Output "APK payload verified: $($entries.Count) allowlisted web files match source SHA256; native assets allowlisted; no personal archives, handoffs, environment, signing keys, fixtures or evidence."
} finally { $archive.Dispose() }
