-- ============================================================
-- Ne Giysem? — İlk Şema Migrasyonu
-- ============================================================

-- UUID desteği (Supabase'de genellikle aktif, emin olmak için)
create extension if not exists "uuid-ossp";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  age_range  text check (age_range in ('18-24','25-34','35-44','45-54','55+')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Kullanici kendi profilini okuyabilir"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Kullanici kendi profilini guncelleyebilir"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Kullanici kendi profilini ekleyebilir"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- style_profiles
-- ============================================================
create table if not exists public.style_profiles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- Örnek: [{"style":"Minimalist","weight":60},{"style":"Old Money","weight":40}]
  styles        jsonb not null default '[]'::jsonb,
  -- Örnek: {"dominant":["#1A1A2E","#FFFFFF"],"accent":"#E94560"}
  color_palette jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table public.style_profiles enable row level security;

create policy "Kullanici kendi stil profilini okuyabilir"
  on public.style_profiles for select
  using (auth.uid() = user_id);

create policy "Kullanici kendi stil profilini ekleyebilir"
  on public.style_profiles for insert
  with check (auth.uid() = user_id);

create policy "Kullanici kendi stil profilini guncelleyebilir"
  on public.style_profiles for update
  using (auth.uid() = user_id);

create policy "Kullanici kendi stil profilini silebilir"
  on public.style_profiles for delete
  using (auth.uid() = user_id);

-- ============================================================
-- wardrobe_items
-- ============================================================
create table if not exists public.wardrobe_items (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  -- Örnek: 'ust', 'alt', 'dis', 'ayakkabi', 'aksesuar'
  category             text not null,
  -- Örnek: 'tisort', 'gomlek', 'pantolon', 'etek', 'ceket', 'bot'
  subcategory          text,
  -- Örnek: [{"hex":"#FFFFFF","name":"Beyaz","ratio":0.85}]
  colors               jsonb not null default '[]'::jsonb,
  -- Örnek: 'duz', 'cizgili', 'ekose', 'cicekli', 'kareli', 'geometrik'
  pattern              text,
  -- Örnek: ["ilkbahar","yaz"] — birden fazla mevsim olabilir
  season               jsonb not null default '[]'::jsonb,
  -- Örnek: 'Pamuk', 'Denim', 'Ipek', 'Yun', 'Polyester', 'Bilmiyorum'
  fabric               text,
  image_url            text,
  processed_image_url  text,
  brand                text,
  price                numeric(10, 2),
  created_at           timestamptz not null default now()
);

create index idx_wardrobe_items_user_id   on public.wardrobe_items(user_id);
create index idx_wardrobe_items_category  on public.wardrobe_items(category);

alter table public.wardrobe_items enable row level security;

create policy "Kullanici kendi dolap parcalarini okuyabilir"
  on public.wardrobe_items for select
  using (auth.uid() = user_id);

create policy "Kullanici kendi dolap parcalarini ekleyebilir"
  on public.wardrobe_items for insert
  with check (auth.uid() = user_id);

create policy "Kullanici kendi dolap parcalarini guncelleyebilir"
  on public.wardrobe_items for update
  using (auth.uid() = user_id);

create policy "Kullanici kendi dolap parcalarini silebilir"
  on public.wardrobe_items for delete
  using (auth.uid() = user_id);

-- ============================================================
-- combos
-- ============================================================
create table if not exists public.combos (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- Örnek: [{"item_id":"uuid","category":"ust"},{"item_id":"uuid","category":"alt"}]
  items      jsonb not null default '[]'::jsonb,
  score      numeric(4, 2) check (score >= 0 and score <= 100),
  -- Örnek: 'gundelik', 'is', 'aksam', 'dugun', 'spor', 'seyahat'
  occasion   text,
  worn_at    timestamptz,
  created_at timestamptz not null default now()
);

create index idx_combos_user_id  on public.combos(user_id);
create index idx_combos_occasion on public.combos(occasion);

alter table public.combos enable row level security;

create policy "Kullanici kendi kombinlerini okuyabilir"
  on public.combos for select
  using (auth.uid() = user_id);

create policy "Kullanici kendi kombinlerini ekleyebilir"
  on public.combos for insert
  with check (auth.uid() = user_id);

create policy "Kullanici kendi kombinlerini guncelleyebilir"
  on public.combos for update
  using (auth.uid() = user_id);

create policy "Kullanici kendi kombinlerini silebilir"
  on public.combos for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Yeni kayıt olunca profiles tablosunu otomatik doldur
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
