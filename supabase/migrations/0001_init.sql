-- rehabStudio WhatsApp bot schema
-- Run inside the Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------- patients ----------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,           -- E.164 (e.g. +34600000000)
  full_name     text,
  email         text,
  reason        text,                            -- optional motivo de consulta
  language      text not null default 'es',      -- 'es' | 'en'
  is_owner      boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists patients_phone_idx on public.patients (phone);

-- ---------- conversations ----------
-- One row per phone number with the current FSM state and rolling history.
create table if not exists public.conversations (
  phone         text primary key,
  state         text not null default 'idle',    -- idle | onboarding | booking | rescheduling | cancelling | owner_admin
  context       jsonb not null default '{}'::jsonb,
  messages      jsonb not null default '[]'::jsonb,  -- last N turns for the LLM
  last_active   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ---------- appointments ----------
-- Local mirror of Google Calendar events for history, stats and reminders.
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid references public.patients(id) on delete set null,
  patient_phone   text not null,
  patient_name    text,
  google_event_id text unique,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  duration_min    integer not null,              -- 30 or 60
  price_eur       integer not null,              -- 30 or 60
  kind            text not null default 'session', -- session | followup
  status          text not null default 'confirmed', -- confirmed | cancelled | completed | no_show
  notes           text,
  -- Reminder bookkeeping (prevents duplicate sends).
  confirmation_sent_at timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at  timestamptz,
  followup_sent_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists appointments_starts_at_idx on public.appointments (starts_at);
create index if not exists appointments_phone_idx on public.appointments (patient_phone);
create index if not exists appointments_status_idx on public.appointments (status);

-- ---------- message_log ----------
create table if not exists public.message_log (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  direction   text not null,                     -- inbound | outbound
  body        text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists message_log_phone_idx on public.message_log (phone, created_at desc);

-- ---------- config ----------
-- Singleton-style key/value table for runtime-editable settings (schedule, etc.).
create table if not exists public.config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Default working schedule (the owner can change it via WhatsApp).
insert into public.config (key, value) values (
  'schedule',
  jsonb_build_object(
    'timezone', 'Europe/Madrid',
    'slot_minutes', 30,
    'days', jsonb_build_object(
      'mon', jsonb_build_array(jsonb_build_object('start','09:00','end','14:00'), jsonb_build_object('start','16:00','end','20:00')),
      'tue', jsonb_build_array(jsonb_build_object('start','09:00','end','14:00'), jsonb_build_object('start','16:00','end','20:00')),
      'wed', jsonb_build_array(jsonb_build_object('start','09:00','end','14:00'), jsonb_build_object('start','16:00','end','20:00')),
      'thu', jsonb_build_array(jsonb_build_object('start','09:00','end','14:00'), jsonb_build_object('start','16:00','end','20:00')),
      'fri', jsonb_build_array(jsonb_build_object('start','09:00','end','14:00'), jsonb_build_object('start','16:00','end','20:00')),
      'sat', jsonb_build_array(),
      'sun', jsonb_build_array()
    )
  )
) on conflict (key) do nothing;
