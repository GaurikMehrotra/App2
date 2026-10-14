# Validation — 2026-10-14

Verified in this cloud instance:

- Frozen installation with `npm ci` completed.
- ESLint passed. Strict TypeScript checks passed for the monorepo and apps/public.
- Jest / React Native Testing Library: 2 suites, 6 tests passed.
- Edge Functions passed Deno type checks. Raw-body payment signature test passed, including tampering and wrong-key rejection.
- All migrations and seed data applied in isolated PostgreSQL fixtures. Assertions passed for RLS coverage, identity and badge forgery prevention, moderator access, private bookmarks, blocked posts, atomic counters, chronological Following, new-account throttling and diverse-cohort note publication.
- Playwright: 3 tests passed: explicit feed opt-in, Hindi/account accessibility labels, automated WCAG AA checks for the public main screen. This is not a full manual accessibility audit.
- Latest web export produced 19 routes. Latest Android and iOS Hermes bundle exports passed. These are bundles, not signed native releases.
- Expo development server was started, requested locally, stopped and restarted. HTTP 200 and the conversation shell were verified.

Not validated: hosted Supabase Auth/Storage/Realtime/Edge execution; physical-device recording and push; provider sandbox payments/translations/scanning; signing/store releases; actual campus account sharing and integration. No Supabase connection variables or campus source were supplied. See README.md for implementation gaps and required configuration.

Reusable install_script, start_skill and public Supabase/grievance variable requirements were saved to the environment configuration draft. Draft saving did not publish the environment or deploy the application. The current development server does not survive snapshot restoration.
