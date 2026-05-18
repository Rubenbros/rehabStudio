-- Q&A relay: patient asks something the bot can't / shouldn't answer (typically
-- medical), the bot forwards it to the owner, the owner replies, and the bot
-- relays the answer back to the patient.

create table if not exists public.pending_questions (
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

create index if not exists pending_questions_status_idx on public.pending_questions (status, asked_at);
create index if not exists pending_questions_phone_idx  on public.pending_questions (patient_phone);
