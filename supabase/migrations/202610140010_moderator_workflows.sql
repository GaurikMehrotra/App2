alter table moderation_actions drop constraint moderation_actions_action_check;
alter table moderation_actions add constraint moderation_actions_action_check check(action in('label','limit','suspend','restore','verify_human','verify_organization'));
create or replace function moderation_apply() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.action='suspend' then update profiles set suspended=true where id=new.target_id;
 elsif new.action='restore' then update profiles set suspended=false where id=new.target_id;update posts set limited=false where id=new.post_id;
 elsif new.action='limit' then update posts set limited=true where id=new.post_id;
 elsif new.action='label' then update posts set context_label=new.reason where id=new.post_id;
 elsif new.action='verify_human' then update profiles set verified_human=true where id=new.target_id;update verification_requests set status='approved' where user_id=new.target_id and kind='human';
 elsif new.action='verify_organization' then update organizations set verification_status='verified' where owner_id=new.target_id;update verification_requests set status='approved' where user_id=new.target_id and kind='organization';end if;return new;end $$;
create policy verification_queue on verification_requests for select to authenticated using(is_moderator());
create policy takedown_queue on takedown_requests for select to authenticated using(is_moderator());
create policy verified_org_read on organizations for select using(verification_status='verified');
create function resolve_appeal(appeal uuid,accepted boolean,explanation text)returns void language plpgsql security definer set search_path=public as $$declare target uuid;begin
 if not is_moderator()then raise exception 'Moderator access required';end if;if length(explanation)<5 then raise exception 'Explain this decision';end if;
 select user_id into target from appeals where id=appeal and status='pending' for update;
 if target is null then raise exception 'Pending appeal not found';end if;
 update appeals set status=case when accepted then 'accepted' else 'rejected' end where id=appeal;
 if accepted then insert into moderation_actions(moderator_id,target_id,action,reason)values(auth.uid(),target,'restore',explanation);end if;end $$;
