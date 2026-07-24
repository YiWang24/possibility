-- 0003_storage.sql — 语音日记音频桶（私有，仅本人读写）
insert into storage.buckets (id, name, public)
values ('diary-audio', 'diary-audio', false)
on conflict (id) do nothing;

-- 文件路径约定：<user_id>/<uuid>.m4a → 用首层目录名匹配 owner
create policy "diary owner read" on storage.objects for select
  using (bucket_id = 'diary-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "diary owner insert" on storage.objects for insert
  with check (bucket_id = 'diary-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "diary owner delete" on storage.objects for delete
  using (bucket_id = 'diary-audio' and (storage.foldername(name))[1] = auth.uid()::text);
