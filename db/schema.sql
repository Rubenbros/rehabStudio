-- Esquema del bot de WhatsApp de rehabStudio (PostgreSQL 17, Cloud SQL).
--
-- Idempotente: se puede aplicar tantas veces como haga falta.
--   npm run db:schema        (usa DATABASE_URL)
--
-- `gen_random_uuid()` es nativo desde PostgreSQL 13, así que no hace falta la
-- extensión `pgcrypto`. No hay RLS (todo el acceso es de servidor con el
-- usuario de la aplicación), ni triggers: `updated_at` lo escribe la app.
--
-- Los datos vivos (incluida la fila `config` con el horario real) se migran
-- aparte: este fichero NO siembra ninguna fila.
--
-- Las tablas van SIN cualificar con `public.` a propósito: así el mismo DDL
-- sirve para crear un esquema desechable en los tests de integración fijando
-- `search_path`. Quien lo aplique decide el esquema (el script usa `public`).

-- ---------- patients ----------
create table if not exists patients (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,            -- E.164 (p. ej. +34600000000)
  full_name     text,
  email         text,
  reason        text,                            -- motivo de consulta (opcional)
  language      text not null default 'es',      -- 'es' | 'en'
  is_owner      boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists patients_phone_idx on patients (phone);

-- ---------- conversations ----------
-- Una fila por teléfono con el estado y el historial recortado para el LLM.
create table if not exists conversations (
  phone         text primary key,
  state         text not null default 'idle',    -- idle | onboarding | booking | rescheduling | cancelling | owner_admin
  context       jsonb not null default '{}'::jsonb,
  messages      jsonb not null default '[]'::jsonb,
  last_active   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ---------- appointments ----------
-- Espejo local de los eventos de Google Calendar (histórico, stats, avisos).
create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid references patients(id) on delete set null,
  patient_phone   text not null,
  patient_name    text,
  google_event_id text unique,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  duration_min    integer not null,                 -- 30 o 60
  price_eur       integer not null,
  kind            text not null default 'session',  -- session | followup
  status          text not null default 'confirmed',-- confirmed | cancelled | pending_approval | completed | no_show
  notes           text,
  -- Marcas de envío (evitan duplicar recordatorios).
  confirmation_sent_at timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at  timestamptz,
  followup_sent_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists appointments_starts_at_idx on appointments (starts_at);
create index if not exists appointments_phone_idx     on appointments (patient_phone);
create index if not exists appointments_status_idx    on appointments (status);
-- Índices que faltaban respecto al uso real del código:
--   created_at → listados de pendientes y auto-rechazo del cron.
--   ends_at    → seguimiento D+10 del cron.
--   patient_id → FK que resuelve el LEFT JOIN con patients de los tres crons.
create index if not exists appointments_created_at_idx  on appointments (created_at);
create index if not exists appointments_ends_at_idx     on appointments (ends_at);
create index if not exists appointments_patient_id_idx  on appointments (patient_id);

-- ---------- message_log ----------
create table if not exists message_log (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  direction   text not null,                     -- inbound | outbound
  body        text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists message_log_phone_idx on message_log (phone, created_at desc);

-- ---------- pending_questions ----------
-- Relevo de preguntas paciente → fisio → paciente.
create table if not exists pending_questions (
  id                  uuid primary key default gen_random_uuid(),
  patient_phone       text not null,
  patient_name        text,
  question            text not null,
  status              text not null default 'pending',  -- pending | answered | abandoned
  answer              text,
  asked_at            timestamptz not null default now(),
  notified_owner_at   timestamptz,
  answered_at         timestamptz
);

create index if not exists pending_questions_status_idx on pending_questions (status, asked_at);
create index if not exists pending_questions_phone_idx  on pending_questions (patient_phone);

-- ---------- config ----------
-- Clave/valor para ajustes editables en caliente (hoy solo 'schedule').
create table if not exists config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
