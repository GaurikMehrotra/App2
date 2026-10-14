# Architecture

## Runtime and identity

Expo + Expo Router + React Native Web share apps/public across browsers, Android and iOS. packages/core owns the singleton Supabase client, auth provider and shared UI. Both apps must use the same Supabase Auth project and user UUID. Campus verification is server-managed; public users cannot grant themselves a student badge. Existing campus code is absent, so compatibility is an integration checkpoint, not a verified claim.

## Data model

M1 profiles references auth.users; follows joins follower/followee with a composite key. Server-managed verification fields live on profiles. Subsequent migrations normalize posts (reply/quote/thread references), post_media, likes, reposts, bookmarks, hashtags/post_hashtags, topics/post_topics, lists/list_members, mutes, blocks, reports, moderation_actions, appeals, notes, note_ratings, conversations/conversation_members, messages, subscriptions, tips, organizations, ads, ad_events, notifications and translations_cache. Polls use poll_options and poll_votes; events use event_posts. Every table gets explicit RLS and indexes before exposure. Counters use atomic database triggers and reconciliation jobs, never client increments.

## Feeds and search

Following is chronological and never algorithmically replaced. Start with fan-out on read and keyset pagination using (created_at,id). Index author/time and follow edges. Feed worker ranking interface supports Latest, Balanced and Most helpful; opt-in Suggested returns reason codes. Cache per-user pages briefly, invalidate on blocks/mutes and use CDN-backed Storage media. Move heavy audiences to asynchronous feed inbox fan-out with idempotent writes, keeping read-time merging for popular authors. Postgres FTS behind a search interface starts language-aware; Meilisearch/Typesense adapters can replace it.

## Moderation and trust

Validate at Edge Function and database boundaries. Server-side limits cover new-account posting, follows and mass replies. Behavioral, duplicate-content and link-velocity hooks feed reputation/reach decisions. Uploads enter quarantine and scanning before public distribution. Reports lead to audited moderator actions and transparent appeals; no client can grant moderator roles. Community Notes requires minimum raters and helpful agreement across distinct viewpoint clusters; interface and simulation tests in M6 will document thresholds and resistance to brigading. Hostile reply prompts supplement server slow mode. AI self-labels and detection hooks remain distinct evidence.

## Privacy and security

RLS is authoritative. Public profiles contain only public fields; email/date-of-birth never belong there. Auth/storage tokens stay in platform storage; native SecureStore is used for sessions. No service-role key ships to clients. Supabase gateway protections plus edge rate limiting, upload quotas and upstream DDoS controls require deployment configuration. Consent records, export jobs and deletion jobs are planned in M10 with data retention and DPDP principles; grievance/takedown operations require real operator contact details. Age gate/minor defaults must be enforced before general release. Structured logs redact tokens and private content; error tracking and provider hooks are feature flagged.

## Current implementation and release boundary

The repository now contains shared auth/profile/follow flows, text/media/poll/thread conversations, feeds/search/control screens, server safety controls, bridging consensus, messaging, creator test adapters and operator tools. README.md tracks exact coverage and remaining work. Hosted Supabase behavior and device behavior are unverified; campus integration needs source that was not present. Provider integrations fail closed when unconfigured.

## Operational fan-out and caching

For popular accounts, the path to fan-out on write is a durable post-created outbox, sharded follower scans and idempotent inbox inserts keyed by (recipient,post). Workers resume cursor checkpoints, bound concurrency and apply backpressure so publish requests never wait for follower delivery. A hybrid can keep exceptionally large audiences on read merging until cost measurements justify switching them. All inbox reads still recheck block/mute/privacy restrictions. Cache keys include viewer, filter/ranking selection and preference revision; blocks and mutes invalidate viewer pages immediately. No cross-user cached private query results are shared.

## Notes bridging algorithm

Prototype consensus deduplicates account ratings, requires four eligible raters and at least two viewpoint groups with two raters each and 75% helpful agreement per group. Viewpoint groups must be computed from historic rating disagreement by the server, never self-selected. This is a transparent prototype, not a claim of statistically robust consensus; production deployment needs calibrated eligibility and adversarial evaluation. Negative private helpfulness signals must never expose public counts.
