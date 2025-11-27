---
description: Audita componente React para performance y best practices
allowed-tools: ["Read", "Grep"]
argument-hint: "Component file path (e.g., src/components/Hero.tsx)"
---

Analiza el componente en **$ARGUMENTS** y proporciona un reporte detallado sobre:

## 1. Performance
- Uso de React.memo, useMemo, useCallback cuando es apropiado
- Optimizaciones de re-renders innecesarios
- Lazy loading de componentes pesados
- Optimización de imágenes (next/image)

## 2. TypeScript
- Tipos explícitos vs inferidos
- Props interface bien definida
- Uso de generics cuando sea apropiado
- Evitar 'any'

## 3. Best Practices
- Composición vs herencia
- Separación de lógica y presentación
- Hooks correctamente utilizados
- Naming conventions (PascalCase para componentes)

## 4. Accesibilidad
- ARIA labels donde sean necesarios
- Semantic HTML
- Keyboard navigation
- Focus management

## 5. Styling
- Consistencia con design system
- Uso correcto de Tailwind classes
- Responsive design (mobile-first)
- Dark mode support

Proporciona sugerencias específicas con ejemplos de código para mejorar el componente.
