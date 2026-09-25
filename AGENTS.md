<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## POD Lab conventions

- Pure business logic lives in `src/domain` (no I/O) and is unit tested. Agent handlers live in `src/agents/handlers`, with schemas in `src/agents/schemas` and versioned prompts in `src/agents/prompts`.
- Server Actions validate input with Zod, check roles with `src/domain/permissions`, and write through the RLS-scoped user client. The service-role admin client is only used by the agent runtime, bootstrap/seed and credential storage.
- Approval-sensitive states can only change inside `decide_approval_gate()`; database triggers enforce it.
- Schema changes go in a new migration in `supabase/migrations`, then `npm run db:types`.
- Before committing: `npm run lint && npm run typecheck && npm test` (plus `npm run test:integration` with local Supabase).
