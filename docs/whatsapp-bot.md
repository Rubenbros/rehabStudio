# WhatsApp Booking Bot — Setup Guide

End-to-end automation for rehabStudio:

- Patients book / reschedule / cancel via WhatsApp.
- DeepSeek powers the conversation; Google Calendar is the source of truth.
- Twilio sends/receives WhatsApp messages.
- Supabase stores patients, conversation state and an appointment mirror.
- Owner controls the agenda from WhatsApp (privileged commands) **or** from
  Claude via an MCP server.

## 1. Architecture

```
Patient WhatsApp ─┐                         ┌─► Google Calendar API
                  │  Twilio webhook         │
                  ▼                         │
        /api/twilio/webhook ──► DeepSeek (tool calling) ──► Supabase
                  ▲                         │
                  │  Twilio REST            └─► Twilio (outbound)
                  │
Owner (Claude)  ──┴──► /api/mcp (HTTP MCP, bearer auth) ──► same tools

Vercel Cron ──► /api/cron/reminders  (24h / 2h / D+1 follow-up)
```

## 2. Provision the dependencies

### 2.1 Supabase

1. Create a project (free tier).
2. Settings → API: copy `URL`, `anon` key, `service_role` key into env vars.
3. SQL editor → run `supabase/migrations/0001_init.sql`.

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

### 2.4 DeepSeek

1. Sign up at <https://platform.deepseek.com>.
2. Create an API key → `DEEPSEEK_API_KEY`.
3. Default `DEEPSEEK_MODEL=deepseek-chat` is fine (cheap and tool-call capable).

## 3. Deploy

```bash
# Local dev
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # then expose with `ngrok http 3000` for Twilio webhook
```

```bash
# Vercel
vercel link
vercel env add ...           # add every var from .env.example
vercel --prod
```

Vercel cron (already declared in `vercel.json`) runs every 30 minutes and
authenticates itself with `CRON_SECRET` automatically — no manual setup needed.

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
        "MCP_BEARER_TOKEN": "<the same token as in Vercel>"
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

- Cron `*/30 * * * *` is supported on Vercel Hobby. Free tier allows up to 2
  cron jobs and 1-minute granularity, so this fits.
- The webhook responds immediately to Twilio and processes the conversation
  asynchronously. On Vercel Hobby, the background work uses the same lambda
  invocation (capped at 10s). If you see truncated responses, set
  `maxDuration` on the route or upgrade to Pro.
- All outbound reminders bypass the LLM and use static templates — keep them
  registered in Twilio for production use.
- Cancellation is unlimited (no penalty) per the owner's policy.
