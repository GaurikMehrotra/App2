create function private_reach_score(post uuid) returns numeric language sql stable security definer set search_path=public as $$
select -least(10,count(*)::numeric) from not_helpful where post_id=post $$;
revoke all on function private_reach_score(uuid) from public;
grant execute on function private_reach_score(uuid) to authenticated;
create function get_feed(mode text default 'Following',style text default 'Latest',lang text default 'en',before_time timestamptz default null,before_id uuid default null) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;begin
 if mode='Suggested' and minor_account(auth.uid()) then raise exception 'Suggested feed is disabled for minors';end if;
 if mode not in('Following','Topics','Local','Explore','Suggested') or style not in('Latest','Balanced','Most helpful') then raise exception 'Invalid feed selection';end if;
 select coalesce(jsonb_agg(item),'[]'::jsonb) into result from(
 select to_jsonb(p)||jsonb_build_object('profiles',jsonb_build_object('handle',u.handle,'display_name',u.display_name,'verified_student',u.verified_student,'account_kind',u.account_kind),'promoted',exists(select 1 from ads a where a.post_id=p.id and a.status='approved' and a.brand_safe),'reason',case when mode='Suggested' then case style when 'Latest' then 'Recent conversation in your chosen language' when 'Balanced' then 'Account reputation and community context considered' else 'Helpful community context and private feedback considered' end else null end) item
 from posts p join profiles u on u.id=p.author_id where p.reply_to is null and not u.suspended and p.language=lang
 and(before_time is null or(p.created_at,p.id)<(before_time,before_id))
 and(mode in('Explore','Suggested') or mode='Following' and(p.author_id=auth.uid() or exists(select 1 from follows f where f.follower_id=auth.uid() and f.followee_id=p.author_id) or exists(select 1 from reposts r join follows f on f.followee_id=r.user_id where r.post_id=p.id and f.follower_id=auth.uid())) or mode='Topics' and exists(select 1 from post_topics pt join profile_topics ut on ut.topic_id=pt.topic_id where pt.post_id=p.id and ut.user_id=auth.uid()) or mode='Local' and p.city<>'' and p.city=(select city from profiles where id=auth.uid()))
 and not exists(select 1 from mutes m where m.owner_id=auth.uid() and(m.account_id=p.author_id or m.word is not null and strpos(lower(p.body),lower(m.word))>0 or m.topic is not null and exists(select 1 from post_topics pt join topics t on t.id=pt.topic_id where pt.post_id=p.id and t.name=m.topic)))
 order by case when mode='Suggested' and style<>'Latest' then (select count(*) from notes n where n.post_id=p.id and n.published)*3+private_reach_score(p.id)+(case when style='Balanced' then least(u.reputation,20)/10.0 else 0 end) else 0 end desc,p.created_at desc,p.id desc limit 25
 )rows;return result;end $$;
