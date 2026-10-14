alter table paid_communities add column name text not null default 'Community' check(length(name)<=80);
alter table subscriptions add column created_at timestamptz not null default now();
alter table tips add column created_at timestamptz not null default now();
create policy owner_ad_events on ad_events for select to authenticated using(exists(select 1 from ads where id=ad_id and owner_id=auth.uid()));
create policy event_create on events for insert to authenticated with check(is_moderator());
create policy event_attach on event_posts for insert to authenticated with check(is_moderator());
create function resolve_report(report uuid,explanation text)returns void language plpgsql security definer set search_path=public as $$begin if not is_moderator()then raise exception 'Moderator access required';end if;if length(explanation)<5 then raise exception 'Explain the resolution';end if;update reports set status='resolved'where id=report;end $$;
create function resolve_takedown(request uuid,accepted boolean,explanation text)returns void language plpgsql security definer set search_path=public as $$declare r takedown_requests;begin
 if not is_moderator()then raise exception 'Moderator access required';end if;if length(explanation)<5 then raise exception 'Explain the decision';end if;
 select * into r from takedown_requests where id=request and status='pending'for update;if r.id is null then raise exception 'Pending request not found';end if;
 if accepted and r.post_id is not null then insert into moderation_actions(moderator_id,post_id,action,reason)values(auth.uid(),r.post_id,'limit',explanation);end if;
 update takedown_requests set status=case when accepted then 'accepted'else 'rejected'end where id=request;end $$;
