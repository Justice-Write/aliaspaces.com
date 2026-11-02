#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
android="$root/android"
dist="$root/dist"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/android-sdk}}"
# SDK/license installation is an owner setup step, never an implicit build action.
[[ -f "$sdk_root/platforms/android-36/android.jar" ]] || { echo 'Install Android SDK platform 36 first.' >&2; exit 1; }
[[ -x "$sdk_root/build-tools/36.0.0/apksigner" ]] || { echo 'Install Android build-tools 36.0.0 first.' >&2; exit 1; }
[[ -f "$android/gradle/wrapper/gradle-wrapper.jar" ]] || { echo 'Committed Gradle wrapper is missing.' >&2; exit 1; }
[[ -f "$android/debug.keystore" ]] || { echo 'Existing local-demo signing key required; do not generate a replacement.' >&2; exit 1; }
command -v java >/dev/null || { echo 'JDK 17+ is required.' >&2; exit 1; }
export ANDROID_SDK_ROOT="$sdk_root" ANDROID_HOME="$sdk_root"
printf 'sdk.dir=%s\n' "$sdk_root" > "$android/local.properties"
(cd "$android" && bash ./gradlew :app:testDebugUnitTest :app:assembleRelease --no-daemon --console=plain)
version="$(sed -n 's/.*versionName "\([0-9.]*-akasha\)".*/\1/p' "$android/app/build.gradle")"
[[ -n "$version" ]] || { echo 'Version name not found.' >&2; exit 1; }
mkdir -p "$dist"
apk="$dist/AliaSpaces-$version-local-signed.apk"
cp "$android/app/build/outputs/apk/release/app-release.apk" "$apk"
"$sdk_root/build-tools/36.0.0/apksigner" verify --verbose "$apk"
if command -v sha256sum >/dev/null; then (cd "$dist" && sha256sum "$(basename "$apk")" > SHA256SUMS.txt); fi
printf 'Local-demo signed release APK: %s\n' "$apk"
printf 'Before publication, run scripts/verify-apk.ps1 with PowerShell 7 to verify the payload boundary.\n'
