---
description: Analiza performance del proyecto
allowed-tools: ["Bash", "Read", "Grep"]
---

Realiza un análisis completo de performance del proyecto:

## 1. Bundle Analysis
- Ejecuta el build y analiza el tamaño del bundle
- Identifica dependencias pesadas
- Sugiere oportunidades de tree-shaking
- Code splitting opportunities

## 2. Component Performance
- Busca componentes sin React.memo que deberían tenerlo
- Identifica re-renders innecesarios
- Sugiere lazy loading para componentes pesados
- Revisa uso de hooks (useMemo, useCallback)

## 3. Image Optimization
- Verifica uso de next/image
- Formatos modernos (WebP, AVIF)
- Responsive images
- Lazy loading

## 4. Loading Performance
- Analiza métrica de First Contentful Paint
- Time to Interactive
- Largest Contentful Paint
- Cumulative Layout Shift

## 5. Recomendaciones
Prioriza las mejoras por impacto:
- 🔴 Crítico (>100kb bundle reduction o >1s faster load)
- 🟡 Medio (50-100kb o 0.5-1s improvement)
- 🟢 Nice to have (<50kb o <0.5s)

Proporciona comandos específicos para implementar las mejoras.
