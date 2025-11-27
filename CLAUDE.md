# CLAUDE.md - rehabStudio Portfolio

Guía para Claude Code sobre cómo trabajar con este proyecto.

## Stack Tecnológico

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Fonts**: Geist Sans & Geist Mono

## Estructura del Proyecto

```
rehabStudio/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx       # Root layout con metadata
│   │   ├── page.tsx         # Homepage
│   │   └── globals.css      # Estilos globales + Tailwind
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Navbar, Footer, etc.
│   │   ├── sections/        # Hero, Projects, About, Contact
│   │   └── animations/      # Componentes animados
│   ├── lib/
│   │   ├── utils.ts         # Utilidades (cn, etc.)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── constants/       # Constantes del proyecto
│   │   └── types/           # TypeScript types/interfaces
│   └── public/
│       ├── images/          # Imágenes optimizadas
│       ├── fonts/           # Fuentes custom
│       └── videos/          # Videos/backgrounds
├── .claude/
│   ├── hooks.json          # Hooks de Claude Code
│   └── commands/           # Comandos personalizados
└── components.json         # Configuración de shadcn/ui
```

## Convenciones de Código

### Componentes React

1. **Naming**: PascalCase para componentes (`Hero.tsx`, `ProjectCard.tsx`)
2. **Exports**: Named exports (no default exports para componentes)
3. **TypeScript**: Siempre tipar props con interfaces

```typescript
// ✅ CORRECTO
interface HeroProps {
  title: string;
  subtitle?: string;
}

export function Hero({ title, subtitle }: HeroProps) {
  return <div>{title}</div>;
}

// ❌ INCORRECTO
export default function hero(props: any) {
  return <div>{props.title}</div>;
}
```

### Styling

1. **Mobile-First**: Diseño responsive desde mobile hacia desktop
2. **Tailwind**: Usar utilidades de Tailwind, evitar CSS custom cuando sea posible
3. **cn()**: Usar `cn()` de `lib/utils` para merge de classNames
4. **Dark Mode**: Considerar siempre dark mode con la clase `.dark`

```typescript
import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div className={cn("rounded-lg bg-card p-6", className)} {...props} />
  );
}
```

### Performance

1. **next/image**: Siempre usar `<Image>` de Next.js, nunca `<img>`
2. **Lazy Loading**: Lazy load componentes pesados con `dynamic()`
3. **Fonts**: Usar next/font para optimización de fuentes
4. **Memoization**: Usar React.memo para componentes que no necesitan re-render

## Comandos Disponibles

### Desarrollo

```bash
npm run dev          # Servidor de desarrollo (http://localhost:3000)
npm run build        # Build para producción
npm run start        # Servidor de producción
npm run lint         # ESLint
npm run format       # Prettier (formatear todo el código)
npm run format:check # Verificar formato sin modificar
```

### Claude Code Commands

- `/component-audit <path>` - Audita componente para performance y best practices
- `/ui-polish <path>` - Sugiere mejoras visuales y UX
- `/perf-check` - Analiza performance del proyecto
- `/new-component <name>` - Crea nuevo componente con template

## Hooks Automáticos

El proyecto tiene hooks configurados que se ejecutan automáticamente:

1. **PostToolUse**: Después de editar archivos
   - Formatea con Prettier automáticamente
   - Ejecuta ESLint --fix

2. **SessionStart**: Al iniciar sesión
   - Muestra mensaje de bienvenida con el stack

## Añadir Componentes shadcn/ui

```bash
npx shadcn@latest add [component-name]

# Ejemplos:
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add avatar
```

## Tailwind CSS v4 - Cambios Importantes

Este proyecto usa Tailwind v4 (nuevo):

1. **Import**: `@import "tailwindcss"` en lugar de directives
2. **Theme**: Variables CSS en `@theme inline` block
3. **Colors**: Formato RGB separado por espacios: `255 255 255` en lugar de `#ffffff`
4. **Dark Mode**: Usa `@custom-variant dark (&:is(.dark *))`

## Best Practices para Portfolio

### Secciones Recomendadas

1. **Hero** - Primera impresión, CTA claro
2. **Work/Projects** - Grid de proyectos con filtros
3. **About** - Bio, skills, foto profesional
4. **Contact** - Form o enlaces sociales

### Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Bundle Size**: < 200KB (gzipped)

### Accesibilidad (WCAG 2.1 AA)

- Contrast ratio mínimo: 4.5:1
- Todos los interactivos accesibles por teclado
- ARIA labels en iconos sin texto
- Semantic HTML siempre que sea posible

## Workflow Recomendado con Claude Code

1. **Planificar**: Usar `/new-component` para crear estructura
2. **Implementar**: Escribir componente con TypeScript estricto
3. **Auditar**: Ejecutar `/component-audit` para verificar best practices
4. **Pulir**: Usar `/ui-polish` para mejorar UX
5. **Optimizar**: Correr `/perf-check` antes de deployment

## Recursos

- [Next.js 15 Docs](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)
