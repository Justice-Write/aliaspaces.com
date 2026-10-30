param([string]$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot
$androidRoot = Join-Path $appRoot 'android'
if (-not (Test-Path -LiteralPath "$SdkRoot\platforms\android-36\android.jar")) { throw 'Install Android SDK platform 36 before building.' }
if (-not (Test-Path -LiteralPath "$androidRoot\debug.keystore")) { throw 'The existing local-demo signing key is required to preserve upgrade compatibility.' }
$originalJavaOptions = $env:JAVA_TOOL_OPTIONS
$originalAndroidHome = $env:ANDROID_HOME
$originalSdkRoot = $env:ANDROID_SDK_ROOT
try {
    $env:ANDROID_HOME = $SdkRoot
    $env:ANDROID_SDK_ROOT = $SdkRoot
    # Windows JDK Unix-domain sockets cannot use a temp path containing spaces.
    $socketTemp = Join-Path $env:ProgramData 'AliaSpacesJavaTemp'
    New-Item -ItemType Directory -Force -Path $socketTemp | Out-Null
    if ($socketTemp.Contains(' ')) { throw 'Use a ProgramData path without spaces for JDK sockets.' }
    $env:JAVA_TOOL_OPTIONS = "$originalJavaOptions -Djdk.net.unixdomain.tmpdir=$socketTemp"
    Set-Content -LiteralPath "$androidRoot\local.properties" -Value ('sdk.dir=' + $SdkRoot.Replace('\','/'))
    Push-Location $androidRoot
    try {
        & java -Xmx64m -Xms64m -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain :app:testDebugUnitTest :app:assembleRelease --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android tests/build failed.' }
    } finally { Pop-Location }
    $dist = Join-Path $appRoot 'dist'
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    $gradle = Get-Content -LiteralPath "$androidRoot\app\build.gradle" -Raw
    $version = [regex]::Match($gradle, 'versionName "([0-9.]+-akasha)"').Groups[1].Value
    if (-not $version) { throw 'Android versionName was not found.' }
    $apk = Join-Path $dist "AliaSpaces-$version-local-signed.apk"
    Copy-Item -LiteralPath "$androidRoot\app\build\outputs\apk\release\app-release.apk" -Destination $apk
    & "$SdkRoot\build-tools\36.0.0\apksigner.bat" verify --verbose $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    & "$PSScriptRoot\verify-apk.ps1" -Apk $apk
    if (-not $?) { throw 'APK payload verification failed.' }
    $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$dist\SHA256SUMS.txt" -Value "$hash  $(Split-Path $apk -Leaf)" -Encoding ascii
    Write-Output "Local-demo signed release APK: $apk"
    Write-Output "SHA256: $hash"
} finally {
    $env:JAVA_TOOL_OPTIONS = $originalJavaOptions
    $env:ANDROID_HOME = $originalAndroidHome
    $env:ANDROID_SDK_ROOT = $originalSdkRoot
}
