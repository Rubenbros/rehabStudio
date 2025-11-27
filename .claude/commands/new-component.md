---
description: Crea nuevo componente React con best practices
argument-hint: "Component name (e.g., Hero, ProjectCard)"
---

Crea un nuevo componente **$ARGUMENTS** siguiendo las mejores prácticas:

## Estructura del componente:
```typescript
// src/components/[sections|layout|ui]/$ARGUMENTS.tsx
import { cn } from "@/lib/utils";

interface ${ARGUMENTS}Props {
  // Props tipadas
}

export function $ARGUMENTS({ ...props }: ${ARGUMENTS}Props) {
  return (
    <div className={cn("", props.className)}>
      {/* Contenido */}
    </div>
  );
}
```

## Requisitos:
1. TypeScript estricto con interface para props
2. Uso de `cn()` para className merging
3. Export named (no default)
4. Responsive design (mobile-first)
5. Accesibilidad (semantic HTML, ARIA si es necesario)
6. Comentarios JSDoc para props complejas

## Ubicación del archivo:
- **UI primitives** → `src/components/ui/`
- **Layout components** → `src/components/layout/`
- **Section components** → `src/components/sections/`
- **Animations** → `src/components/animations/`

Crea el componente, un archivo de ejemplo de uso, y sugiere dónde importarlo.
