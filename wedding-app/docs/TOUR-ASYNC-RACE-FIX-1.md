# TOUR-ASYNC-RACE-FIX-1 — onboarding tour re-opened after completion

## Bug
`WelcomeModal` decided whether to open based on the user's platform config
(`userConfig.onboarding.welcomeTourByOrg[orgId].status`). That config loads
asynchronously after the shell mounts, and the effect only ever **opened**
the modal:

```ts
if (status !== 'completed' && status !== 'dismissed') setOpen(true);
```

On the first render `userConfig` is `{}` → status `'not_started'` → the
modal opened. When the real config arrived with `status: 'completed'`, the
effect re-ran and did **nothing** — the modal stayed open. Consequences:
- Users who completed the tour saw it re-open on slow loads (data loss /
  annoyance; "Resume later" left it in_progress forever).
- e2e suites flaked intermittently: the happy-path spec completed the tour
  via API before the browser session, but the app could still render the
  modal when the preferences GET resolved after first paint.

## Fix
The effect now closes the modal when the resolved state is
`completed`/`dismissed` (and skips reopening):

```ts
if (status === 'completed' || status === 'dismissed') { setOpen(false); return; }
```

## Regression tests (WelcomeModal.test.tsx, +2)
- "closes the tour when the completed config arrives AFTER mount" — renders
  with empty config (modal opens), rerenders with completed → modal closes.
- Same for `dismissed`.

## Verification
- WelcomeModal tests 6/6; client unit suite 935+ passed.
- happy-path e2e stress-run 3/3 (previously flaky); full e2e suite green.
