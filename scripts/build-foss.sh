#!/usr/bin/env bash
# Builds the F-Droid / IzzyOnDroid APK: no Google code, no push, no over-the-air updates (see app.config.js).
#
#   scripts/build-foss.sh                     → dist/pugdon-<version>-foss-debugsigned.apk (to try on a phone)
#   PUGDOM_KEYSTORE=~/keys/pugdon-foss.jks scripts/build-foss.sh
#                                             → dist/pugdon-<version>-foss.apk, signed with your key (asks its password)
#
# Prebuild rewrites the git-ignored android/ folder, so it's put back to the normal (Play) setup at the end.
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_NO_GIT_STATUS=1

version=$(node -p "require('./app.json').expo.version")
archs=${PUGDOM_ARCHS:-arm64-v8a,armeabi-v7a}
saved_props=$(mktemp)
[ -f android/local.properties ] && cp android/local.properties "$saved_props"

restore() {
    echo "› Putting android/ back to the normal build"
    PUGDOM_FOSS= npx expo prebuild --platform android --clean --no-install > /dev/null
    [ -s "$saved_props" ] && cp "$saved_props" android/local.properties
    rm -f "$saved_props"
}
trap restore EXIT

echo "› Prebuilding the F-Droid build of $version"
PUGDOM_FOSS=1 npx expo prebuild --platform android --clean --no-install
[ -s "$saved_props" ] && cp "$saved_props" android/local.properties

echo "› Building ($archs)"
# More memory than gradle.properties gives: with the default 512 MB Metaspace, R8 runs out and the build hangs
(cd android && PUGDOM_FOSS=1 ./gradlew --no-daemon assembleRelease -PreactNativeArchitectures="$archs" \
    -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g")
apk=android/app/build/outputs/apk/release/app-release.apk

# Those stores reject Google's libraries: stop if any came back in
if unzip -p "$apk" 'classes*.dex' | grep -aq 'Lcom/google/firebase/\|Lcom/google/android/gms/'; then
    echo "✗ The APK has Google (Firebase / Play Services) code in it" >&2
    exit 1
fi
if unzip -p "$apk" AndroidManifest.xml | LC_ALL=C tr -d '\0' | grep -aq 'finsky\|firebase'; then
    echo "✗ The APK's manifest asks for Google Play or Firebase" >&2
    exit 1
fi

mkdir -p dist
if [ -n "${PUGDOM_KEYSTORE:-}" ]; then
    out=dist/pugdon-$version-foss.apk
    apksigner=$(ls -d "${ANDROID_HOME:?set ANDROID_HOME}"/build-tools/*/apksigner | sort -V | tail -1)
    "$apksigner" sign --ks "$PUGDOM_KEYSTORE" --ks-key-alias "${PUGDOM_KEY_ALIAS:-pugdon}" --out "$out" "$apk"
    rm -f "$out.idsig"
else
    out=dist/pugdon-$version-foss-debugsigned.apk
    cp "$apk" "$out"
fi
echo "✓ $out"
