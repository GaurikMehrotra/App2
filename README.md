# [APP_NAME_2]

An original public conversation platform built with Expo Router, React Native Web, strict TypeScript and Supabase. The same application produces web, Android and iOS bundles. See [PLAN.md](PLAN.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

The repository was empty: there was no apps/campus or existing packages/core. This implementation creates packages/core for shared identity, UI, API and provider contracts. Connecting an existing campus application requires its source and the same Supabase project. The product name and application identifiers are placeholders.

## Run locally

Use Node 24 (see .node-version) and npm 11:

```sh
npm ci
cp apps/public/.env.example apps/public/.env
# Set the project's public Supabase URL and publishable/anon key in .env.
npm run web
npm run android
npm run ios
```

Android requires an emulator or device. iOS simulator commands require macOS/Xcode; use a physical iOS device/development build from Linux. Media and push require native permission grants; push requires an EAS project ID and a native development build, not Expo Go. Without Supabase configuration the web shell renders but account/data operations are unavailable.

Use a single Supabase Auth project for both applications. Configure redirect URLs and email confirmation in Supabase Auth. Client keys must be publishable/anon keys; never place service-role keys in EXPO_PUBLIC variables. Campus verification is read-only to public clients and requires a trusted campus integration.

## Backend

Apply supabase/migrations/*.sql in filename order to your Supabase project using the SQL editor or the Supabase CLI (`supabase db push` after linking a project). Seed topics/events with supabase/seed.sql. Do not seed production accounts or badge claims. Auth signup creates a public profile automatically; authenticated users confirm birth date in Account before posting. Minors require operator-reviewed guardian consent, cannot publish location and cannot opt into Suggested. Guardian consent review is an operator integration requirement, not an automated identity verification service.

Storage uses private app2-quarantine and app2-media buckets. Uploads stay quarantined until a trusted scanner/compression adapter approves them. Configure its HTTPS endpoint, bearer token and allowed output hostname in Edge Function secrets. The provider must validate MIME, duration and malware and return `{safe,processedURL,contentType,durationSeconds}`. Video compression runs through this provider; local images and voice recording use compression before upload. Configure retention cleanup for orphaned/quarantined objects.

Deploy authenticated functions feed, translate, payment, privacy, media-process and push with normal JWT verification. Deploy payment-webhook with gateway JWT verification disabled **only for that function**; its application handler verifies Razorpay's HMAC signature against the exact raw request body. No other function may disable authentication. Functions expect Supabase-injected SUPABASE_URL, SUPABASE_ANON_KEY and (server only) SUPABASE_SERVICE_ROLE_KEY.

Optional Edge secrets:

- TRANSLATION_ENDPOINT / TRANSLATION_TOKEN: HTTPS adapter accepting `{text,source,target}` and returning `{text}`. Cache writes stay server-owned.
- MEDIA_PROCESSOR_ENDPOINT / MEDIA_PROCESSOR_TOKEN / MEDIA_PROCESSOR_OUTPUT_HOST: scanning and compression adapter.
- RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET: test credentials only (`rzp_test_` required). Tips use hosted payment links; subscriptions use hosted subscription checkout. Register payment_link.paid and subscription lifecycle webhooks. Signed webhook confirmation, never client success, activates financial records.

Set EXPO_PUBLIC_GRIEVANCE_NAME and EXPO_PUBLIC_GRIEVANCE_EMAIL to real operator contact details. This is required before public release. This application supplies private request/appeal models and an intake page; India IT Rules response timelines, staffing, evidence handling and retention must be implemented by the operator. It does not claim legal compliance merely from these tables.

Supabase Realtime publishes posts/messages/notifications. Push registration saves an Expo token with per-type preferences; the authenticated push function delivers pending notifications to the caller's device. A trusted background dispatch scheduler and receipt/retry handling still need implementation for sleeping-device delivery.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run check:edge
npm run test:edge
npm run test:db                  # Docker; isolated PostgreSQL, no exposed port
npm run export:web
npm exec -w @app2/public -- playwright install chromium
npm run test:e2e
```

In this cloud machine use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. Browser downloads were denied by the network policy; the installed Chromium is used with normal browser security. For Deno in this machine set DENO_DIR=/tmp/app2-deno and DENO_TLS_CA_STORE=system, preserving TLS verification. EXPO_OFFLINE=1 uses installed SDK compatibility information without calling the blocked Expo API.

Database tests bootstrap Supabase-like auth/storage schemas in PostgreSQL and check migrations, RLS, counters, chronological feeds, abuse limits and bridging consensus. They are not a substitute for testing the deployed Supabase Auth, Storage, Realtime or Edge runtime. Unit/component tests and browser checks exercise controls and localization. Native bundle export validates module resolution; it does not prove device behavior or app store readiness.

## Deploy web

`npm run export:web` writes apps/public/dist. Set the public Supabase variables at build time and rebuild after changes. Vercel: set project root apps/public and use vercel.json. Netlify: use repository root, build command `npm run export:web`, publish apps/public/dist, and copy the redirect rules from apps/public/netlify.toml. Cloudflare Pages: same root/build/publish settings; add rewrites for `/post/*` to `/post/[id].html` and `/person/*` to `/person/[handle].html`. Enable clean extensionless routes. Configure Supabase's allowed auth redirect domains for each deployment. Hosting commands/configurations have not been deployed from this workspace.

## Build mobile

Replace com.example.app2, product name and scheme with approved identifiers. From apps/public run `npx eas-cli init`, configure the resulting EAS project ID, then `npx eas-cli build --platform android --profile preview` and `npx eas-cli build --platform ios --profile preview`. For push, use the development profile (expo-dev-client is included). Store EAS/Supabase/provider secrets in platform settings. Apple/Google accounts and signing credentials are external prerequisites. No signed builds or store submissions have been performed.

## Implementation coverage and remaining work

This is a working development implementation, not completion of every production requirement in the ten-milestone specification:

| Milestone | Implemented                                                                                                                                   | Remaining                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| M1        | Expo web/native bundles, shared auth client/provider, profile editing, follows, navigation                                                    | Real campus source, hosted auth/SSO validation                                                                     |
| M2        | Posts, replies, quotes, likes, reposts, bookmarks, hashtags/mentions, Following, pinned profiles, FTS search                                  | Hosted end-to-end validation and feed load testing                                                                 |
| M3        | Topic selection, Local/Explore, optional Suggested/reasons, ranking styles, custom lists, mutes, regional/category trends, keyset pagination  | Ranking calibration and production cache/worker scheduling                                                         |
| M4        | RLS, posting/follow/link/message throttles, report queue, audited labels/reach/suspend/restore, appeal/verification/takedown models           | Operator identity review, retention/response operations, bot-provider integration                                  |
| M5        | Localization framework, English/Hindi core UI, six language files, translation adapter/cache, media/voice/polls/thread linking                | Full language audit, transcription adapter, device media testing and trusted scanner                               |
| M6        | SQL and TypeScript bridging algorithm, private not-helpful signal, viral slow mode, hostile reply confirmation, AI self-label/interface       | Historical cohort assignment, multilingual hostility/detection provider and adversarial evaluation                 |
| M7        | DMs/requests, group/room model, RLS membership, blocks, rate/size limits, Realtime                                                            | Device delivery tests; E2EE remains explicitly deferred                                                            |
| M8        | Test-only tips/subscription adapters and signed callbacks, creator counts, marketplace, paid-community and ad/revenue models, promoted labels | Full business analytics, provider sandbox validation, ad operations                                                |
| M9        | Event aggregation, verified account types, campus preview schema/consent contract                                                             | Actual campus sharing/trends integration and verified source onboarding                                            |
| M10       | Jest/RNTL, Playwright, database assertions, Edge checks, CI, deployment/build docs                                                            | Complete WCAG audit, performance budgets, full functional E2E, production observability, full export/deletion jobs |

Long-form articles, proven-protocol E2EE and self-serve ad management remain later milestones as requested. No custom encryption protocol is introduced. Export has a per-table cap; deletion requests remain queued until retention and media cleanup policies are configured. Those operations are not advertised as completed deletion or exhaustive export.
