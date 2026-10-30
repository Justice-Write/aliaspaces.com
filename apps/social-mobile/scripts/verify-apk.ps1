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
    $forbidden = @($archive.Entries | Where-Object { $_.FullName -match '(^|/)(status-handoff\.md|\.env[^/]*|debug\.keystore|local\.properties|node_modules|evidence|fixtures)(/|$)' })
    if ($forbidden.Count) { throw 'APK contains development or private material.' }
    Write-Output "APK payload verified: $($entries.Count) allowlisted web files match source SHA256; no handoff, environment, signing key, fixtures or evidence."
} finally { $archive.Dispose() }
