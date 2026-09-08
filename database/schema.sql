-- ============================================================
--  اسکیمای نهایی «پیمان» — یکپارچه‌سازی SQLهای مصوب
--  مراحل: [Stage 3] جداول | [Stage 4] RLS + توابع | [Stage 5] Storage
--  پیشوند قطعی: author_006_   (غیرقابل تغییر)
--  آمادهٔ اجرا در SQL Editor سوپابیس؛ idempotent (اجرای مجدد امن).
--  ترتیب: جداول → توابع → RLS → Storage → سطرهای پایه
-- ============================================================

-- ============================================================
--  بخش ۱ — جداول (author_006_*)
-- ============================================================

-- 1) مدیران (تعریف فقط از طریق RPC/bootstrap؛ هرگز از Frontend)
create table if not exists public.author_006_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2) تنظیمات سایت — سطر تکی
create table if not exists public.author_006_site_settings (
  id            uuid primary key default '00000000-0000-0000-0000-000000000001',
  site_title    text not null default '',
  tagline       text,
  contact_email text,
  contact_phone text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint author_006_site_settings_single_row
    check (id = '00000000-0000-0000-0000-000000000001')
);

-- 3) پروفایل ساختارمند نویسنده — سطر تکی
create table if not exists public.author_006_author_profile (
  id             uuid primary key default '00000000-0000-0000-0000-000000000002',
  full_name      text not null default '',
  title_role     text,
  photo_url      text,
  signature_quote text,
  bio_short      text,
  bio_full       text,
  email          text,
  phone          text,
  birth_year     integer,
  birth_place    text,
  education      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint author_006_author_profile_single_row
    check (id = '00000000-0000-0000-0000-000000000002')
);

-- 4) شبکه‌های اجتماعی — 1:N ← پروفایل
create table if not exists public.author_006_social_links (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references public.author_006_author_profile (id) on delete cascade,
  platform   text not null check (platform in ('instagram','x','telegram','whatsapp','email','website','other')),
  label      text,
  url        text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) کتاب‌ها (هویت ادبی)
create table if not exists public.author_006_books (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          text not null default 'book' check (type in ('book','collection','other')),
  year          integer,
  publisher     text,
  isbn          text,
  description   text,
  cover         text,
  purchase_url  text,
  download_url  text,
  is_published  boolean not null default false,
  is_featured   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 6) آثار نقاشی (هویت هنری)
create table if not exists public.author_006_artworks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  year          integer,
  technique     text,
  dimensions    text,
  category      text not null default 'other'
                check (category in ('abstract','calligraphy','traditional','portrait','landscape','still_life','figurative','floral','other')),
  collection    text,
  exhibition    text,
  price         bigint,
  sale_status   text not null default 'not_for_sale'
                check (sale_status in ('for_sale','sold','reserved','not_for_sale')),
  purchase_note text,
  image         text,
  images        text[] not null default '{}',
  is_published  boolean not null default false,
  is_featured   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 7) آثار ادبی (غیرکتاب)
create table if not exists public.author_006_literary_works (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'other'
                check (category in ('short_story','poem','essay','article','memoir','other')),
  excerpt       text,
  body          text,
  image         text,
  published_at  date,
  purchase_url  text,
  download_url  text,
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 8) نقدهای رسمی — چندنوعی (کتاب/اثر ادبی/نقاشی) — CD#10/#12
create table if not exists public.author_006_book_reviews (
  id          uuid primary key default gen_random_uuid(),
  item_type   text not null check (item_type in ('book','literary_work','artwork')),
  book_id     uuid references public.author_006_books (id) on delete cascade,
  work_id     uuid references public.author_006_literary_works (id) on delete cascade,
  artwork_id  uuid references public.author_006_artworks (id) on delete cascade,
  title       text not null,
  reviewer    text,
  review_text text not null,
  source      text,
  reviewed_at date,
  is_published boolean not null default false,
  is_featured  boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint author_006_book_reviews_exactly_one_ref check (
    (book_id is not null)::int + (work_id is not null)::int + (artwork_id is not null)::int = 1
  )
);

-- 9) دیدگاه خوانندگان — چندنوعی — CD#10/#15
create table if not exists public.author_006_book_comments (
  id              uuid primary key default gen_random_uuid(),
  item_type       text not null check (item_type in ('book','literary_work','artwork')),
  book_id         uuid references public.author_006_books (id) on delete cascade,
  work_id         uuid references public.author_006_literary_works (id) on delete cascade,
  artwork_id      uuid references public.author_006_artworks (id) on delete cascade,
  commenter_name  text not null,
  commenter_email text,
  comment_text    text not null,
  is_approved     boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint author_006_book_comments_exactly_one_ref check (
    (book_id is not null)::int + (work_id is not null)::int + (artwork_id is not null)::int = 1
  )
);

-- 10) جوایز و افتخارات — CD#11
create table if not exists public.author_006_awards (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  year         integer,
  organization text,
  description  text,
  book_id      uuid references public.author_006_books (id) on delete cascade,
  work_id      uuid references public.author_006_literary_works (id) on delete cascade,
  image        text,
  is_published boolean not null default false,
  is_featured  boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint author_006_awards_at_most_one_ref check (
    (book_id is not null)::int + (work_id is not null)::int <= 1
  )
);

-- 11) نمایشگاه‌ها — CD#13
create table if not exists public.author_006_exhibitions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  year         integer,
  location     text,
  country      text,
  organizer    text,
  type         text not null default 'solo'
               check (type in ('solo','group','joint','online','other')),
  description  text,
  image        text,
  images       text[] not null default '{}',
  is_published boolean not null default false,
  is_featured  boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 12) سوابق/رزومه (تایم‌لاین) — CD#18
create table if not exists public.author_006_timeline_items (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in ('education','teaching','career','artistic','literary','mentor','specialty','project','other')),
  period       text,
  title        text not null,
  description  text,
  is_published boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 13) پیام‌های فرم تماس — CD#14
create table if not exists public.author_006_messages (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text not null,
  subject    text,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ایندکس‌های پرکاربرد (نمایش عمومی + پنل مدیریت)
create index if not exists author_006_books_pub_idx  on public.author_006_books (is_published, is_featured, sort_order);
create index if not exists author_006_artworks_pub_idx on public.author_006_artworks (is_published, is_featured, sort_order);
create index if not exists author_006_works_pub_idx   on public.author_006_literary_works (is_published, sort_order);
create index if not exists author_006_reviews_type_idx on public.author_006_book_reviews (item_type, is_published, is_featured);
create index if not exists author_006_comments_ref_idx on public.author_006_book_comments (item_type, is_approved);
create index if not exists author_006_awards_pub_idx  on public.author_006_awards (is_published, is_featured, sort_order);
create index if not exists author_006_exhib_pub_idx   on public.author_006_exhibitions (is_published, is_featured, sort_order);
create index if not exists author_006_timeline_pub_idx on public.author_006_timeline_items (is_published, sort_order);
create index if not exists author_006_messages_read_idx on public.author_006_messages (is_read);
create index if not exists author_006_socials_sort_idx on public.author_006_social_links (sort_order);

-- ============================================================
--  بخش ۲ — تابع به‌روزرسانی updated_at
-- ============================================================
create or replace function public.author_006_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger author_006_touch_site_settings before update on public.author_006_site_settings
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_author_profile before update on public.author_006_author_profile
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_social_links before update on public.author_006_social_links
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_books before update on public.author_006_books
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_artworks before update on public.author_006_artworks
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_literary_works before update on public.author_006_literary_works
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_book_reviews before update on public.author_006_book_reviews
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_awards before update on public.author_006_awards
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_exhibitions before update on public.author_006_exhibitions
  for each row execute function public.author_006_touch_updated_at();
create trigger author_006_touch_timeline_items before update on public.author_006_timeline_items
  for each row execute function public.author_006_touch_updated_at();

-- ============================================================
--  بخش ۳ — توابع RPC
-- ============================================================

-- مدیر بودن کاربر جاری
create or replace function public.author_006_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.author_006_admins a
    where a.user_id = (select auth.uid())
  );
$$;

-- افزودن اولین مدیر با ایمیل (اجرای یک‌باره در SQL Editor)
create or replace function public.author_006_bootstrap_admin(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then
    return false;
  end if;
  insert into public.author_006_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
  return true;
end;
$$;

grant execute on function public.author_006_is_admin to anon, authenticated, service_role;
grant execute on function public.author_006_bootstrap_admin to authenticated, service_role;

-- ============================================================
--  بخش ۴ — RLS (ماتریس دسترسی مصوب)
-- ============================================================

-- ---------- admins: فقط مدیران ----------
alter table public.author_006_admins enable row level security;
drop policy if exists author_006_admins_all on public.author_006_admins;
create policy author_006_admins_all on public.author_006_admins
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- site_settings: خواندن عمومی، نوشتن فقط مدیر ----------
alter table public.author_006_site_settings enable row level security;
drop policy if exists author_006_site_settings_select on public.author_006_site_settings;
create policy author_006_site_settings_select on public.author_006_site_settings
  for select using (true);
drop policy if exists author_006_site_settings_admin on public.author_006_site_settings;
create policy author_006_site_settings_admin on public.author_006_site_settings
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- author_profile: خواندن عمومی، نوشتن فقط مدیر ----------
alter table public.author_006_author_profile enable row level security;
drop policy if exists author_006_author_profile_select on public.author_006_author_profile;
create policy author_006_author_profile_select on public.author_006_author_profile
  for select using (true);
drop policy if exists author_006_author_profile_admin on public.author_006_author_profile;
create policy author_006_author_profile_admin on public.author_006_author_profile
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- social_links: خواندن عمومی، نوشتن فقط مدیر ----------
alter table public.author_006_social_links enable row level security;
drop policy if exists author_006_social_links_select on public.author_006_social_links;
create policy author_006_social_links_select on public.author_006_social_links
  for select using (true);
drop policy if exists author_006_social_links_admin on public.author_006_social_links;
create policy author_006_social_links_admin on public.author_006_social_links
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- books: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_books enable row level security;
drop policy if exists author_006_books_public on public.author_006_books;
create policy author_006_books_public on public.author_006_books
  for select using (is_published = true);
drop policy if exists author_006_books_admin on public.author_006_books;
create policy author_006_books_admin on public.author_006_books
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- artworks: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_artworks enable row level security;
drop policy if exists author_006_artworks_public on public.author_006_artworks;
create policy author_006_artworks_public on public.author_006_artworks
  for select using (is_published = true);
drop policy if exists author_006_artworks_admin on public.author_006_artworks;
create policy author_006_artworks_admin on public.author_006_artworks
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- literary_works: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_literary_works enable row level security;
drop policy if exists author_006_literary_works_public on public.author_006_literary_works;
create policy author_006_literary_works_public on public.author_006_literary_works
  for select using (is_published = true);
drop policy if exists author_006_literary_works_admin on public.author_006_literary_works;
create policy author_006_literary_works_admin on public.author_006_literary_works
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- book_reviews: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_book_reviews enable row level security;
drop policy if exists author_006_book_reviews_public on public.author_006_book_reviews;
create policy author_006_book_reviews_public on public.author_006_book_reviews
  for select using (is_published = true);
drop policy if exists author_006_book_reviews_admin on public.author_006_book_reviews;
create policy author_006_book_reviews_admin on public.author_006_book_reviews
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- book_comments: درج عمومی (غیرتأیید) + نمایش فقط تأییدشده؛ مدیر همه ----------
alter table public.author_006_book_comments enable row level security;
drop policy if exists author_006_book_comments_insert_public on public.author_006_book_comments;
create policy author_006_book_comments_insert_public on public.author_006_book_comments
  for insert with check (is_approved = false);
drop policy if exists author_006_book_comments_select_public on public.author_006_book_comments;
create policy author_006_book_comments_select_public on public.author_006_book_comments
  for select using (is_approved = true);
drop policy if exists author_006_book_comments_admin on public.author_006_book_comments;
create policy author_006_book_comments_admin on public.author_006_book_comments
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- awards: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_awards enable row level security;
drop policy if exists author_006_awards_public on public.author_006_awards;
create policy author_006_awards_public on public.author_006_awards
  for select using (is_published = true);
drop policy if exists author_006_awards_admin on public.author_006_awards;
create policy author_006_awards_admin on public.author_006_awards
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- exhibitions: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_exhibitions enable row level security;
drop policy if exists author_006_exhibitions_public on public.author_006_exhibitions;
create policy author_006_exhibitions_public on public.author_006_exhibitions
  for select using (is_published = true);
drop policy if exists author_006_exhibitions_admin on public.author_006_exhibitions;
create policy author_006_exhibitions_admin on public.author_006_exhibitions
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- timeline_items: عمومی فقط منتشرشده؛ مدیر همه ----------
alter table public.author_006_timeline_items enable row level security;
drop policy if exists author_006_timeline_items_public on public.author_006_timeline_items;
create policy author_006_timeline_items_public on public.author_006_timeline_items
  for select using (is_published = true);
drop policy if exists author_006_timeline_items_admin on public.author_006_timeline_items;
create policy author_006_timeline_items_admin on public.author_006_timeline_items
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ---------- messages: درج عمومی؛ نمایش/به‌روزرسانی/حذف فقط مدیر ----------
alter table public.author_006_messages enable row level security;
drop policy if exists author_006_messages_insert_public on public.author_006_messages;
create policy author_006_messages_insert_public on public.author_006_messages
  for insert with check (true);
drop policy if exists author_006_messages_admin on public.author_006_messages;
create policy author_006_messages_admin on public.author_006_messages
  for all using (public.author_006_is_admin()) with check (public.author_006_is_admin());

-- ============================================================
--  بخش ۵ — Storage (Bucketها + Policyها)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('author-media-public', 'author-media-public', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('author-media-private', 'author-media-private', false)
on conflict (id) do nothing;

-- Bucket عمومی: خواندنِ فایل برای همه، نوشتن/حذف فقط مدیر
drop policy if exists author_006_public_read on storage.objects;
create policy author_006_public_read on storage.objects
  for select using (bucket_id = 'author-media-public');

drop policy if exists author_006_public_admin on storage.objects;
create policy author_006_public_admin on storage.objects
  for insert with check (bucket_id = 'author-media-public' and public.author_006_is_admin());
drop policy if exists author_006_public_admin_update on storage.objects;
create policy author_006_public_admin_update on storage.objects
  for update using (bucket_id = 'author-media-public' and public.author_006_is_admin())
  with check (bucket_id = 'author-media-public' and public.author_006_is_admin());
drop policy if exists author_006_public_admin_delete on storage.objects;
create policy author_006_public_admin_delete on storage.objects
  for delete using (bucket_id = 'author-media-public' and public.author_006_is_admin());

-- Bucket خصوصی: دسترسی کامل فقط مدیر (نمایش با Signed URL)
drop policy if exists author_006_private_admin on storage.objects;
create policy author_006_private_admin on storage.objects
  for all using (bucket_id = 'author-media-private' and public.author_006_is_admin())
  with check (bucket_id = 'author-media-private' and public.author_006_is_admin());

-- ============================================================
--  بخش ۶ — سطرهای پایه (ON CONFLICT => بی‌خطر در اجرای مجدد)
-- ============================================================
insert into public.author_006_site_settings (id, site_title)
values ('00000000-0000-0000-0000-000000000001', 'نویسنده و نقاش')
on conflict (id) do nothing;

insert into public.author_006_author_profile (id, full_name)
values ('00000000-0000-0000-0000-000000000002', '')
on conflict (id) do nothing;

-- ⚠️ پس از اجرا، مدیر اول را یک‌بار با ایمیل خودتان بسازید:
-- select public.author_006_bootstrap_admin('ایمیل-شما@gmail.com');