# ACT SAT GO — NextGen Marketing Site (React)

Responsive React + Vite + TypeScript rebuild of the static `nextgen-website`
design. Same markup, same `styles.css`, same image assets — the interactive
bits (mobile nav, program filter, testimonial tabs, newsletter form) are ported
to React state.

## Run

```bash
cd website/nextgen-react
npm install
npm run dev
```

Open the printed local URL (default http://localhost:5173).

## Build

```bash
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
```

## Structure

```
src/
  main.tsx              app entry
  App.tsx               page composition + static sections + content data
  styles.css            design styles (copied verbatim from nextgen-website)
  assets/               hero.png, programs.png, cta.png
  components/
    Header.tsx          sticky nav + mobile menu toggle
    Brand.tsx           logo lockup (used in header + footer)
    Programs.tsx        program cards + category filter tabs
    Testimonials.tsx    video / written testimonial tabs
    Newsletter.tsx      subscribe form
```

The original static version remains in `../nextgen-website` for reference.
