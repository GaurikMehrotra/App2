create table user_safety(user_id uuid primary key references profiles on delete cascade,birth_date date not null,guardian_approved boolean not null default false,created_at timestamptz not null default now());
alter table user_safety enable row level security;
create policy safety_self_read on user_safety for select to authenticated using(user_id=auth.uid());
create policy safety_create on user_safety for insert to authenticated with check(user_id=auth.uid() and not guardian_approved and birth_date<=current_date and birth_date>current_date-interval '120 years');
revoke update,delete on user_safety from authenticated;
create function account_eligible(u uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from user_safety where user_id=u and(birth_date<=current_date-interval '18 years' or guardian_approved))$$;
create function minor_account(u uuid) returns boolean language sql stable security definer set search_path=public as $$select not exists(select 1 from user_safety where user_id=u and birth_date<=current_date-interval '18 years')$$;
create function age_post_guard() returns trigger language plpgsql security definer set search_path=public as $$begin if not account_eligible(new.author_id) then raise exception 'Complete age confirmation; minors require reviewed guardian consent';end if;if minor_account(new.author_id) then new.city='';new.state='';end if;return new;end $$;
create trigger age_post_check before insert on posts for each row execute function age_post_guard();
create function minor_location_guard() returns trigger language plpgsql security definer set search_path=public as $$begin if minor_account(new.id) and(new.city<>'' or new.state<>'') then raise exception 'Location sharing is disabled for minors';end if;return new;end $$;
create trigger minor_location before update of city,state on profiles for each row execute function minor_location_guard();
create function conversation_age_guard() returns trigger language plpgsql security definer set search_path=public as $$begin
 if not account_eligible(new.user_id) then raise exception 'Age confirmation required';end if;
 if minor_account(new.user_id) and new.user_id<>auth.uid() and not(exists(select 1 from follows where follower_id=new.user_id and followee_id=auth.uid()) and exists(select 1 from follows where follower_id=auth.uid() and followee_id=new.user_id)) then raise exception 'Minors accept invitations only from mutual follows';end if;return new;end $$;
create trigger membership_age before insert on conversation_members for each row execute function conversation_age_guard();
create function link_velocity_guard() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.body~'https?://' and(select count(*) from posts where author_id=new.author_id and body~'https?://' and created_at>now()-interval '1 hour')>=3 then raise exception 'Link velocity limit reached';end if;return new;end $$;
create trigger link_velocity before insert on posts for each row execute function link_velocity_guard();
create function viral_slow_mode() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.reply_to is not null and(select count(*) from posts where reply_to=new.reply_to and created_at>now()-interval '1 hour')>=100 then update posts set slow_seconds=greatest(slow_seconds,30) where id=new.reply_to;end if;return new;end $$;
create trigger viral_friction after insert on posts for each row execute function viral_slow_mode();
