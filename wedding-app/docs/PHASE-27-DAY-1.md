# Phase 27 · Day 1 — User Profile & Security, Component Test Coverage

Production-readiness improvements: users can now manage their accounts, and every interactive component has test coverage.

---

## 1. Password Change & User Profile

**Server (2 new endpoints):**
| Endpoint | Description |
|---|---|
| `POST /api/auth/change-password` | Verifies current password, hashes new one, bumps session version (invalidates all existing JWTs) |
| `PATCH /api/auth/profile` | Updates fullName and/or phone |

**Security features:**
- Current password verification before accepting change
- Session version bump → all existing JWTs invalidated (forces re-login)
- Audit log entry on password change
- Minimum 8 character validation for new password

**Server repo:**
- Added `usersRepo.changePassword(userId, newHash, newSalt)` — updates hash + salt + bumps session

**Client:**
- `profileSdk.changePassword()`, `.updateProfile()` — SDK methods
- `UserProfile` page (`/settings/profile`) with:
  - Profile section: email (read-only), full name, phone
  - Password change section: current password, new password, confirm password
  - Validation: min 8 chars, passwords must match, button disabled until valid
  - Success confirmation after password change
- Added to ⌘K command palette as "Account Settings"

**Tests:** 6 server + 5 client = 11 new tests

---

## 2. Remaining Component Tests

| Component | Tests | What's covered |
|---|---|---|
| VendorPaymentDialog | 3 | Form rendering, closed state, amount input |
| GuestsToolbar | 3 | Search input, Add Guest button, total count display |
| UserProfile | 5 | Email display, name pre-fill, password section, save button, disabled state |
| Auth endpoints | 6 | Password change success, wrong current, too short, profile name update, phone update, auth requirement |

---

## Test Summary

| | Phase 26 | **Phase 27** | Δ |
|---|---|---|---|
| Server tests | 208 | **214** | **+6** |
| Client tests | 364 | **375** | **+11** |
| **Total** | **572** | **589** | **+17** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (7)

```
server/src/routes/auth.integration.test.ts              # 6 tests (password + profile)
client/src/screens/system/UserProfile.tsx                # Profile + password change page
client/src/screens/system/UserProfile.test.tsx            # 5 tests
client/src/screens/events/vendors/VendorPaymentDialog.test.tsx  # 3 tests
client/src/screens/events/guests/GuestsToolbar.test.tsx  # 3 tests
docs/PHASE-27-DAY-1.md                                  # This file
```

## Files Modified (5)

```
server/src/db/repos/users.ts        # Added changePassword method
server/src/routes/auth.ts           # Added change-password + profile endpoints
client/src/sdk/auth.ts              # Added profileSdk methods
client/src/sdk/index.ts             # Exported profileSdk
client/src/App.tsx                  # Added /settings/profile route + command palette item
```
