# Happy Calendar Documentation

Happy Calendar is a privacy-first planner for couples, families and friend groups. The app keeps the group state in a portable shared session string instead of a backend or database.

## Product scope

- Shared calendar for celebrations and family events.
- Gift budgets per event.
- Event format: organized, drop-in, remote, or gift-only.
- Pseudonymous profiles with nicknames and pixel avatars.
- Personal wishlists and post-event wishlist updates.
- No accounts, no backend, no database, no required personal data.

## Developer guide

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

## Structure

```text
src/app                    React entrypoint and global styles
src/pages/landing           Responsive landing page
src/widgets/session-preview  UI-facing derived demo data
src/entities/session         Pure functional domain model
src/shared/digitable         Local Digitable UI adapter and tokens
src/test                     Vitest setup
```

## Functional rules

- Domain modules expose pure functions.
- UI receives immutable props.
- State transformations return new values.
- The landing slice does not use backend calls, database writes, localStorage, or sessionStorage.
- Session string generation must be deterministic.

See [architecture.md](./architecture.md) for Mermaid diagrams.
