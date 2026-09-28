# Northstar Web

Minimal Next.js App Router frontend using React, TypeScript, Tailwind CSS, and ESLint.

From this directory, with Node.js 20.9+ and npm installed:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or external services are required.

Validation and production commands:

```powershell
npm run lint
npm run typecheck
npm run build
npm start
```

See the root [Local Development guide](../../README.md#local-development) for both applications.

## Supabase foundation

Northstar uses Supabase. Browser and server client factories are available in
`lib/supabase/client.ts` and `lib/supabase/server.ts`, following the
[Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
Call the browser factory from browser code; await a new server client within each
request. The server factory uses Next.js cookies. Authentication and the Proxy
needed for session refresh are deferred to a separate issue; these utilities do
not yet provide a complete authentication flow.

Get the Project URL and Publishable key from your Supabase project's Connect
dialog or Settings > API Keys screens. Set these names in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Fill in real values only in that local file, which must never be committed.
The root `.env.example` contains empty placeholders only. Publishable keys are
intended for browser use; secret keys and legacy service-role keys must never be
exposed to browser code or assigned a `NEXT_PUBLIC_` variable. Neither is used by
these clients. Restart the development server after changing local configuration.

With Node.js 24 LTS, run this optional local check from `apps/web`:

```powershell
npm run check:supabase
```

It loads `.env.local` and initializes the browser client factory in Node without
printing configuration values. Network requests are disabled. Success verifies
local initialization only, not project connectivity or key validity on Supabase.
The normal typecheck compiles both client utilities. The local check is not part
of CI; the existing page, lint, typecheck, and build require no Supabase credentials
because client creation is deferred until a factory is called.
