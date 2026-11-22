# Roadmap and known limitations

## Not done yet

- iOS: the project is configured but the iOS build and device testing are not done.
- Firestore rules stage B: membership by user id only, owner-only profiles, no cross-user balance writes. The current rules still allow signed-in users to read other profiles. This waits for old app versions to age out.
- Android inbox reader for bank messages (reading SMS needs a native module and a Google Play permissions declaration). Pasting a message is supported today.
- Real, anonymised bank message and receipt samples for the parser tests. The current fixtures are synthetic.
- Component and render tests. Jest covers pure utilities only.
- A CI workflow exists in `.github/workflows/ci.yml`; the local Husky hooks are the main gate.
- Removing the legacy embedded `savingsGoals` array and the legacy `amount` and `balance` fields, after old app versions are gone.

- Offline: adding, editing and deleting a transaction work offline. Settlements, card bill payments and undoing them, receipt photos and the Maestro edit and delete steps while offline are not covered yet; the offline Maestro flow only adds and then deletes online.
- Automated store submission (`eas submit` with a staged rollout): releases are uploaded to Google Play by hand for now.

## Planned

- Credit limit view and card statement parsing.
- Polish pass: accessibility, empty states, onboarding.
