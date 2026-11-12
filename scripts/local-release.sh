#!/usr/bin/env bash
#
# Builds the production Android App Bundle (AAB) on this machine, set up like an EAS production
# build. Run it with `yarn release:android:local`.
#
# Why local: on the EAS free plan every Android build runs on a 4 vCPU, 15.6 GB machine, and the
# native libraries (Skia, Reanimated, worklets, MMKV, expo-modules-core) run it out of memory (the
# Gradle daemon is killed during the C++ compile: EAS_BUILD_UNKNOWN_GRADLE_ERROR). A local build
# takes about 6 minutes on a 32 GB Mac and uses no EAS build credits.
#
# What it does:
#   1. Exports the EAS "production" variables (the plain text and sensitive ones; `eas env:pull`
#      writes them to a temporary file that is deleted at the end).
#   2. Moves the local .env aside for the build, so nothing that is only in .env (for example
#      NOTIFICATION_SERVER_URL, which must never ship) is baked into the JavaScript bundle. The
#      .env file is always put back.
#   3. Takes SENTRY_AUTH_TOKEN from the local .env (it is a secret variable on EAS, which cannot be
#      pulled), so the source maps and the R8 mapping are uploaded to Sentry as on EAS.
#   4. Regenerates android/ with `expo prebuild --clean`, then runs `./gradlew bundleRelease`,
#      signed with credentials/android (the upload key).
#   5. Checks the result: the signing certificate, the ABIs, and that the notification server
#      address is not in the bundle.
#
# Needs: the EAS CLI logged in, JDK 17, the Android SDK, credentials/android/keystore.properties
# and its keystore, google-services.json at the repo root, and SENTRY_AUTH_TOKEN in .env.
# Run `yarn version:bump` first if the versionCode must be new (Play rejects a repeated one).
# Prints no secret values.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# SHA-1 of the Play upload key (the project guidance file, section 1).
UPLOAD_KEY_SHA1="3D:59:93:EA:7E:7B:0A:00:C6:80:B4:58:4E:79:DA:08:4E:53:5D:FD"
AAB="android/app/build/outputs/bundle/release/app-release.aab"
ENVTMP="$(mktemp -t trackaexpense-prod-env.XXXXXX)"
ENV_BACKUP=".env.release-bak"

cleanup() {
  if [ -f "$ENV_BACKUP" ]; then mv "$ENV_BACKUP" .env; fi
  rm -f "$ENVTMP"
  echo "cleanup done: .env restored, temporary env file removed"
}
trap cleanup EXIT

if [ ! -f .env ]; then echo "no .env file"; exit 1; fi
if [ -f "$ENV_BACKUP" ]; then
  echo "$ENV_BACKUP exists from an interrupted run: restore it to .env first"
  trap - EXIT
  rm -f "$ENVTMP"
  exit 1
fi

SENTRY_AUTH_TOKEN="$(grep '^SENTRY_AUTH_TOKEN=' .env | cut -d= -f2- | tr -d "\"'")"
export SENTRY_AUTH_TOKEN
if [ -z "$SENTRY_AUTH_TOKEN" ]; then echo "no SENTRY_AUTH_TOKEN in .env"; exit 1; fi

echo "step 1: pulling the EAS production variables"
eas env:pull production --path "$ENVTMP" --non-interactive >/dev/null 2>&1 || {
  echo "could not pull the EAS production variables (is the EAS CLI logged in?)"
  exit 1
}
chmod 600 "$ENVTMP"
eval "$(node -e '
const fs = require("fs");
for (const line of fs.readFileSync(process.argv[1], "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  const value = m[2].trim().replace(/^["\x27]|["\x27]$/g, "");
  console.log("export " + m[1] + "=\x27" + value.replace(/\x27/g, "\x27\\\x27\x27") + "\x27");
}' "$ENVTMP")"
echo "exported production variable names: $(grep -oE '^[A-Za-z_]+' "$ENVTMP" | tr '\n' ' ')"

echo "step 2: moving .env aside so only the production variables are used"
mv .env "$ENV_BACKUP"

echo "step 3: regenerating the Android project"
yarn -s expo prebuild --clean --platform android --no-install || { echo "prebuild failed"; exit 1; }
grep -nE "^reactNativeArchitectures|^org.gradle" android/gradle.properties

echo "step 4: Gradle bundleRelease"
# The generated gradle.properties turns Gradle parallelism off so the small EAS builder survives;
# a local machine does not need that, so switch it back on for speed.
( cd android && ./gradlew bundleRelease -Dorg.gradle.parallel=true )
rc=$?
if [ $rc -ne 0 ]; then
  echo
  echo "BUILD FAILED (exit $rc)"
  exit $rc
fi

echo "step 5: checking the bundle"
status=0
sha1="$(keytool -printcert -jarfile "$AAB" 2>/dev/null | grep -m1 'SHA1:' | sed 's/.*SHA1: *//')"
if [ "$sha1" = "$UPLOAD_KEY_SHA1" ]; then
  echo "  signing key: matches the Play upload key"
else
  echo "  signing key: DOES NOT MATCH the Play upload key (got: ${sha1:-none})"
  status=1
fi
echo "  ABIs: $(unzip -l "$AAB" | grep -oE 'base/lib/[a-z0-9_-]+/' | sort -u | sed 's#base/lib/##; s#/##' | tr '\n' ' ')"
echo "  version: $(grep -m2 -E 'versionCode|versionName' android/app/build.gradle | tr -s ' ' | tr '\n' ' ')"
# The notification server address lives only in the local .env; it must not be in the bundle.
NSU="$(grep '^NOTIFICATION_SERVER_URL=' "$ENV_BACKUP" | cut -d= -f2- | tr -d "\"'")"
if [ -n "$NSU" ]; then
  if unzip -p "$AAB" base/assets/index.android.bundle 2>/dev/null | grep -a -q -F "$NSU"; then
    echo "  NOTIFICATION_SERVER_URL: FOUND in the bundle"
    status=1
  else
    echo "  NOTIFICATION_SERVER_URL: not in the bundle"
  fi
fi
echo "  file: $ROOT/$AAB ($(wc -c < "$AAB" | tr -d ' ') bytes, sha256 $(shasum -a 256 "$AAB" | cut -c1-64))"

echo
if [ $status -eq 0 ]; then echo "RELEASE BUILD OK"; else echo "RELEASE BUILD FAILED THE CHECKS"; fi
exit $status
