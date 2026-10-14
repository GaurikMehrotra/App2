create function post_location()returns trigger language plpgsql security definer set search_path=public as $$begin if not minor_account(new.author_id)then select city,state into new.city,new.state from profiles where id=new.author_id;else new.city='';new.state='';end if;return new;end $$;
create trigger post_location_defaults before insert on posts for each row execute function post_location();
create policy member_decline on conversation_members for delete to authenticated using(user_id=auth.uid());
create function message_requests()returns table(conversation_id uuid,name text,inviter_handle text)language sql stable security definer set search_path=public as $$select c.id,c.name,p.handle from conversation_members m join conversations c on c.id=m.conversation_id join profiles p on p.id=c.owner_id where m.user_id=auth.uid()and not m.accepted and not blocked_between(m.user_id,c.owner_id)$$;
create function group_size_guard()returns trigger language plpgsql security definer set search_path=public as $$declare k text;begin
 perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text,3));select kind into k from conversations where id=new.conversation_id;
 if(select count(*)from conversation_members where conversation_id=new.conversation_id)>=(case when k='direct'then 2 when k='group'then 20 else 50 end)then raise exception 'Conversation size limit reached';end if;return new;end $$;
create trigger group_size before insert on conversation_members for each row execute function group_size_guard();
