insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values
 ('app2-quarantine','app2-quarantine',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','audio/mp4','audio/mpeg','audio/webm']),
 ('app2-media','app2-media',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4','audio/mp4','audio/mpeg','audio/webm']) on conflict(id) do nothing;
create policy quarantine_upload on storage.objects for insert to authenticated with check(bucket_id='app2-quarantine' and(storage.foldername(name))[1]=auth.uid()::text);
create policy quarantine_owner_read on storage.objects for select to authenticated using(bucket_id='app2-quarantine' and(storage.foldername(name))[1]=auth.uid()::text);
create policy quarantine_owner_delete on storage.objects for delete to authenticated using(bucket_id='app2-quarantine' and(storage.foldername(name))[1]=auth.uid()::text);
create policy scanned_media_read on storage.objects for select using(bucket_id='app2-media' and exists(select 1 from post_media m join posts p on p.id=m.post_id where m.path=storage.objects.name and m.scan_status='safe'));
