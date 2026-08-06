# A11Y-APP-SURFACES-PASS-1 — axe now scans the authenticated app + real WCAG fixes

## Gap
The axe gate only scanned the login screen and the public guest portal —
the surfaces the venue team and couples use daily (couple hub, event detail)
were never scanned. Extending the scan immediately found **real WCAG
violations** that had shipped:

## Fixes
1. **Color contrast — success token (serious)**: `text-success` (#107D56) on
   `bg-success-soft` (#DCF4EA) = 4.44:1 — just under AA. Lightened the
   success token to #0F7650 (4.87:1). Used across "Couple access"/"venue
   approved" badges, "Allowed in your wedding hub" lists, and RSVP progress.
2. **Color contrast — dark mode success (2.71:1!)**: the dark theme left
   `--color-success` dark green on a near-black soft background. Added a
   dark override (#40C873, 6.44:1) so dark-mode couples can read success
   text.
3. **Color contrast — info token (4.24:1)**: `--color-info` #2563EB on
   info-soft was borderline; darkened to #2058DE (4.90:1) preemptively.
4. **Unlabeled selects (critical)**: 4 `<select>` elements in the couple
   hub had no accessible name (portal language, guest RSVP status, document
   category, document visibility) — screen-reader users got an unnamed
   combobox. All now have aria-labels.

## Coverage added (`e2e/a11y.a11y.spec.ts`, +2)
- **Authenticated couple hub**: fresh couple registered + invited via API,
  logs in, hub axe-scanned (0 violations).
- **Authenticated event detail**: owner logs in, opens the seeded event,
  axe-scanned (0 violations).

## Verification
- a11y e2e: 4/4 pass (login, guest portal home+RSVP, couple hub, event detail).
- Full e2e suite + client unit suite re-run green.
