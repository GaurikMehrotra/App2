alter table profiles add column links text[] not null default '{}' check(cardinality(links)<=5);
grant update(links) on profiles to authenticated;
create function mention_notifications() returns trigger language plpgsql security definer set search_path=public as $$declare recipient uuid;begin
 for recipient in select distinct p.id from regexp_matches(new.body,'@([a-z0-9_]{3,30})','g') m join profiles p on p.handle=m[1] where p.id<>new.author_id and not blocked_between(p.id,new.author_id) loop
 insert into notifications(user_id,actor_id,kind,post_id)values(recipient,new.author_id,'mention',new.id);end loop;return new;end $$;
create trigger mentions after insert on posts for each row execute function mention_notifications();
create function notify_repost() returns trigger language plpgsql security definer set search_path=public as $$declare recipient uuid;begin select author_id into recipient from posts where id=new.post_id;if recipient<>new.user_id then insert into notifications(user_id,actor_id,kind,post_id)values(recipient,new.user_id,'repost',new.post_id);end if;return new;end $$;
create trigger repost_notifications after insert on reposts for each row execute function notify_repost();
create table campus_previews(id uuid primary key default gen_random_uuid(),author_id uuid not null references profiles on delete cascade,public_post_id uuid not null references posts on delete cascade,campus_post_id uuid not null,title text not null,excerpt text not null check(length(excerpt)<=300),source_url text not null,created_at timestamptz default now());
alter table campus_previews enable row level security;
create policy campus_preview_read on campus_previews for select using(exists(select 1 from posts where id=public_post_id));
-- A trusted campus sharing adapter must verify author, campus visibility and explicit sharing consent before writing previews. No client insert policy.
create table paid_communities(id uuid primary key default gen_random_uuid(),creator_id uuid not null references profiles on delete cascade,conversation_id uuid not null references conversations on delete cascade,price_paise integer not null check(price_paise>0),test_mode boolean not null default true check(test_mode));
alter table paid_communities enable row level security;
create policy communities_read on paid_communities for select using(true);
create table restrictions(owner_id uuid references profiles on delete cascade,target_id uuid references profiles on delete cascade,primary key(owner_id,target_id));
alter table restrictions enable row level security;
create policy restrict_access on restrictions for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create function enforce_restricted_replies() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.reply_to is not null and exists(select 1 from restrictions r join posts p on p.author_id=r.owner_id where p.id=new.reply_to and r.target_id=new.author_id) then raise exception 'Replies are restricted by this author';end if;return new;end $$;
create trigger restricted_replies before insert on posts for each row execute function enforce_restricted_replies();
-- Restricted accounts cannot add public replies to the owner.
