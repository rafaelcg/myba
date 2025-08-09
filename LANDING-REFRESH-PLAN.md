## Landing page refresh plan

Goal: Implement a modern landing page UI (as in the screenshot) while preserving all current functionality, analytics, auth, and token flows. Deliver a clean, responsive, accessible experience with Tailwind, using functional React + TypeScript and the existing data/logic from `HomePage`.

### Constraints
- Keep the generation workflow, token accounting, analytics, and auth exactly as-is.
- Do not remove existing code unless necessary. Prefer additive, modular edits.
- Keep import formatting and file style consistent with the repository conventions.

### High-level approach
1. Keep `HomePage` as the container for state, data fetching, Clerk, token flows, analytics, and generation handlers.
2. Add a set of small presentational components under `src/components/landing/` and compose them inside `HomePage` to replace the old layout.
3. Maintain event wiring from the new UI to the existing handlers/selectors in `HomePage` (e.g., generate, clear, token visibility, signup prompts).
4. Preserve and re‑emit analytics events as today.

### New components (all named exports)
- `src/components/landing/nav-bar.tsx`
  - Responsive top nav: brand on the left, links (`Product`, `Pricing`, `Docs`, `Changelog`), auth actions on the right (uses Clerk state already in `HomePage`).
  - Props: `{ isSignedIn: boolean; onToggleMenu?: () => void; }`.

- `src/components/landing/hero.tsx`
  - Headline: “Generate clear Agile tickets with AI”.
  - Subtext: “Describe the work. Get a crisp user story, acceptance criteria, and estimates.”
  - Gradient background wrapper (`bg-gradient-to-b from-emerald-50/40 to-white`).

- `src/components/landing/prompt-form.tsx`
  - Centered card with large `textarea` placeholder and two buttons: `Clear` (secondary) and `Generate` (primary, disabled when generating).
  - Props: `{ value: string; isGenerating: boolean; onChange: (v: string) => void; onClear: () => void; onGenerate: () => void; }`.
  - Emits the same `onGenerate` currently wired to the existing generate handler in `HomePage`.

- `src/components/landing/feature-cards.tsx`
  - Three cards laid out in a responsive grid:
    - Story-first
    - Acceptance criteria
    - Estimates & priority
  - Pure presentational; no props initially.

- `src/components/landing/footer.tsx` (optional, if we want parity)
  - Minimal copyright line.

### Integration into `HomePage`
1. Import the new components and replace the old landing layout JSX with a composition of:
   - `<NavBar />`
   - `<Hero />`
   - `<PromptForm />` wired to `inputValue`, `setInputValue`, and the existing `handleGenerate` and `handleClear` handlers.
   - `<FeatureCards />`
2. Keep all existing logic in `HomePage` including:
   - Token fetch/balance (`authenticatedTokens`, `anonymousBalance`, `hasAnonymousTokens`, `consumeAnonymousToken`, transfers).
   - Provider switching, error handling, and generated results rendering.
   - Analytics calls: `trackPageView`, `trackSessionStarted`, `trackTokenUsed`, `trackPurchase`, `trackSignup*`, `trackError`, etc.
3. Preserve existing subcomponents (`TokenManager`, `ResultsCard`, `SettingsModal`, `AdminDashboard`) and show them as today when applicable. Only the top hero + prompt area + feature cards are visually refreshed.

### Styling & UX
- Tailwind-first, no global CSS changes. Use container widths like `max-w-3xl` for the prompt card.
- Buttons: primary `Generate` with `disabled` and spinner state; secondary `Clear`.
- Accessibility: labels for the `textarea`, `aria-busy` when generating, keyboard focus outlines, Enter/Cmd+Enter to generate.
- Responsive: stack feature cards on small screens; collapse nav to a simple menu.

### Copy & branding
- Keep product name as-is in code; introduce a `BRAND_NAME` constant if we want to centralize later.
- Use the screenshot headlines; keep our current legal copy and links.

### Analytics mapping (unchanged)
- Page view and session start still fire on mount.
- Generate click → existing path that records performance/consumption.
- Clear click → no new analytics needed.
- Auth actions → still handled by existing Clerk and analytics utilities.

### Implementation steps
1) Scaffolding
   - Create directory: `src/components/landing/` with the five components above.
   - Add basic Tailwind structure and export named components.

2) Wire up in `HomePage`
   - Import new components.
   - Replace old landing JSX block with the new composition while keeping all handlers/state intact.
   - Ensure `Generate` calls the same generation function, `Clear` resets `inputValue` and any transient error state.

3) Responsive & accessibility
   - Implement responsive grid and nav.
   - Add `aria-*` attributes and keyboard shortcuts.

4) Visual polish
   - Gradient background, rounded cards, subtle shadows.
   - Ensure contrast and focus states meet WCAG AA.

5) QA & parity checks
   - Anonymous flow: free tokens, generation, low-token prompts.
   - Authenticated flow: token fetch, transfer after signup, purchase redirect success/cancel banners.
   - Error states: API failures, rate limits, invalid keys.
   - Mobile and desktop breakpoints.

6) Rollout
   - Behind a `?legacy=1` query param show the legacy layout for quick rollback during verification (optional).
   - Merge, deploy, verify analytics and conversion paths.

### Acceptance criteria
- Visual
  - Landing page matches the provided screenshot layout closely (nav, hero, prompt card, buttons, three feature cards).
  - Responsive behavior works on 360px–1440px widths.

- Functional
  - `Generate` triggers the same pipeline and analytics as before.
  - `Clear` resets the textarea and related transient errors.
  - Token usage, provider switching, and purchase banners behave exactly as before.
  - Auth and user profile navigation work unchanged.

- Quality
  - No new console errors or unhandled rejections.
  - Lighthouse performance ≥ 90, accessibility ≥ 95 on the landing page.
  - No TypeScript or lint errors introduced.

### File checklist
- [ ] `src/components/landing/nav-bar.tsx`
- [ ] `src/components/landing/hero.tsx`
- [ ] `src/components/landing/prompt-form.tsx`
- [ ] `src/components/landing/feature-cards.tsx`
- [ ] `src/components/landing/footer.tsx` (optional)
- [ ] `src/components/HomePage.tsx` layout swapped to use new components

### Nice-to-haves (post‑MVP)
- Subtle enter animations for hero and prompt card.
- Persist last prompt to `localStorage` to restore on reload.
- Add metrics for `clear_clicked` and `prompt_typing_started`.

### Risks & mitigations
- Layout regression affecting embedded components (e.g., `ResultsCard`).
  - Mitigation: Keep results rendering path untouched and outside the hero section; test all states.
- Token or auth edge cases hidden by the new layout.
  - Mitigation: Add temporary debug banner when tokens < 0 or undefined; remove post‑QA.

### Time estimate
- Scaffolding/components: 0.5 day
- Wiring + responsive + a11y: 0.5–1 day
- QA across flows + polish: 0.5 day


