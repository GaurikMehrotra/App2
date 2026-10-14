-- Rater cohorts are assigned from historical disagreement by trusted jobs, not clients.
create table note_cohorts(user_id uuid primary key references profiles on delete cascade,cohort text not null);
alter table note_cohorts enable row level security;
create function evaluate_note() returns trigger language plpgsql security definer set search_path=public as $$declare n uuid;groups integer;begin
 n=coalesce(new.note_id,old.note_id);
 select count(*) into groups from(select c.cohort from note_ratings r join note_cohorts c on c.user_id=r.user_id join profiles p on p.id=r.user_id where r.note_id=n and p.reputation>=10 and not p.suspended group by c.cohort having count(*)>=2 and avg(case when r.helpful then 1.0 else 0.0 end)>=0.75) g;
 update notes set published=groups>=2 where id=n;return coalesce(new,old);end $$;
create trigger note_consensus after insert or update or delete on note_ratings for each row execute function evaluate_note();
-- Opaque requests may only enter the pending queue; all status transitions are operator-owned.
revoke update,delete on reports,appeals,verification_requests,takedown_requests,privacy_requests from authenticated;
create function pending_request_guard() returns trigger language plpgsql as $$begin
 if new.status<>(case when TG_TABLE_NAME='reports' then 'open' else 'pending' end) then raise exception 'Invalid request status';end if;return new;end $$;
create trigger reports_pending before insert on reports for each row execute function pending_request_guard();
create trigger appeals_pending before insert on appeals for each row execute function pending_request_guard();
create trigger verification_pending before insert on verification_requests for each row execute function pending_request_guard();
create trigger takedown_pending before insert on takedown_requests for each row execute function pending_request_guard();
create trigger privacy_pending before insert on privacy_requests for each row execute function pending_request_guard();
-- Prevent clients changing note authors, post moderation flags or money status via broad default privileges.
revoke update on posts,notes,post_media,tips,subscriptions,ads,organizations,revenue_shares from authenticated;
revoke insert,update,delete on moderator_roles,note_cohorts,translations_cache,revenue_shares,tips,subscriptions,ads,organizations from authenticated;
-- Community labels are stored and applied with audit history.
alter table posts add column context_label text;
create or replace function moderation_apply() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.action='suspend' then update profiles set suspended=true where id=new.target_id;
 elsif new.action='restore' then update profiles set suspended=false where id=new.target_id;update posts set limited=false where id=new.post_id;
 elsif new.action='limit' then update posts set limited=true where id=new.post_id;
 elsif new.action='label' then update posts set context_label=new.reason where id=new.post_id;end if;return new;end $$;
-- No client-chosen media may bypass quarantine; delivery only follows a trusted scan.
create function media_limits_guard() returns trigger language plpgsql as $$begin
 if new.kind='image' and new.bytes>10485760 then raise exception 'Image limit is 10MB';end if;
 if new.kind='video' and new.duration_seconds>60 then raise exception 'Video limit is 60 seconds';end if;
 if new.kind='voice' and new.bytes>5242880 then raise exception 'Voice limit is 5MB';end if;return new;end $$;
create trigger media_limits before insert or update on post_media for each row execute function media_limits_guard();
