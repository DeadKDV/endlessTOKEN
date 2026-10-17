-- RV Tycoon — схема Supabase (Postgres). Применить: supabase db push или в SQL Editor.
-- Все таблицы с RLS: игрок видит и пишет только своё; серверные проверки — в Edge Functions.

create extension if not exists pgcrypto;

-- ---------- профиль и сейв ----------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  guild_id uuid,
  created_at timestamptz default now()
);

create table if not exists saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,            -- GameState из src/sim/types.ts
  saved_at timestamptz not null default now(),
  max_floor int generated always as ((state->>'maxFloor')::int) stored,
  crystals int generated always as ((state->>'crystals')::int) stored
);
create index if not exists saves_max_floor on saves (max_floor desc);

-- ---------- престиж и оффлайн: журнал для античита ----------
create table if not exists prestige_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  max_floor int not null,
  crystals_gained int not null,
  created_at timestamptz default now()
);

-- ---------- реклама: счётчики и награды выдаёт сервер ----------
create type ad_kind as enum ('speed', 'resources', 'gems', 'boost');
create table if not exists ad_rewards (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  kind ad_kind not null,
  provider text not null default 'stub',   -- stub | adsense | applixir | yandex
  provider_ref text,                        -- id показа от сети (callback); null для stub
  granted_at timestamptz default now()
);
create index if not exists ad_rewards_user_day on ad_rewards (user_id, granted_at);

-- ---------- гильдии ----------
create table if not exists guilds (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  leader_id uuid references auth.users(id),
  level int default 1,
  rating int default 1000,
  created_at timestamptz default now()
);
create type guild_role as enum ('leader', 'officer', 'member');
create table if not exists guild_members (
  guild_id uuid references guilds(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role guild_role default 'member',
  joined_at timestamptz default now(),
  primary key (guild_id, user_id)
);
create table if not exists guild_chat (
  id bigserial primary key,
  guild_id uuid references guilds(id) on delete cascade,
  user_id uuid references auth.users(id),
  text text check (char_length(text) <= 300),
  created_at timestamptz default now()
);

-- ---------- рейд-босс: один в сутки на гильдию ----------
create table if not exists raids (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid references guilds(id) on delete cascade,
  day date not null,
  race text not null,
  hp_max double precision not null,
  hp_left double precision not null,
  unique (guild_id, day)
);
create table if not exists raid_hits (
  id bigserial primary key,
  raid_id uuid references raids(id) on delete cascade,
  user_id uuid references auth.users(id),
  seed int not null,
  party jsonb not null,            -- PartyMember[] на момент удара
  damage_claimed double precision not null,
  damage_verified double precision,  -- пересчёт сервером по sim/
  accepted boolean,
  created_at timestamptz default now()
);

-- ---------- война гильдий ----------
create table if not exists wars (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  guild_a uuid references guilds(id),
  guild_b uuid references guilds(id),
  score_a int default 0,
  score_b int default 0,
  finished boolean default false
);
create table if not exists war_defenses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  party jsonb not null,            -- защитный отряд
  updated_at timestamptz default now()
);
create table if not exists war_attacks (
  id bigserial primary key,
  war_id uuid references wars(id) on delete cascade,
  attacker_id uuid references auth.users(id),
  defender_id uuid references auth.users(id),
  seed int not null,
  result text check (result in ('win', 'lose')),
  first_try boolean default false,
  points int default 0,
  created_at timestamptz default now()
);

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table saves enable row level security;
alter table prestige_log enable row level security;
alter table ad_rewards enable row level security;
alter table guilds enable row level security;
alter table guild_members enable row level security;
alter table guild_chat enable row level security;
alter table raids enable row level security;
alter table raid_hits enable row level security;
alter table wars enable row level security;
alter table war_defenses enable row level security;
alter table war_attacks enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = user_id);
create policy "own save" on saves for all using (auth.uid() = user_id);
create policy "own prestige" on prestige_log for select using (auth.uid() = user_id);
create policy "own ads" on ad_rewards for select using (auth.uid() = user_id);
create policy "guilds readable" on guilds for select using (true);
create policy "members readable" on guild_members for select using (true);
create policy "chat own guild" on guild_chat for select using (guild_id in (select guild_id from guild_members where user_id = auth.uid()));
create policy "chat write own guild" on guild_chat for insert with check (user_id = auth.uid() and guild_id in (select guild_id from guild_members where user_id = auth.uid()));
create policy "raids own guild" on raids for select using (guild_id in (select guild_id from guild_members where user_id = auth.uid()));
create policy "raid hits own guild" on raid_hits for select using (raid_id in (select id from raids where guild_id in (select guild_id from guild_members where user_id = auth.uid())));
create policy "wars readable" on wars for select using (true);
create policy "own defense" on war_defenses for all using (auth.uid() = user_id);
create policy "attacks readable" on war_attacks for select using (attacker_id = auth.uid() or defender_id = auth.uid());

-- Записи в ad_rewards, prestige_log, raid_hits, war_attacks, guilds, guild_members делают только Edge Functions
-- с service_role: grant_ad_reward, apply_prestige, submit_raid_hit, submit_war_attack, create_guild, join_guild.
-- Realtime: включить для guild_chat, raids (hp_left), wars.
