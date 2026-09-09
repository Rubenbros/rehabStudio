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
`rehab-studio`). Pushing to `master` triggers
`.github/workflows/deploy-cloudrun.yml`, which builds the standalone image,
pushes it to Artifact Registry and deploys. Plain settings come from GitHub
`vars`; secrets come from Secret Manager.

```bash
# Local production build
npm run build
npm run start
```

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
