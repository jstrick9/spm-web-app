# Systematic Hunt Pass 12 — Couple Document Versioning Was Display-Only

**Date:** 2026-08-07

## Gap found & fixed

### Couples saw `v{n}` on shared documents but could never upload a new version
The couple hub listed documents with their version number and the server
supported `POST /api/events/:eventId/couple-documents/:id/version`
(superseding the old file), but **no UI called it** — updating a shared
contract/menu meant delete + re-upload (losing history and approval
context).

**Fix** (`CoupleEventHub.tsx`): each document card gains a "New version"
button + hidden file input (`uploadDocumentVersion` mutation, type
validation, per-doc refs). On success the list refreshes and the previous
file is superseded server-side.

Test: `e2e/couple-documents.e2e.spec.ts` extended — uploads the initial
doc, then uploads a NEW VERSION via the card's input (real file via
`setInputFiles`), and asserts the server now records the new filename with
an INCREMENTED version on the same document id.
