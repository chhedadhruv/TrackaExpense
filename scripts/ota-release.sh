#!/usr/bin/env bash
#
# Publishes an over-the-air update (EAS Update) for Android, set up like the local release build.
#
#   bash scripts/ota-release.sh preview "what changed"
#   bash scripts/ota-release.sh production "what changed" --runtime <hash> --confirm-production
#
# It is run with bash on purpose and has no entry in package.json: the `scripts` section of
# package.json is part of the Expo fingerprint, so adding or changing an entry there changes the
# runtime version and cuts the code off from the store build it should update.
#
# Why not a bare `eas update`: the app bakes every key of the local .env into the JavaScript
# bundle (react-native-dotenv), and .env holds keys the production app must never carry
# (NOTIFICATION_SERVER_URL above all). This script exports the bundle with the EAS variables of
# the chosen environment only, checks it, and publishes that exact bundle.
#
# What it does:
#   1. Refuses a tree with uncommitted changes. For production it also wants `main`, level with
#      origin/main, `--confirm-production`, and `--runtime <hash>`: the runtime version of the
#      store build the update is meant for (printed by `yarn release:android:local`).
#   2. Computes the fingerprint of this commit. If it differs from `--runtime` it stops: the
#      commit holds a native change (or a package.json scripts change) and no installed app with
#      that runtime version would ever receive the update.
#   3. Exports the EAS variables of the environment and moves .env aside (always put back).
#   4. Exports the bundle with a cleared Metro cache (a cached file could still hold an old .env
#      value) and checks that the notification server address is not in it.
#   5. Publishes that bundle with `eas update --skip-bundler`, then uploads the source maps to
#      Sentry so errors from the update are readable.
#
# Needs: the EAS CLI logged in, and SENTRY_AUTH_TOKEN in .env. Never publish to production
# without the owner's approval. Prints no secret values.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  echo "usage: bash scripts/ota-release.sh <preview|production> \"<message>\" [--runtime <hash>] [--confirm-production]"
  exit 1
}

CHANNEL="${1:-}"
MESSAGE="${2:-}"
if [ -z "$CHANNEL" ] || [ -z "$MESSAGE" ]; then usage; fi
shift 2
EXPECTED_RUNTIME=""
CONFIRMED="no"
while [ $# -gt 0 ]; do
  case "$1" in
    --runtime) EXPECTED_RUNTIME="${2:-}"; shift 2 ;;
    --confirm-production) CONFIRMED="yes"; shift ;;
    *) usage ;;
  esac
done
case "$CHANNEL" in
  preview|production) ;;
  *) echo "the channel must be preview or production"; exit 1 ;;
esac

DIST="dist"
ENVTMP="$(mktemp -t trackaexpense-ota-env.XXXXXX)"
ENV_BACKUP=".env.release-bak"

cleanup() {
  if [ -f "$ENV_BACKUP" ]; then mv "$ENV_BACKUP" .env; fi
  rm -f "$ENVTMP"
  rm -rf "$DIST"
  echo "cleanup done: .env restored, temporary files removed"
}

if [ ! -f .env ]; then echo "no .env file"; rm -f "$ENVTMP"; exit 1; fi
if [ -f "$ENV_BACKUP" ]; then
  echo "$ENV_BACKUP exists from an interrupted run: restore it to .env first"
  rm -f "$ENVTMP"
  exit 1
fi
trap cleanup EXIT

echo "step 1: checking the commit"
if [ -n "$(git status --porcelain)" ]; then
  echo "there are uncommitted changes: commit or stash them, an update must match a commit"
  exit 1
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
COMMIT="$(git rev-parse --short HEAD)"
if [ "$CHANNEL" = "production" ]; then
  if [ "$CONFIRMED" != "yes" ]; then
    echo "production needs --confirm-production (and the owner's approval)"
    exit 1
  fi
  if [ -z "$EXPECTED_RUNTIME" ]; then
    echo "production needs --runtime <hash>: the runtime version of the store build to update"
    exit 1
  fi
  if [ "$BRANCH" != "main" ]; then
    echo "production updates are published from main (this is $BRANCH)"
    exit 1
  fi
  git fetch -q origin main || { echo "could not fetch origin/main"; exit 1; }
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "main is not level with origin/main: pull or push first"
    exit 1
  fi
fi
echo "  branch $BRANCH, commit $COMMIT, channel $CHANNEL"

echo "step 2: computing the fingerprint (the runtime version of this commit)"
RUNTIME="$(yarn -s expo-updates fingerprint:generate --platform android 2>/dev/null |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).hash)}catch(e){}})')"
if [ -z "$RUNTIME" ]; then echo "could not compute the fingerprint"; exit 1; fi
echo "  runtime version: $RUNTIME"
if [ -n "$EXPECTED_RUNTIME" ] && [ "$RUNTIME" != "$EXPECTED_RUNTIME" ]; then
  echo "  it is NOT the expected $EXPECTED_RUNTIME"
  echo "  this commit changed something native (or the scripts in package.json): an update"
  echo "  published from it would reach no installed app with that runtime version. Stopping."
  exit 1
fi

SENTRY_AUTH_TOKEN="$(grep '^SENTRY_AUTH_TOKEN=' .env | cut -d= -f2- | tr -d "\"'")"
export SENTRY_AUTH_TOKEN
if [ -z "$SENTRY_AUTH_TOKEN" ]; then echo "no SENTRY_AUTH_TOKEN in .env"; exit 1; fi
# The notification server address lives only in the local .env; it must not be in the bundle.
NSU="$(grep '^NOTIFICATION_SERVER_URL=' .env | cut -d= -f2- | tr -d "\"'")"

echo "step 3: pulling the EAS $CHANNEL variables and moving .env aside"
eas env:pull "$CHANNEL" --path "$ENVTMP" --non-interactive >/dev/null 2>&1 || {
  echo "could not pull the EAS $CHANNEL variables (is the EAS CLI logged in?)"
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
echo "  exported variable names: $(grep -oE '^[A-Za-z_]+' "$ENVTMP" | tr '\n' ' ')"
mv .env "$ENV_BACKUP"

echo "step 4: exporting the bundle (Metro cache cleared)"
rm -rf "$DIST"
yarn -s expo export --clear --output-dir "$DIST" --dump-sourcemap --dump-assetmap --platform android ||
  { echo "export failed"; exit 1; }
BUNDLE="$(ls "$DIST"/_expo/static/js/android/*.hbc 2>/dev/null | head -1)"
if [ -z "$BUNDLE" ]; then echo "no Android bundle in $DIST"; exit 1; fi
echo "  bundle: $BUNDLE ($(wc -c < "$BUNDLE" | tr -d ' ') bytes)"
if [ -n "$NSU" ]; then
  if grep -a -q -F "$NSU" "$BUNDLE"; then
    echo "  NOTIFICATION_SERVER_URL: FOUND in the bundle. Stopping, nothing was published."
    exit 1
  fi
  echo "  NOTIFICATION_SERVER_URL: not in the bundle"
fi

echo "step 5: publishing to the $CHANNEL channel"
eas update --channel "$CHANNEL" --environment "$CHANNEL" --platform android \
  --skip-bundler --input-dir "$DIST" --message "$MESSAGE" --non-interactive
rc=$?
if [ $rc -ne 0 ]; then
  echo
  echo "PUBLISH FAILED (exit $rc)"
  exit $rc
fi

echo "step 6: uploading the source maps to Sentry"
if yarn -s sentry-expo-upload-sourcemaps "$DIST"; then
  echo "  source maps uploaded"
  status=0
else
  echo "  SOURCE MAP UPLOAD FAILED: the update is published, but its errors will be unreadable"
  echo "  in Sentry until the maps are uploaded"
  status=1
fi

echo
if [ $status -eq 0 ]; then
  echo "OTA RELEASE OK: commit $COMMIT on $CHANNEL, runtime version $RUNTIME"
else
  echo "OTA RELEASE PUBLISHED, SOURCE MAPS MISSING"
fi
exit $status
