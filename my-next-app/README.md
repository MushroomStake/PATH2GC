This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
````markdown
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Shared Supabase configuration

This project has been configured to reuse the same Supabase database as another local project (for development or migration purposes). A `.env.local` file with the following variables is present in the repo root:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are used by `src/services/api.js`, a small fetch-based Supabase REST client. To run locally:

1. Ensure `.env.local` exists in the project root (it has been added with the same values from the other project).
2. Start the dev server:

```bash
npm run dev
```

3. Open http://localhost:3000 and verify the app by visiting pages that use the API (product or inventory pages). If you need to change the Supabase project, update the two env variables in `.env.local`.

Security note: the anon key is intentionally public for client-side access, but do not commit sensitive service_role keys into source control.

## Cerebras AI & Admissions Chat integration

This project includes scaffolding for an admissions AI assistant that can guide applicants step-by-step.

What I added:

- SQL migrations in `db/migrations/` to create `admission_steps`, `faqs`, `resources`, and `chat_logs` tables.
- A server API route at `app/api/chat/route.ts` that proxies chat requests to a Cerebras-compatible API and logs chats to Supabase.
- A client chat component `app/components/AdmissionsChat.tsx` and admission pages under `app/admission`.

Environment variables to set (server-side / `.env.local` for development):

- `CEREBRAS_API_KEY` — your Cerebras API key (keep secret; do NOT commit).
- `CEREBRAS_API_URL` — the provider endpoint to call (optional; if unset the route uses a sensible default; change it if your provider requires a different path).
- `SUPABASE_SERVICE_ROLE` — Supabase service_role key for server-side inserts (optional but required to write to `chat_logs` from the server).

How to enable the full integration:

1. Set `CEREBRAS_API_KEY` and optionally `CEREBRAS_API_URL` in your environment (or deploy platform secret manager).
2. Add `SUPABASE_SERVICE_ROLE` (from Supabase project settings) to the env so the server can log chats.
3. Run the SQL in `db/migrations/` via the Supabase SQL editor to create tables and seed data.
4. Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Notes:
- The server route supports a canned dev response when `CEREBRAS_API_KEY` is not set and will call the configured `CEREBRAS_API_URL` when it is. The request payload is generic; if your Cerebras provider expects a different request shape, update `app/api/chat/route.ts` or set `CEREBRAS_API_URL` to the correct endpoint.
- I added `@supabase/supabase-js` to `package.json`; run `npm install` to fetch it.

````
