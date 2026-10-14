create table moderation_decisions(id uuid primary key default gen_random_uuid(),moderator_id uuid not null references profiles,subject_id uuid not null references profiles,report_id uuid references reports,appeal_id uuid references appeals,takedown_id uuid references takedown_requests,decision text not null,reason text not null check(length(reason)>=5),created_at timestamptz not null default now(),check(num_nonnulls(report_id,appeal_id,takedown_id)=1));
alter table moderation_decisions enable row level security;
create policy decisions_read on moderation_decisions for select to authenticated using(is_moderator()or subject_id=auth.uid());
create or replace function resolve_report(report uuid,explanation text)returns void language plpgsql security definer set search_path=public as $$declare subject uuid;begin
 if not is_moderator()then raise exception 'Moderator access required';end if;if length(explanation)<5 then raise exception 'Explain the resolution';end if;
 select reporter_id into subject from reports where id=report and status='open'for update;if subject is null then raise exception 'Open report not found';end if;
 insert into moderation_decisions(moderator_id,subject_id,report_id,decision,reason)values(auth.uid(),subject,report,'resolved',explanation);update reports set status='resolved'where id=report;end $$;
create or replace function resolve_appeal(appeal uuid,accepted boolean,explanation text)returns void language plpgsql security definer set search_path=public as $$declare target uuid;begin
 if not is_moderator()then raise exception 'Moderator access required';end if;if length(explanation)<5 then raise exception 'Explain the decision';end if;
 select user_id into target from appeals where id=appeal and status='pending'for update;if target is null then raise exception 'Pending appeal not found';end if;
 insert into moderation_decisions(moderator_id,subject_id,appeal_id,decision,reason)values(auth.uid(),target,appeal,case when accepted then 'accepted'else 'rejected'end,explanation);
 update appeals set status=case when accepted then 'accepted'else 'rejected'end where id=appeal;if accepted then insert into moderation_actions(moderator_id,target_id,action,reason)values(auth.uid(),target,'restore',explanation);end if;end $$;
create or replace function resolve_takedown(request uuid,accepted boolean,explanation text)returns void language plpgsql security definer set search_path=public as $$declare r takedown_requests;begin
 if not is_moderator()then raise exception 'Moderator access required';end if;if length(explanation)<5 then raise exception 'Explain the decision';end if;
 select * into r from takedown_requests where id=request and status='pending'for update;if r.id is null then raise exception 'Pending request not found';end if;
 insert into moderation_decisions(moderator_id,subject_id,takedown_id,decision,reason)values(auth.uid(),r.user_id,request,case when accepted then 'accepted'else 'rejected'end,explanation);
 if accepted and r.post_id is not null then insert into moderation_actions(moderator_id,post_id,action,reason)values(auth.uid(),r.post_id,'limit',explanation);end if;
 update takedown_requests set status=case when accepted then 'accepted'else 'rejected'end where id=request;end $$;
