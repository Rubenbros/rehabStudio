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
`rehab-studio`, project `rehab-studio-web`). CI/CD is **Google Cloud Build** —
no credential ever leaves Google and GitHub does not execute anything.

| File                 | What it does                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `cloudbuild.yaml`    | Deploy: docker build → push to Artifact Registry (`:$COMMIT_SHA` and `:latest`) → `gcloud run deploy`. |
| `cloudbuild-ci.yaml` | Quality gate for pull requests: `npm ci`, lint, `tsc --noEmit`, vitest, `next build`. Deploys nothing. |

Non-secret settings live as `substitutions:` inside `cloudbuild.yaml` — they are
versioned and auditable instead of hidden in GitHub `vars`. Secrets are never in
the repo: `--set-secrets` passes Secret Manager *references* that Cloud Run
resolves at startup with the runtime service account.

Builds run as `cloudbuild-deployer@rehab-studio-web.iam.gserviceaccount.com`
(see the permission list at the top of `cloudbuild.yaml`).

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

The previous GitHub Actions workflow is kept under
`.github/workflows-legacy/` until the first real Cloud Build run is green.

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
