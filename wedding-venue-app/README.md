# wedding-venue-app

A React/Vite wedding venue planning and layout application with optional Supabase production backend support.

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm test -- --run
npm run build
```

## Production backend

Production-grade auth, sessions, RLS-protected Postgres tables, private object storage, transactional email, and deployment environment documentation are included under:

- `.env.example`
- `supabase/migrations/`
- `supabase/functions/send-email/`
- `src/services/backend/`
- `src/services/storage/`
- `docs/production-backend.md`

Never commit real credentials. Configure Supabase, email, and deployment secrets through your hosting provider or the Supabase CLI.
