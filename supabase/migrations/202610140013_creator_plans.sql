create table subscription_plans(id uuid primary key default gen_random_uuid(),creator_id uuid unique not null references profiles on delete cascade,provider_plan_id text unique not null,amount_paise integer not null check(amount_paise>=100),test_mode boolean not null default true check(test_mode));
alter table subscription_plans enable row level security;
create policy plans_read on subscription_plans for select using(true);
create policy subscriptions_creator_read on subscriptions for select to authenticated using(creator_id=auth.uid());
create policy tips_creator_read on tips for select to authenticated using(creator_id=auth.uid());
create policy community_create on paid_communities for insert to authenticated with check(creator_id=auth.uid()and owns_conversation(conversation_id));
create function join_paid_community(community uuid)returns void language plpgsql security definer set search_path=public as $$declare c paid_communities;begin
 select * into c from paid_communities where id=community;if c.id is null then raise exception 'Community unavailable';end if;
 if not account_eligible(auth.uid())or blocked_between(auth.uid(),c.creator_id)then raise exception 'Membership unavailable';end if;
 if not exists(select 1 from subscriptions where creator_id=c.creator_id and subscriber_id=auth.uid()and status='active'and test_mode)then raise exception 'An active test subscription is required';end if;
 insert into conversation_members(conversation_id,user_id,accepted)values(c.conversation_id,auth.uid(),true)on conflict do nothing;end $$;
