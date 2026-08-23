<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
# FasoBar - Project Rules

## General
- FasoBar is an existing production project. Preserve existing behavior unless explicitly asked to change it.
- Before modifying code, inspect the relevant existing files and understand the current implementation.
- Do not perform large refactors unless explicitly requested.
- Prefer small, targeted changes.
- Never remove existing functionality just to make a new feature work.

## Stack
- Next.js
- React
- TypeScript
- Supabase
- Vercel

## Architecture
- The application supports multiple types of establishments.
- Features specific to one establishment type must not break or modify the behavior of other establishment types.
- Respect the existing multi-tenant architecture and workspace/establishment isolation.
- Respect existing user roles and permissions.

## Database / Supabase
- Inspect existing Supabase tables, queries and migrations before changing database behavior.
- Never modify an existing production migration blindly.
- Prefer creating a new migration when a database schema change is required.
- Preserve tenant isolation and security rules.
- Do not expose secrets or values from .env.local.

## TypeScript
- Keep strict TypeScript typing.
- Do not hide type errors with `any`, `@ts-ignore`, or unsafe casts unless absolutely necessary and explained.
- Fix the root cause of TypeScript errors.

## Development workflow
For non-trivial tasks:
1. Inspect the existing implementation.
2. Identify the files concerned.
3. Explain the planned changes briefly.
4. Implement only what is necessary.
5. Check for regressions.
6. Run the relevant tests/type checks.
7. Run `npm run build` after important changes.

## Safety
- Do not delete files, migrations, database structures or major functionality without explicit permission.
- Do not reset the database.
- Do not modify `.env.local`.
- Do not push, deploy or create destructive Git operations unless explicitly requested.