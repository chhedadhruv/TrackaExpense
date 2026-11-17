# Maestro flows

End-to-end flows that drive the real app on an Android emulator or device, so a regression in the
add, edit, delete and tag paths shows up before a release. Maestro is a global command line tool
(`maestro --version`), not a project dependency.

## Run

Start an emulator with a debug or preview build installed and **signed in as the throwaway test
account** (never a real account: the flows write and delete data in the live Firebase project).

```
export MAESTRO_CLI_NO_ANALYTICS=1                 # Maestro sends anonymous usage data otherwise
caffeinate -i maestro --device emulator-5554 test .maestro      # every flow
caffeinate -i maestro --device emulator-5554 test .maestro/flows/smoke-tabs.yaml
```

`--device` is needed when more than one device or simulator is booted. `caffeinate -i` keeps the
Mac awake: during one run the machine paused, two taps hung for 15 and 5 minutes, and the flow
failed.

## Flows (`flows/`)

| Flow | What it does | Writes data |
|---|---|---|
| `smoke-tabs.yaml` | Opens every tab and the transactions list and checks each heading | No |
| `tags.yaml` | Adds an expense with a tag, filters and searches by it, deletes it | Yes, nets to zero (one tag document stays) |
| `expense-lifecycle.yaml` | Adds an expense, edits its amount (3 to 4), checks the list shows it, deletes it | Yes, nets to zero |

`expense-lifecycle.yaml` was parked while the edited amount did not show in the list. It passed
three runs in a row on 2026-11-17 against the current debug build (listener-based data layer), so it
is in the suite. If a run fails halfway, clean up with the tool below.

The test expenses are titled `Maestro <timestamp>`. If a run fails halfway, delete what it left
behind with `maestro test .maestro/tools/cleanup-leftovers.yaml`.

The tags flow always uses the tag `maestro-test`: the app keeps a suggestion list of every tag ever
used (`users/{uid}/tags`) and cannot delete from it, so a fixed name leaves one document in total
instead of one per run.

## Writing flows

- Select by visible text or accessibility label ("Enter expense title", "Select expense category").
  The app has no test ids.
- "Add Expense" is the header, a heading and the button: select the button as the one below the
  receipt field (`below: 'Receipt/Image (Optional)'`).
- `tapOn` does not scroll: use `scrollUntilVisible` before a field that may be off screen.
- Do not use `hideKeyboard` on Android: when the keyboard is already closed it sends Back, which
  leaves the screen.
- Assert on outcomes (the row appears in the list) rather than on the snackbar, which disappears
  within a few seconds.
- `subflows/dismiss-dev-banner.yaml` dismisses the debug-only warning bar when one shows up. It is
  white text on white, so it is invisible, but it swallows taps near the bottom of the screen.
  Release builds never show it, and a build with no warnings does not show it either.
