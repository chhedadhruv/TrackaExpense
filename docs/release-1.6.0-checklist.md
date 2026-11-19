# 1.6.0 store build checklist

Written 2026-11-19 from the state of branch `release/1.6.0` (`cff1c3d` plus this file). Tick items as they are done. "Me" is Claude Code in this repository, "owner" is you.

## What is in 1.6.0

All four are merged into `release/1.6.0`; none is in `main` yet.

| Change                                                                             | PR  | Native part                                                                     |
| ---------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------- |
| App lock (fingerprint, face or passcode on a cold start and after 30 seconds away) | 127 | `expo-local-authentication`, permissions `USE_BIOMETRIC` and `USE_FINGERPRINT`  |
| Typed routes                                                                       | 134 | `app.json`, `tsconfig.json`, `.gitignore` (fingerprint only, no runtime effect) |
| Android 13 themed icon                                                             | 136 | `adaptiveIcon.monochromeImage` and its resource files                           |
| Invite links open straight in the app (Android App Links)                          | 137 | an `autoVerify` intent filter for `https://trackaexpense.dhruvchheda.com/join`  |

Already verified on the combined branch (2026-11-19):

- `yarn type-check` with freshly generated route types: 0 errors. `yarn lint`: 0 errors, 14 warnings (the baseline). `yarn check:ratchet` OK. Jest 519 passing, `yarn test:functions` 177 passing.
- The Expo fingerprint is `9efa6f56a1383be3f847e9d15fe8df4b74b8b06f` before the version bump. It will change with the bump; the build script prints the real runtime version, and that is the one that matters.
- The merged release manifest compared with `main`'s: exactly two permissions added (`USE_BIOMETRIC`, `USE_FINGERPRINT`), none removed (31 against 29). Neither needs a Play declaration. None of the blocked permissions (ad ID, storage, media, audio, SMS) appears, and `usesCleartextTraffic` is `false`.
- The manifest has the `autoVerify` filter for the invite link, and `https://trackaexpense.dhruvchheda.com/.well-known/assetlinks.json` is live with the app signing key and the upload key (website PR 7).

## 1. Before cutting the build

- [ ] Me: merge `main` into `release/1.6.0` so it has every JavaScript fix made since the branch was cut, then rerun the gates.
- [x] `react-native-gifted-charts` stays in 1.6.0 (owner's decision, 2026-11-19). Removing it crashed startup once for a reason nobody has traced, and it saves no feature. Remove it in a later build, after finding why.
- [ ] Owner: review the Play Console Data safety answers against what changed since 1.5.1: credit card details (a name, optional last four digits, statement and due days), receipt scanning through Google Cloud Vision, the device time zone saved on the profile. The in-app and website privacy policies already say all three. Biometrics are handled by the system and the app stores and sends nothing from them, so I do not expect the app lock to need a Data safety entry; confirm that while reviewing the form.
- [ ] Owner: back up the Android upload keystore properly (`credentials/android/` is a single copy plus one loose safety copy).
- [ ] Me: check that `.env` has `SENTRY_AUTH_TOKEN` (the build script reads it from there), that the EAS CLI is logged in, and that JDK 17 and the Android SDK are present. Say so if any is missing.

## 2. Cutting the build

- [ ] Me: PR `release/1.6.0` into `main`, merge it. From this moment `main` has the 1.6.0 runtime (see section 6).
- [ ] Me: change `version` in `package.json` to `1.6.0`, run `yarn version:bump` (it stamps `app.json` version, `android.versionCode` and `ios.buildNumber`; Play rejects a versionCode it has seen, so rerun it if a rebuild happens in a later hour), PR and merge.
- [ ] Me, with the owner's approval: from a clean `main`, run `yarn release:android:local` (about 6 minutes). It checks the signing key (upload key SHA-1 `3D:59:93:EA...`), the ABIs, that the update channel is `production`, and that `NOTIFICATION_SERVER_URL` is not in the bundle.
- [ ] Me: write down the runtime version the script prints. It goes into the OTA command and the docs.
- [ ] Me: confirm in the printed manifest or the merged manifest that the `autoVerify` filter and the two biometric permissions are there, and that the AAB is `android/app/build/outputs/bundle/release/app-release.aab`.

## 3. Test it before any rollout

Install through Play **Internal testing**, not a local file. A Play install is signed with the app signing key, which is the key `assetlinks.json` lists first, so it is the real test of link verification.

- [ ] Owner: upload `app-release.aab` to Internal testing, install it on a phone. In the Play Console release page, note the download and install sizes (Skia and the other native libraries made the app larger in 1.5.0; this is the first check of the size).
- [ ] Owner: the baseline checks from the project guidance: Google sign-in, a push tap, camera and gallery receipt photos, add, edit and delete an expense, settle-up, the date pickers, both themes.
- [ ] App lock (the test plan in PR 127):
  - [ ] Profile > Security > App lock: turning it on prompts once; turning it off prompts too.
  - [ ] Close the app and reopen it: the lock screen shows before any data, and a fingerprint or the passcode unlocks it.
  - [ ] Away from the app under 30 seconds: no lock. Over 30 seconds: locks.
  - [ ] Take a receipt photo with the camera, pick one from the gallery, share a CSV: none of them locks the app on return.
  - [ ] Tap a push while locked: it unlocks, then opens the right screen.
  - [ ] Cancel the prompt: the app stays locked; "Sign out" works.
  - [ ] On a phone with no screen lock set up, the Security section is hidden.
- [ ] App Links:
  - [ ] `adb shell pm get-app-links com.trackaexpense` shows the domain `trackaexpense.dhruvchheda.com` as `verified` (verification runs in the background after install, so it can take a few minutes; check again before concluding it failed).
  - [ ] Share an invite link from a group, open it from a chat while signed in: it opens the Join screen in the app with no landing page and no chooser.
  - [ ] Open it from a cold start (app closed), and while signed out (it should wait through sign-in, then open).
  - [ ] A link with no group in it opens the Split tab, not an error screen.
- [ ] Themed icon: on Android 13 or later, turn on themed icons (Settings > Wallpaper and style), check the icon in the launcher and the app drawer, then switch it off and confirm the normal icon is unchanged.
- [ ] Typed routes have no runtime effect, so the check is that navigation still works: open a deep link such as `trackaexpense://split/invitations` and a push that carries a link.
- [ ] Offline cold start: with the phone in airplane mode, close and reopen the app. The last data should appear (this is the check that the MMKV cache works in a release build; `adb run-as` does not work on a release build).
- [ ] The R8 build: nothing crashes on any screen above. After the first real error, look in Sentry for a readable trace (JavaScript source maps and the R8 mapping are uploaded by the build script).

## 4. Roll out

- [ ] Owner: promote to production at about 20 percent and hold for 48 hours (a staged rollout; never choose the percentage without the owner's approval).
- [ ] Me: during the hold, check Sentry (new issues on the new release, crash-free sessions), the function logs, and the OneSignal dashboard.
- [ ] Owner: if clean, raise to 50 percent, then 100 percent.
- [ ] If something is wrong: halt the rollout in Play Console. Users on 1.5.1 keep working. A native problem cannot be fixed over the air, so it needs a new build with a new versionCode.

## 5. After it is live

- [ ] Me: update `CLAUDE.md` and `docs/deferred-tasks.md` for the new runtime version, the remaining release-branch notes, and what was checked on the build. Delete the `release/1.6.0` branch once it is merged.
- [ ] Me: remove the stale Crashlytics and Analytics data streams note if wanted (console only), and re-check which items on the list of owner-dependent tasks are still open.
- [ ] Phase 5 sign-off and Phase 6 planning, once the live checks from the earlier updates have passed.

## 6. Over-the-air updates after 1.6.0

The `production` channel serves each runtime version separately.

- A JavaScript fix for 1.6.0 users: publish from `main` with `bash scripts/ota-release.sh production "<message>" --runtime <the 1.6.0 runtime> --confirm-production`.
- A fix for people still on 1.5.1 (runtime `a1838cb4e35fa4add54a9f89c34810d64921b89e`): `main` no longer matches it. Write down the hash of the last `main` commit before `release/1.6.0` is merged (it has the 1.5.1 fingerprint), and keep it as a tag or note. A 1.5.1 fix would branch from that commit and be published from there with the 1.5.1 runtime. `scripts/ota-release.sh` insists on `main` for production, so this path needs the script adapted; decide that when the need arises.
- Never pass a runtime version by hand to make an update fit: a mismatch means the change needs a store build.
