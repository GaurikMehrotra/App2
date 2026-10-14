create table payment_events(provider_event_id text primary key,event_type text not null,created_at timestamptz default now(),applied boolean not null default false);
alter table payment_events enable row level security;
alter table subscriptions add column provider_event_at bigint not null default 0;
