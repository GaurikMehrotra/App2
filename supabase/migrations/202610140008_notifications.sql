alter table notifications add column pushed_at timestamptz;
create function notify_message() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into notifications(user_id,actor_id,kind)select user_id,new.sender_id,'dm' from conversation_members where conversation_id=new.conversation_id and accepted and user_id<>new.sender_id and not blocked_between(user_id,new.sender_id);return new;end $$;
create trigger message_notifications after insert on messages for each row execute function notify_message();
create function notify_context() returns trigger language plpgsql security definer set search_path=public as $$declare recipient uuid;begin
 if new.published and not old.published then select author_id into recipient from posts where id=new.post_id;insert into notifications(user_id,actor_id,kind,post_id)values(recipient,new.author_id,'notes',new.post_id);end if;return new;end $$;
create trigger note_notifications after update on notes for each row execute function notify_context();
