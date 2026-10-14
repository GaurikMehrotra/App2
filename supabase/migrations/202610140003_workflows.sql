alter table profiles add column pinned_post uuid references posts on delete set null;
grant update(pinned_post) on profiles to authenticated;
create function profile_pin_guard() returns trigger language plpgsql as $$begin if new.pinned_post is not null and not exists(select 1 from posts where id=new.pinned_post and author_id=new.id) then raise exception 'Only your own posts can be pinned';end if;return new;end $$;
create trigger pin_guard before update of pinned_post on profiles for each row execute function profile_pin_guard();
create function reply_counter() returns trigger language plpgsql security definer set search_path=public as $$begin if TG_OP='INSERT' then update posts set reply_count=reply_count+1 where id=new.reply_to;return new;else update posts set reply_count=greatest(0,reply_count-1) where id=old.reply_to;return old;end if;end $$;
create trigger reply_counts after insert or delete on posts for each row execute function reply_counter();
create function notify_post() returns trigger language plpgsql security definer set search_path=public as $$declare recipient uuid;begin
 if new.reply_to is not null then select author_id into recipient from posts where id=new.reply_to;if recipient<>new.author_id then insert into notifications(user_id,actor_id,kind,post_id) values(recipient,new.author_id,'reply',new.id);end if;end if;return new;end $$;
create trigger reply_notification after insert on posts for each row execute function notify_post();
create function notify_follow() returns trigger language plpgsql security definer set search_path=public as $$begin insert into notifications(user_id,actor_id,kind)values(new.followee_id,new.follower_id,'follow');return new;end $$;
create trigger follow_notification after insert on follows for each row execute function notify_follow();
create policy notifications_read_update on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke update on notifications from authenticated;grant update(read_at) on notifications to authenticated;
create policy polls_create on polls for insert to authenticated with check(owns_post(post_id) and ends_at>now());
create policy options_create on poll_options for insert to authenticated with check(exists(select 1 from polls where id=poll_id and owns_post(post_id)));
create policy votes_create on poll_votes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from polls where id=poll_id and ends_at>now()) and exists(select 1 from poll_options where id=option_id and poll_id=poll_votes.poll_id));
create function index_post() returns trigger language plpgsql security definer set search_path=public as $$declare tag text;begin
 for tag in select lower(m[1]) from regexp_matches(new.body,'#([[:alnum:]_]+)','g') as m loop
 insert into hashtags(name)values(tag) on conflict do nothing;
 insert into post_hashtags(post_id,hashtag_id) select new.id,id from hashtags where name=tag on conflict do nothing;end loop;return new;end $$;
create trigger post_tags after insert on posts for each row execute function index_post();
create function regional_trends(region text default '',lang text default 'en') returns table(tag text,score numeric) language sql stable security invoker set search_path=public as $$
 select h.name,sum(least(1.0,extract(epoch from(now()-p.created_at))/604800))::numeric
 from hashtags h join post_hashtags ph on ph.hashtag_id=h.id join posts p on p.id=ph.post_id
 where p.created_at>now()-interval '24 hours' and p.language=lang and(region='' or p.city=region or p.state=region)
 and p.id in(select distinct on(p2.author_id,ph2.hashtag_id)p2.id from posts p2 join post_hashtags ph2 on ph2.post_id=p2.id where p2.created_at>now()-interval '24 hours' order by p2.author_id,ph2.hashtag_id,p2.created_at)
 group by h.name order by 2 desc limit 20 $$;
-- Account-age weighting replaces post-age weighting.
create or replace function regional_trends(region text default '',lang text default 'en') returns table(tag text,score numeric) language sql stable security invoker set search_path=public as $$
 with unique_mentions as(select distinct ph.hashtag_id,p.author_id from post_hashtags ph join posts p on p.id=ph.post_id where p.created_at>now()-interval '24 hours' and p.language=lang and(region='' or p.city=region or p.state=region))
 select h.name,sum(least(1.0,extract(epoch from(now()-u.created_at))/604800))::numeric from unique_mentions m join hashtags h on h.id=m.hashtag_id join profiles u on u.id=m.author_id where not u.suspended group by h.name order by 2 desc limit 20 $$;
create policy collaboration_create on collaborations for insert to authenticated with check(brand_id=auth.uid());
-- Financial rows remain provider-owned; client requests must use a verified payment adapter.
create function message_limits() returns trigger language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,2));
 if exists(select 1 from profiles where id=new.sender_id and suspended) or(select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=10 then raise exception 'Messaging limit reached';end if;return new;end $$;
create trigger message_rate before insert on messages for each row execute function message_limits();
