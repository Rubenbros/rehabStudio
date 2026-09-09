# rehabStudio - Modern Portfolio

A stunning portfolio website built with the latest web technologies.

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **Lucide React** - Icon library

## Features

- Modern, minimalist design
- Fully responsive (mobile-first)
- Dark mode support
- Optimized performance
- SEO friendly
- Accessibility compliant (WCAG 2.1 AA)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

## Project Structure

```
src/
├── app/              # Next.js app router
├── components/
│   ├── ui/          # shadcn/ui components
│   ├── layout/      # Layout components (Navbar, Footer)
│   ├── sections/    # Page sections (Hero, Projects)
│   └── animations/  # Animated components
├── lib/
│   ├── utils.ts     # Utility functions
│   ├── hooks/       # Custom React hooks
│   └── types/       # TypeScript types
└── public/          # Static assets
```

## Adding Components

This project uses [shadcn/ui](https://ui.shadcn.com). To add a component:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

## WhatsApp booking bot

Besides the public site, this repo hosts the WhatsApp booking bot
(`src/lib/bot`, `/api/twilio/webhook`, `/api/mcp`, `/api/cron/reminders`). The
conversation runs on **Gemini via Vertex AI**, reached through its
OpenAI-compatible endpoint and authenticated with **Application Default
Credentials — there is no LLM API key**:

| Variable               | Secret? | Default                   | Purpose                                                   |
| ---------------------- | ------- | ------------------------- | --------------------------------------------------------- |
| `GOOGLE_CLOUD_PROJECT` | no      | resolved via ADC          | Project billed for Vertex AI (deploy passes `GCP_PROJECT_ID`) |
| `VERTEX_LOCATION`      | no      | `europe-west1`            | Vertex region; `global` drops the region prefix from the host |
| `GEMINI_MODEL`         | no      | `google/gemini-2.5-flash` | Model id on the OpenAI-compatible endpoint                |

On Cloud Run the credentials come from the runtime service account (it needs
`roles/aiplatform.user`); locally from `gcloud auth application-default login`.

Full setup — Cloud SQL, Google Calendar OAuth, Twilio, Vertex AI, MCP — lives in
[`docs/whatsapp-bot.md`](docs/whatsapp-bot.md).

## Deployment

Production runs on **Google Cloud Run** (`europe-west1`, service
`rehab-studio`, project `rehab-studio-web`). CI/CD is moving to **Google Cloud
Build**, so that no credential ever leaves Google. Rationale, alternatives and
trade-offs: [`docs/adr/0001-cloud-build-sustituye-github-actions.md`](docs/adr/0001-cloud-build-sustituye-github-actions.md).

| File                                  | What it does                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cloudbuild.yaml`                     | Deploy: docker build → push to Artifact Registry (`:$COMMIT_SHA` and `:latest`) → `gcloud run deploy` → verify the serving revision is this commit → HTTP check on `/` and `/en`. |
| `cloudbuild-ci.yaml`                  | Quality gate for pull requests: `npm ci`, lint, `tsc --noEmit`, vitest, `next build`. Deploys nothing, reads no secret. |
| `.github/workflows/deploy-cloudrun.yml` | **Still active**, being retired. Skipped as soon as the repository variable `DEPLOY_VIA_CLOUD_BUILD` is `true`. |

**Cutover, in this order** — the Actions workflow stays live until Cloud Build
proves itself, so there is never a window without deployment nor two deployments
at once:

1. Merge this branch. Deployments keep going through GitHub Actions.
2. Create the Cloud Build triggers (commands below) and let the first deploy
   build finish green.
3. Set the repository variable `DEPLOY_VIA_CLOUD_BUILD=true` (GitHub → Settings
   → Secrets and variables → Actions → Variables). The workflow stops running
   immediately.
4. Delete `.github/workflows/deploy-cloudrun.yml`, the GitHub `vars` and the
   Workload Identity Federation pool if nothing else uses them.

Non-secret settings live as `substitutions:` inside `cloudbuild.yaml` — they are
versioned and auditable instead of hidden in GitHub `vars`. Secrets are never in
the repo: `--set-secrets` passes Secret Manager *references* that Cloud Run
resolves at startup with the runtime service account.

### Service accounts

| Build                | Service account                                       | Can it deploy? |
| -------------------- | ----------------------------------------------------- | -------------- |
| `cloudbuild.yaml`    | `cloudbuild-deployer@rehab-studio-web.iam.gserviceaccount.com` | Yes — `run.admin`, `artifactregistry.writer`, `secretmanager.secretAccessor`, `iam.serviceAccountUser` on the runtime SA, `logging.logWriter`, `storage.admin`. |
| `cloudbuild-ci.yaml` | `cloudbuild-ci@rehab-studio-web.iam.gserviceaccount.com`       | **No** — only `logging.logWriter` and `storage.objectViewer`. |

> **This repository is public and CI runs pull-request code**, including code
> from people outside the project. That is why CI has its own least-privilege
> account and why the CI trigger must require manual approval for external pull
> requests (`--comment-control` below). Never point `cloudbuild-ci.yaml` at the
> deployer account, and never reference a production secret from it.

### Triggers (Cloud Build 2nd gen, connection `gh-rubenbros`)

The triggers are created once, out of band. These are the exact parameters, so
they can be recreated from scratch:

| Trigger                     | Event                       | Config file          | Service account       |
| --------------------------- | --------------------------- | -------------------- | --------------------- |
| `rehab-studio-deploy-master` | push to `master` (ignoring `docs/**` and `**/*.md`) | `cloudbuild.yaml`    | `cloudbuild-deployer@` |
| `rehab-studio-ci-pr`        | pull request targeting `master` | `cloudbuild-ci.yaml` | `cloudbuild-ci@`       |

```bash
PROJECT=rehab-studio-web
REGION=europe-west1
REPO="projects/$PROJECT/locations/$REGION/connections/gh-rubenbros/repositories/rehabStudio"

# Deploy on push to master. Cloud Build injects COMMIT_SHA automatically.
gcloud builds triggers create github \
  --name=rehab-studio-deploy-master \
  --region="$REGION" --project="$PROJECT" \
  --repository="$REPO" \
  --branch-pattern='^master$' \
  --build-config=cloudbuild.yaml \
  --ignored-files='docs/**','**/*.md' \
  --service-account="projects/$PROJECT/serviceAccounts/cloudbuild-deployer@$PROJECT.iam.gserviceaccount.com"

# CI on pull requests. COMMENTS_ENABLED_FOR_EXTERNAL_CONTRIBUTORS_ONLY means a
# collaborator must comment "/gcbrun" before an outsider's PR is allowed to run
# — mandatory here, the repo is public.
gcloud builds triggers create github \
  --name=rehab-studio-ci-pr \
  --region="$REGION" --project="$PROJECT" \
  --repository="$REPO" \
  --pull-request-pattern='^master$' \
  --comment-control=COMMENTS_ENABLED_FOR_EXTERNAL_CONTRIBUTORS_ONLY \
  --build-config=cloudbuild-ci.yaml \
  --service-account="projects/$PROJECT/serviceAccounts/cloudbuild-ci@$PROJECT.iam.gserviceaccount.com"
```

```bash
# Manual deploy (COMMIT_SHA is required — it tags the image and keeps
# revision↔commit traceability; it is empty on manual builds).
gcloud builds submit --config cloudbuild.yaml --region=europe-west1 \
  --project=rehab-studio-web \
  --substitutions=COMMIT_SHA="$(git rev-parse HEAD)"

# Manual CI run
gcloud builds submit --config cloudbuild-ci.yaml --region=europe-west1 \
  --project=rehab-studio-web

# Local production build
npm run build
npm run start
```

Three service settings are still the literal placeholder `PENDIENTE`
(`TWILIO_ACCOUNT_SID`, `TWILIO_WHATSAPP_FROM`, `OWNER_PHONE`) — the same value
they had in GitHub `vars`. They are kept as-is on purpose: `src/lib/bot/env.ts`
reads them with `required()`, which throws on an empty or missing value, and
`env.ownerPhone()` sits on the hot path of every inbound message, so blanking
them would take the bot from degraded to fully broken. Replace them with the
real values when they exist.

## Claude Code

This project is optimized for development with [Claude Code](https://claude.ai/code).

Custom commands available:
- `/component-audit` - Audit component quality
- `/ui-polish` - Get UI/UX improvement suggestions
- `/perf-check` - Analyze performance
- `/new-component` - Create new component with best practices

See `CLAUDE.md` for detailed development guidelines.

## License

MIT
