-- EyeSay social chat schema. Run in Supabase SQL Editor.
-- Browser clients receive only the publishable key; every data path is protected by RLS.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_uid text not null unique check (public_uid ~ '^ES-[A-F0-9]{12}$'),
  display_name text not null check (char_length(display_name) between 2 and 40 and display_name !~ E'[\r\n]'),
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (user_low < user_high),
  check (requested_by in (user_low,user_high)),
  unique (user_low,user_high)
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm','group')),
  title text check (title is null or (char_length(title) between 2 and 60 and title !~ E'[\r\n]')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  dm_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'dm' and dm_key is not null and title is null) or (kind = 'group' and dm_key is null and title is not null))
);

create table if not exists public.chat_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (thread_id,user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_time_idx on public.chat_messages(thread_id,created_at desc);
create index if not exists chat_members_user_idx on public.chat_members(user_id,thread_id);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

revoke all on public.profiles,public.friendships,public.chat_threads,public.chat_members,public.chat_messages from anon,authenticated;
grant select on public.profiles,public.friendships,public.chat_threads,public.chat_members to authenticated;
grant select,insert on public.chat_messages to authenticated;
grant usage on schema private to authenticated;

create or replace function private.are_friends(a uuid,b uuid)
returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.friendships f where f.user_low=least(a,b) and f.user_high=greatest(a,b) and f.status='accepted');
$$;
create or replace function private.is_thread_member(thread uuid,member uuid)
returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.chat_members m where m.thread_id=thread and m.user_id=member);
$$;
create or replace function private.share_thread(a uuid,b uuid)
returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.chat_members x join public.chat_members y on y.thread_id=x.thread_id where x.user_id=a and y.user_id=b);
$$;
create or replace function private.can_send_now(sender uuid)
returns boolean language sql security definer set search_path='' stable as $$
  select (select count(*) from public.chat_messages m where m.sender_id=sender and m.created_at>now()-interval '1 minute')<30;
$$;
revoke all on function private.are_friends(uuid,uuid),private.is_thread_member(uuid,uuid),private.share_thread(uuid,uuid),private.can_send_now(uuid) from public;
grant execute on function private.are_friends(uuid,uuid),private.is_thread_member(uuid,uuid),private.share_thread(uuid,uuid),private.can_send_now(uuid) to authenticated;

drop policy if exists "profile visible to related users" on public.profiles;
create policy "profile visible to related users" on public.profiles for select to authenticated using (
  auth.uid() is not null and (id=auth.uid() or private.are_friends(auth.uid(),id) or private.share_thread(auth.uid(),id))
);
drop policy if exists "friendships visible to parties" on public.friendships;
create policy "friendships visible to parties" on public.friendships for select to authenticated using (auth.uid() in (user_low,user_high));
drop policy if exists "threads visible to members" on public.chat_threads;
create policy "threads visible to members" on public.chat_threads for select to authenticated using (private.is_thread_member(id,auth.uid()));
drop policy if exists "members visible within own threads" on public.chat_members;
create policy "members visible within own threads" on public.chat_members for select to authenticated using (private.is_thread_member(thread_id,auth.uid()));
drop policy if exists "messages visible within own threads" on public.chat_messages;
create policy "messages visible within own threads" on public.chat_messages for select to authenticated using (private.is_thread_member(thread_id,auth.uid()));
drop policy if exists "members send as themselves" on public.chat_messages;
create policy "members send as themselves" on public.chat_messages for insert to authenticated with check (
  sender_id=auth.uid() and private.is_thread_member(thread_id,auth.uid()) and private.can_send_now(sender_id)
);

create or replace function private.make_public_uid()
returns text language plpgsql security definer set search_path='' as $$
declare candidate text;
begin
  loop
    candidate:='ES-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    exit when not exists(select 1 from public.profiles where public_uid=candidate);
  end loop;
  return candidate;
end;
$$;
revoke all on function private.make_public_uid() from public,anon,authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare safe_name text;
begin
  safe_name:=trim(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'display_name',split_part(coalesce(new.email,'EyeSay user'),'@',1)));
  safe_name:=regexp_replace(safe_name,E'[\r\n]+',' ','g');
  if char_length(safe_name)<2 then safe_name:='ผู้ใช้ EyeSay'; end if;
  insert into public.profiles(id,public_uid,display_name) values(new.id,private.make_public_uid(),left(safe_name,40)) on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

with existing_users as (
  select u.id,regexp_replace(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(u.raw_user_meta_data->>'name'),''),split_part(coalesce(u.email,'EyeSay user'),'@',1),'ผู้ใช้ EyeSay'),E'[\r\n]+',' ','g') safe_name
  from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id)
)
insert into public.profiles(id,public_uid,display_name)
select id,private.make_public_uid(),case when char_length(safe_name)<2 then 'ผู้ใช้ EyeSay' else left(safe_name,40) end from existing_users;

create or replace function public.request_contact(target_public_uid text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();target uuid;low_id uuid;high_id uuid;result uuid;
begin
  if me is null then raise exception 'กรุณาล็อกอิน'; end if;
  if (select count(*) from public.friendships where me in (user_low,user_high))>=50 then raise exception 'มีรายชื่อหรือคำขอครบ 50 รายการแล้ว'; end if;
  select id into target from public.profiles where public_uid=upper(trim(target_public_uid));
  if target is null then raise exception 'ไม่พบ UID นี้'; end if;
  if target=me then raise exception 'เพิ่มตัวเองไม่ได้'; end if;
  low_id:=least(me,target);high_id:=greatest(me,target);
  insert into public.friendships(user_low,user_high,requested_by) values(low_id,high_id,me)
  on conflict(user_low,user_high) do update set
    status=case when friendships.status='pending' and friendships.requested_by<>me then 'accepted' else friendships.status end,
    accepted_at=case when friendships.status='pending' and friendships.requested_by<>me then now() else friendships.accepted_at end
  returning id into result;
  return result;
end;
$$;

create or replace function public.respond_contact(friendship_id uuid,accept_request boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();f public.friendships;
begin
  select * into f from public.friendships where id=friendship_id and me in (user_low,user_high) for update;
  if f.id is null or f.status<>'pending' or f.requested_by=me then raise exception 'คำขอนี้ไม่พร้อมให้ตอบรับ'; end if;
  if accept_request then update public.friendships set status='accepted',accepted_at=now() where id=f.id;
  else delete from public.friendships where id=f.id; end if;
end;
$$;

create or replace function public.list_contacts()
returns table(friendship_id uuid,other_id uuid,public_uid text,display_name text,status text,direction text)
language sql security definer set search_path='' stable as $$
  select f.id,case when f.user_low=auth.uid() then f.user_high else f.user_low end,p.public_uid,p.display_name,f.status,
    case when f.requested_by=auth.uid() then 'outgoing' else 'incoming' end
  from public.friendships f join public.profiles p on p.id=case when f.user_low=auth.uid() then f.user_high else f.user_low end
  where auth.uid() in (f.user_low,f.user_high)
  order by (f.status='pending') desc,p.display_name,p.public_uid;
$$;

create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();key text;result uuid;
begin
  if me is null or not private.are_friends(me,other_user_id) then raise exception 'คุยได้เฉพาะเพื่อนที่ตอบรับแล้ว'; end if;
  key:=least(me,other_user_id)::text||':'||greatest(me,other_user_id)::text;
  insert into public.chat_threads(kind,created_by,dm_key) values('dm',me,key)
    on conflict(dm_key) do update set updated_at=public.chat_threads.updated_at returning id into result;
  insert into public.chat_members(thread_id,user_id,role) values(result,me,'member'),(result,other_user_id,'member') on conflict do nothing;
  return result;
end;
$$;

create or replace function public.create_group(group_name text,member_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();clean_name text:=trim(group_name);member_count int;result uuid;
begin
  if me is null then raise exception 'กรุณาล็อกอิน'; end if;
  if char_length(clean_name) not between 2 and 60 or clean_name~E'[\r\n]' then raise exception 'ชื่อกลุ่มต้องมี 2–60 ตัวอักษร'; end if;
  select count(distinct value) into member_count from unnest(coalesce(member_ids,'{}'::uuid[])) value where value<>me;
  if member_count<1 or member_count>20 then raise exception 'เลือกสมาชิก 1–20 คน'; end if;
  if exists(select 1 from (select distinct value id from unnest(member_ids) value where value<>me) x where not private.are_friends(me,x.id)) then raise exception 'เพิ่มได้เฉพาะเพื่อนที่ตอบรับแล้ว'; end if;
  insert into public.chat_threads(kind,title,created_by) values('group',clean_name,me) returning id into result;
  insert into public.chat_members(thread_id,user_id,role) values(result,me,'owner');
  insert into public.chat_members(thread_id,user_id,role) select result,value,'member' from (select distinct value from unnest(member_ids) value where value<>me) x;
  return result;
end;
$$;

create or replace function public.list_chat_threads()
returns table(thread_id uuid,kind text,title text,member_count bigint,last_message text,updated_at timestamptz)
language sql security definer set search_path='' stable as $$
  select t.id,t.kind,
    case when t.kind='group' then t.title else coalesce(other_profile.display_name,'ข้อความส่วนตัว') end,
    (select count(*) from public.chat_members total where total.thread_id=t.id),
    latest.body,t.updated_at
  from public.chat_threads t
  join public.chat_members mine on mine.thread_id=t.id and mine.user_id=auth.uid()
  left join lateral (
    select p.display_name from public.chat_members other join public.profiles p on p.id=other.user_id
    where other.thread_id=t.id and other.user_id<>auth.uid() limit 1
  ) other_profile on true
  left join lateral (
    select m.body from public.chat_messages m where m.thread_id=t.id order by m.created_at desc limit 1
  ) latest on true
  order by t.updated_at desc;
$$;

create or replace function public.bump_thread_on_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin update public.chat_threads set updated_at=new.created_at where id=new.thread_id;return new;end;
$$;
revoke all on function public.bump_thread_on_message() from public,anon,authenticated;
drop trigger if exists on_chat_message_created on public.chat_messages;
create trigger on_chat_message_created after insert on public.chat_messages for each row execute function public.bump_thread_on_message();

revoke all on function public.request_contact(text),public.respond_contact(uuid,boolean),public.list_contacts(),public.get_or_create_dm(uuid),public.create_group(text,uuid[]),public.list_chat_threads() from public,anon;
grant execute on function public.request_contact(text),public.respond_contact(uuid,boolean),public.list_contacts(),public.get_or_create_dm(uuid),public.create_group(text,uuid[]),public.list_chat_threads() to authenticated;

do $$ begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end $$;
