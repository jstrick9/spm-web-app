# Metadata Clobber Fix — Day-of Data Can No Longer Disappear

## The bug

`PATCH /api/events/:id` **replaced** the event's `metadata` JSON wholesale,
and three day-of surfaces (Emergency tab, Run Sheet, and the setup
checklist in EventDetail) read metadata once at mount and wrote the entire
object back on every change. Consequence:

- Coordinator A logs a **critical incident** (writes metadata snapshot M0+incident).
- Coordinator B, who loaded the page before A saved, toggles a kit item
  (writes her stale snapshot M0+kitChange).
- A's incident is **silently erased** — the worst possible failure mode
  for an emergency/incident system, and trivially hit with two tablets
  or two tabs on event day.

## The fix (two layers)

1. **Server — RFC 7386 deep merge for `metadata`** (`db/repos/events.ts`):
   a PATCH's metadata is merged over the stored metadata (plain objects
   merged recursively, arrays/scalars replaced by the incoming value).
   Concurrent writers touching *different* sub-keys now both survive;
   single-writer behavior is unchanged (merging onto an identical base is
   a no-op). Verified no client relies on replace-to-clear semantics.

2. **Client — refresh-before-write** in the two worst offenders
   (`EventEmergencyTab`, `RunSheet`): before saving, the mutation refetches
   the event (fresh metadata) and bases the write on that, so even
   same-key races (two tablets toggling the same checklist) use the
   freshest known state instead of a mount-time snapshot.

## Tests

- `events-module.integration.test.ts` +1: writer A logs an incident,
  writer B (stale base) updates the kit checklist — **both survive**;
  nested-object merge keeps sibling keys; arrays still replace (RFC 7386).
- `EventEmergencyTab.test.tsx` +1: a "concurrent tablet" incident appears
  in the write payload after toggling a kit item (refresh-before-write).

## Verification

- Server **569 tests / 80 files** · Client **886 tests / 134 files**.
- `tsc --noEmit` clean both apps; client build + bundle budgets satisfied.
