create table platform_settings(key text primary key,value integer not null check(value>0));
alter table platform_settings enable row level security;
create policy settings_read on platform_settings for select using(true);
insert into platform_settings(key,value)values('post_max_chars',500),('new_posts_per_hour',5),('posts_per_hour',30),('viral_replies_per_hour',100),('slow_mode_seconds',30);
alter table posts drop constraint posts_body_check;
create function post_size_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 if length(trim(new.body))<1 or length(new.body)>(select value from platform_settings where key='post_max_chars')then raise exception 'Post exceeds configured character limit';end if;return new;end $$;
create trigger post_size before insert on posts for each row execute function post_size_guard();
create or replace function viral_slow_mode()returns trigger language plpgsql security definer set search_path=public as $$begin if new.reply_to is not null and(select count(*)from posts where reply_to=new.reply_to and created_at>now()-interval '1 hour')>=(select value from platform_settings where key='viral_replies_per_hour')then update posts set slow_seconds=greatest(slow_seconds,(select value from platform_settings where key='slow_mode_seconds'))where id=new.reply_to;end if;return new;end $$;
create table provider_quotas(user_id uuid references profiles on delete cascade,operation text,bucket timestamptz,used integer not null default 0,primary key(user_id,operation,bucket));
alter table provider_quotas enable row level security;
create function consume_provider_quota(operation_name text)returns void language plpgsql security definer set search_path=public as $$declare used_count integer;begin
 if auth.uid()is null or operation_name not in('translation','payment','push')then raise exception 'Invalid operation';end if;
 insert into provider_quotas(user_id,operation,bucket,used)values(auth.uid(),operation_name,date_trunc('hour',now()),1)on conflict(user_id,operation,bucket)do update set used=provider_quotas.used+1 returning used into used_count;
 if used_count>20 then raise exception 'Provider rate limit reached';end if;end $$;
