# @ontology-search/design-system

> Swappable design-system contract: primitive component interfaces, a provider/registry, a brand-neutral loader, and the default ENVITED-X implementation.

**Layer:** UI library. Consumed by `apps/web`; it sits outside the search dependency chain (`core ← sparql, ontology ← search ← llm ← apps`) and has no dependency on any library package. React 19 is a peer dependency.

## Purpose

Defines the component and branding contract the frontend renders against — primitive components (`Button`, `Heading`, `Card`, `Pill`, `Alert`, `Spinner`), the shared types/tokens, and a `DesignSystemProvider`/`useDesignSystem` context. It is brand-neutral: the active design system is resolved by id from a registry, so an external system can be plugged in via config while a guaranteed fallback (the bundled ENVITED-X implementation) keeps the app from crashing.

## Public interface

| Subpath        | Purpose                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`            | Primitives (`Button`, `Heading`, `Card`, `Pill`, `Alert`, `Spinner`), `DesignSystemProvider`/`useDesignSystem`, `resolveDesignSystem`, the `DesignSystem`/`BrandConfig`/component prop types, and `envitedDesignSystem` |
| `./envited`    | The default, bundled ENVITED-X design system (`envitedDesignSystem`)                                                                                                                                                    |
| `./tokens.css` | CSS custom-property design tokens                                                                                                                                                                                       |

## Requirements & invariants

- **Brand-neutral resolution**: `resolveDesignSystem` knows nothing about any specific system; the app passes a registry, a requested id (from config), and a guaranteed-present fallback id. An unregistered requested id falls back instead of crashing; a missing fallback throws.
- `useDesignSystem` throws if used outside a `<DesignSystemProvider>`.
- Swapping the provider's `system` prop exchanges the entire component library and branding at once.
- React 19 (`react`, `react-dom`) is a **peer** dependency — supplied by the consuming app.

## How to interface

```tsx
import {
  DesignSystemProvider,
  envitedDesignSystem,
  useDesignSystem,
} from '@ontology-search/design-system'

function App({ children }: { children: React.ReactNode }) {
  return <DesignSystemProvider system={envitedDesignSystem}>{children}</DesignSystemProvider>
}

function Toolbar() {
  const { components } = useDesignSystem()
  const { Button } = components
  return <Button variant="primary">Search</Button>
}
```

## See also

- [Root README](../../README.md)
- [`apps/web`](../../apps/web) — the consumer of this design system
