# WhatsApp Booking Bot — Setup Guide

End-to-end automation for rehabStudio:

- Patients book / reschedule / cancel via WhatsApp.
- DeepSeek powers the conversation; Google Calendar is the source of truth.
- WhatsApp Cloud API (Meta) sends/receives WhatsApp messages.
- Supabase stores patients, conversation state and an appointment mirror.
- Owner controls the agenda from WhatsApp (privileged commands) **or** from
  Claude via an MCP server.

## 1. Architecture

```
Patient WhatsApp ─┐                         ┌─► Google Calendar API
                  │  Meta webhook (JSON)    │
                  ▼                         │
        /api/whatsapp/webhook ──► DeepSeek (tool calling) ──► Supabase
                  ▲                         │
                  │  Graph API              └─► WhatsApp Cloud API (outbound)
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

### 2.3 WhatsApp Cloud API (Meta)

**Setup:**

1. <https://developers.facebook.com> → create an app of type **Business**.
2. Add the **WhatsApp** product. This creates a test number you can use for dev.
3. **API Setup** tab: copy the **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   Generate a permanent **System User access token** (Business Settings → Users →
   System users) with `whatsapp_business_messaging` permission →
   `WHATSAPP_ACCESS_TOKEN`. (The temporary 24h token shown on the tab is fine for
   a quick test only.)
4. **App → Settings → Basic**: copy the **App secret** → `WHATSAPP_APP_SECRET`.
5. Choose any random string for `WHATSAPP_VERIFY_TOKEN`.
6. **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://YOUR-DOMAIN/api/whatsapp/webhook`
   - **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN`.
   - Click **Verify and save** (Meta calls the GET handler with `hub.challenge`).
   - **Subscribe** the webhook field **messages**.
7. For dev with a local server, expose it (`ngrok http 3000`) and use the public
   URL as the callback. Set `WHATSAPP_VALIDATE_SIGNATURE=false` only if you need
   to bypass the HMAC check locally.

**Production (real number):**

1. **WhatsApp → API Setup → Add phone number**, then verify the new business
   number by SMS/voice. A number can only live on one platform at a time — if it
   is currently on the WhatsApp app or another BSP, remove it there first.
2. You'll need a Meta Business Manager with a verified business (~3-7 days).
3. Submit and approve message templates (category **Utility**) for the outbound
   notifications sent outside the 24h window. The reminders route needs:
   - confirmation
   - 24h reminder
   - D+10 follow-up
   - auto-reject / slot-not-confirmed notice
   - (owner side) patient-question forward, pending-approval notice

> Note: WhatsApp Business policy only allows free-form replies within the 24h
> conversation window after the user's last message. The current code sends
> free-form text everywhere, which covers all in-window conversation. The
> proactive `/api/cron/reminders` messages (and owner notifications when the
> owner has been quiet >24h) fall outside that window and **require approved
> templates** in production — wire a `sendTemplate` helper once the templates
> above are approved.

### 2.4 DeepSeek

1. Sign up at <https://platform.deepseek.com>.
2. Create an API key → `DEEPSEEK_API_KEY`.
3. Default `DEEPSEEK_MODEL=deepseek-chat` is fine (cheap and tool-call capable).

## 3. Deploy

```bash
# Local dev
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # then expose with `ngrok http 3000` for the Meta webhook
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
- The webhook responds immediately to Meta and processes the conversation
  asynchronously. On Vercel Hobby, the background work uses the same lambda
  invocation (capped at 10s). If you see truncated responses, set
  `maxDuration` on the route or upgrade to Pro.
- All outbound reminders bypass the LLM and use static text. In production these
  fire outside the 24h window and must be sent as approved Meta templates.
- Cancellation is unlimited (no penalty) per the owner's policy.
