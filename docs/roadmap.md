# Roadmap and known limitations

## Not done yet

- iOS: the project is configured but the iOS build and device testing are not done.
- Firestore rules stage B: membership by user id only, owner-only profiles, no cross-user balance writes. The current rules still allow signed-in users to read other profiles. This waits for old app versions to age out.
- Android inbox reader for bank messages (reading SMS needs a native module and a Google Play permissions declaration). Pasting a message is supported today.
- Direct Android App Links for group invite links (needs a native change and a store build).
- Real, anonymised bank message and receipt samples for the parser tests. The current fixtures are synthetic.
- Component and render tests. Jest covers pure utilities only.
- A CI workflow exists in `.github/workflows/ci.yml`; the local Husky hooks are the main gate.
- Removing the legacy embedded `savingsGoals` array and the legacy `amount` and `balance` fields, after old app versions are gone.
- Retiring the unused Express notification server in `server/`.

## Planned

- Credit limit view and card statement parsing.
- Polish pass: accessibility, empty states, onboarding.
