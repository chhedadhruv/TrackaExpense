# Quality baseline and gates

The codebase had existing violations when the gates were introduced, so the gates run in ratchet mode:
no new violation is allowed, and the counts only go down. The numbers live in
`docs/quality-baseline.json` and are checked by `yarn check:ratchet`.

## Baseline when the gates were introduced (2026-11-08)

| Check                                   | Before                           | At introduction             |
| --------------------------------------- | -------------------------------- | --------------------------- |
| ESLint errors                           | 37                               | see `quality-baseline.json` |
| ESLint warnings                         | 389                              | see `quality-baseline.json` |
| `tsc --noEmit` errors                   | 162                              | 0                           |
| Prettier: files not matching the config | 59                               | see `quality-baseline.json` |
| Jest                                    | 1 suite failing to load, 0 tests | passing (see `yarn test`)   |

The 162 type errors were caused by the old TypeScript version (5.0.4) not accepting components that
return `ReactNode` (react-native-paper `Text`). TypeScript 5.6.3 clears them; the remaining few real
type errors were fixed.

## Gates

- Pre-commit (`.husky/pre-commit`): `lint-staged` runs ESLint with autofix, Prettier and the Jest tests
  related to the staged files; then `yarn type-check` must report 0 errors.
- Commit message (`.husky/commit-msg`): commitlint, Conventional Commits, and no attribution lines.
- Pre-push (`.husky/pre-push`): full `yarn test` and `yarn check:ratchet`.
- CI (`.github/workflows/ci.yml`, `ubuntu-latest`): the same checks, plus commitlint over the pull request
  commits, Prettier on changed files, and the Firestore and Storage rules tests in the emulator.
- Never use `--no-verify`. If a gate fails, fix the cause.

## Working rules

- A staged file is rewritten by Prettier on commit. Reformatting a legacy file in the same commit as a
  change is expected; keep unrelated changes out of that commit.
- Files you touch must have no ESLint errors. Existing warnings may stay, but the total may not rise.
- After reducing any count, run `yarn check:ratchet --update` and commit the lower baseline.
- Do not edit `quality-baseline.json` by hand to raise a number.
