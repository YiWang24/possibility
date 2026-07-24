-- 仅用于「无 Supabase CLI」时在纯 Postgres 上验证 migrations/seed。
-- 真实 Supabase 栈自带 auth/storage schema，这里只做最小 stub。
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
create table if not exists storage.objects (
  id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
