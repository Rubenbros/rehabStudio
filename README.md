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

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual Deployment

```bash
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
