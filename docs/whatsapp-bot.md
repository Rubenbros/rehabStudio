# WhatsApp Booking Bot — Setup Guide

End-to-end automation for rehabStudio:

- Patients book / reschedule / cancel via WhatsApp.
- Gemini on Vertex AI powers the conversation; Google Calendar is the source of truth.
- Twilio sends/receives WhatsApp messages.
- Cloud SQL (PostgreSQL) stores patients, conversation state and an appointment mirror.
- Owner controls the agenda from WhatsApp (privileged commands) **or** from
  Claude via an MCP server.

## 1. Architecture

```
Patient WhatsApp ─┐                         ┌─► Google Calendar API
                  │  Twilio webhook         │
                  ▼                         │
        /api/twilio/webhook ──► Vertex AI / Gemini (tool calling) ──► Cloud SQL
                  ▲                         │
                  │  Twilio REST            └─► Twilio (outbound)
                  │
Owner (Claude)  ──┴──► /api/mcp (HTTP MCP, bearer auth) ──► same tools

Cloud Scheduler ──► /api/cron/reminders  (day-before / D+10 / auto-reject)
```

## 2. Provision the dependencies

### 2.1 Cloud SQL (PostgreSQL)

The database lives in the shared Cloud SQL instance
`t800labsweb:europe-west1:t800labs-pg` (PostgreSQL 17), with its own database
`rehab` and user `rehab_app`.

1. Build `DATABASE_URL`:
   - Locally, through the Cloud SQL Auth Proxy:
     `postgresql://rehab_app:PASSWORD@127.0.0.1:5433/rehab`
   - On Cloud Run, through the connector's Unix socket:
     `postgresql://rehab_app:PASSWORD@localhost/rehab?host=/cloudsql/t800labsweb:europe-west1:t800labs-pg`
2. Apply the schema (idempotent, no psql needed):

   ```bash
   npm run db:schema
   ```

   The DDL lives in `db/schema.sql`; the old Supabase migrations are kept in
   `db/legacy/` for history only. The `config` row holding the working schedule
   is **not** seeded: it travels with the data migration.
3. The Cloud Run runtime service account needs `roles/cloudsql.client`, and the
   deploy passes `--add-cloudsql-instances`. `DATABASE_URL` is injected from
   Secret Manager.

### 2.2 Google Calendar

1. Google Cloud Console → enable **Google Calendar API**.
2. **OAuth consent screen**: External, test users = owner's email.
3. **Credentials → OAuth 2.0 Client (Web application)**:
   - Authorized redirect URI: `https://YOUR-DOMAIN/api/google/oauth/callback`
4. Copy `client_id` / `client_secret` into env vars.
5. Deploy the app once, then visit `https://YOUR-DOMAIN/api/google/oauth/start`
   while logged in as the owner. The callback shows the `refresh_token`.
   Paste it into `GOOGLE_REFRESH_TOKEN` and redeploy.
6. (Optional) set `GOOGLE_CALENDAR_ID` if not using the primary calendar.

### 2.3 Twilio WhatsApp

**Dev / sandbox (free):**

1. Twilio console → Messaging → Try it out → **Send a WhatsApp message**.
2. Activate the sandbox; join from your phone by sending `join <code>` to
   `+1 415 523 8886`.
3. Sandbox settings:
   - **When a message comes in**: `https://YOUR-DOMAIN/api/twilio/webhook` (POST)
   - **Status callback URL**: leave blank.
4. Env vars:
   - `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`

**Production (real number):**

1. Twilio → Senders → **Request WhatsApp Sender**.
2. You'll need a Meta Business Manager with a verified business (~3-7 days).
3. Submit and approve message templates for outbound notifications. The bot
   uses these template names (register them in Twilio Content Builder):
   - `confirmacion_cita` / `confirmation_appointment`
   - `recordatorio_24h` / `reminder_24h`
   - `recordatorio_2h` / `reminder_2h`
   - `followup_post_sesion` / `followup_post_session`
4. Once approved, swap `TWILIO_WHATSAPP_FROM` to the new number
   (e.g. `whatsapp:+34911234567`).

> Note: WhatsApp Business policy only allows free-form replies within the 24h
> conversation window after the user's last message. Outside that window you
> **must** use approved templates — the reminders route is the typical culprit.

### 2.4 Vertex AI (Gemini)

The bot has **no LLM API key**. It authenticates with Application Default
Credentials (ADC) against Vertex AI's OpenAI-compatible endpoint:

```
POST https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT}/locations/${VERTEX_LOCATION}/endpoints/openapi/chat/completions
```

1. Enable **`aiplatform.googleapis.com`** in the project (`rehab-studio-web`).
2. Grant **`roles/aiplatform.user`** to the Cloud Run runtime service account
   (`vars.GCP_RUNTIME_SA`). In Cloud Run ADC resolves through the metadata
   server, so no key file exists anywhere.
3. Locally: `gcloud auth application-default login` and make sure the ADC quota
   project is `rehab-studio-web`
   (`gcloud auth application-default set-quota-project rehab-studio-web`).
4. Env vars (all plain GitHub `vars`, none secret):

   | Variable               | Default (if unset)         | Notes                                            |
   | ---------------------- | -------------------------- | ------------------------------------------------ |
   | `GOOGLE_CLOUD_PROJECT` | resolved via ADC           | Cloud Run does **not** inject it; the deploy passes `vars.GCP_PROJECT_ID` |
   | `VERTEX_LOCATION`      | `europe-west1`             | Same region as Cloud Run → data stays in the EU. Use `global` only if a model is unavailable regionally (the host then drops the region prefix) |
   | `GEMINI_MODEL`         | `google/gemini-2.5-flash`  | Model ids on this endpoint are prefixed with `google/` |

`google/gemini-2.5-flash` was verified live in `europe-west1` (2026-09-09) with
the real tool schemas: two-turn tool calling, several `system` messages, integer
`enum`s, `default`s and parameterless objects all work unmodified.

Gemini 2.5 enables "thinking" by default; the adapter turns it off
(`extra_body.google.thinking_config.thinking_budget = 0`) because it adds
hundreds of reasoning tokens and latency to short booking turns and forces
`thought_signature` round-tripping. Raise it in `src/lib/bot/llm.ts` if answer
quality ever demands it — the adapter already preserves `extra_content`.

## 3. Deploy

```bash
# Local dev
npm install
cp .env.example .env.local   # fill in values
gcloud auth application-default login   # ADC for Vertex AI (no LLM API key)
npm run dev                  # then expose with `ngrok http 3000` for Twilio webhook
```

```bash
# Checks before pushing
npm run lint
npx tsc --noEmit
npm test                     # add DATABASE_URL_TEST to also run the DB test
npm run build
```

Production deploys are automatic: pushing to `master` triggers
`.github/workflows/deploy-cloudrun.yml`, which builds the image, pushes it to
Artifact Registry and runs `gcloud run deploy` (region `europe-west1`, service
`rehab-studio`). Plain settings come from GitHub `vars`, secrets from Secret
Manager.

The reminders cron is the Cloud Scheduler job `rehab-reminders`: every 30
minutes it calls `/api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`.
It is provisioned outside this repository, so there is nothing to deploy for it.

## 4. Owner privileges

`OWNER_PHONE` is the only configuration that grants admin rights. Any message
from that number bypasses the patient flow and gets the admin system prompt
with all owner-only tools: `set_working_hours`, `block_slot`,
`send_manual_message`, `get_stats`, `list_calendar_events`.

Examples (the bot understands free-form Spanish/English):

- "¿Cuántas citas tengo mañana?"
- "Cancela la cita de Juan del jueves a las 17"
- "Bloquea el viernes de 14 a 16 por reunión"
- "Cambia mi horario de los sábados a 10:00-13:00"
- "Manda a María: llego 10 min tarde"

## 5. MCP server — Claude integration

The MCP endpoint is `https://YOUR-DOMAIN/api/mcp`. Authentication: bearer
token `MCP_BEARER_TOKEN`. Always runs with owner privileges (no patient
caller phone).

### Claude Desktop (stdio bridge)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "rehabstudio": {
      "command": "node",
      "args": ["/absolute/path/to/scripts/mcp-stdio-bridge.mjs"],
      "env": {
        "MCP_URL": "https://YOUR-DOMAIN/api/mcp",
        "MCP_BEARER_TOKEN": "<the same token as in Cloud Run>"
      }
    }
  }
}
```

Restart Claude Desktop; you'll see the tools listed in the connector panel.

### Claude.ai / web (HTTP)

Add as a custom MCP connector pointing to `https://YOUR-DOMAIN/api/mcp` with
`Authorization: Bearer <MCP_BEARER_TOKEN>`.

### Quick test

```bash
curl -X POST https://YOUR-DOMAIN/api/mcp \
  -H "Authorization: Bearer $MCP_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 6. Tool inventory

| Tool                       | Audience | Purpose                                         |
| -------------------------- | -------- | ----------------------------------------------- |
| `check_availability`       | both     | Returns free 30/60 min slots                    |
| `book_appointment`         | both     | Creates Calendar event + DB record              |
| `list_appointments`        | both     | Lists upcoming (patient sees own, owner sees all) |
| `cancel_appointment`       | both     | Cancels event + marks DB row                    |
| `reschedule_appointment`   | both     | Moves event to a new time                       |
| `update_patient`           | both     | Persists name / email / reason / language       |
| `get_working_hours`        | owner    | Read current schedule config                    |
| `set_working_hours`        | owner    | Replace schedule config                         |
| `block_slot`               | owner    | Add a busy block on Calendar                    |
| `send_manual_message`      | owner    | Send a one-off WhatsApp to a patient            |
| `get_stats`                | owner    | Monthly revenue / counts                        |
| `list_calendar_events`     | owner    | Raw event listing                               |

## 7. Notes & limitations

- The reminders cron runs every 30 minutes from Cloud Scheduler. The route
  rejects anything whose `Authorization` header is not exactly
  `Bearer $CRON_SECRET`, so the job and the secret must stay in sync.
- The webhook answers Twilio immediately and processes the conversation in the
  background with `after()`. The route sets `maxDuration = 60`; Cloud Run is
  configured with `--timeout 120`, so there is room.
- The `pg` pool is created lazily and capped at 5 connections because the Cloud
  SQL instance is shared with other apps.
- All outbound reminders bypass the LLM and use static templates — keep them
  registered in Twilio for production use.
- Cancellation is unlimited (no penalty) per the owner's policy.
