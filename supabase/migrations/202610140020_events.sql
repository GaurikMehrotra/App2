alter publication supabase_realtime add table event_posts;
alter table posts add constraint source_https check(source_url is null or source_url like 'https://%');
