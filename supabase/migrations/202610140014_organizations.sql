alter table verification_requests add column organization_name text,add column requested_kind text check(requested_kind in('business','news','journalist','official'));
create function organization_request()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.kind='organization' then if length(coalesce(new.organization_name,''))<3 then raise exception 'Provide the organization name';end if;insert into organizations(owner_id,name)values(new.user_id,new.organization_name);end if;return new;end $$;
create trigger org_request after insert on verification_requests for each row execute function organization_request();
create function verified_organization_profile()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.action='verify_organization'then update profiles set account_kind=coalesce((select requested_kind from verification_requests where user_id=new.target_id and kind='organization'order by created_at desc limit 1),'official')where id=new.target_id;end if;return new;end $$;
create trigger org_profile after insert on moderation_actions for each row execute function verified_organization_profile();
create function paid_membership_guard()returns trigger language plpgsql security definer set search_path=public as $$declare creator uuid;begin
 select creator_id into creator from paid_communities where conversation_id=new.conversation_id;
 if creator is not null and new.user_id<>creator and not exists(select 1 from subscriptions where creator_id=creator and subscriber_id=new.user_id and status='active'and test_mode)then raise exception 'Active test subscription required';end if;return new;end $$;
create trigger paid_member before insert or update on conversation_members for each row execute function paid_membership_guard();
