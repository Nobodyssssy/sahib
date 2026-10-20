---
name: Sahib Almanac
description: Design and implementation rules for Sahib's hand-bound almanac interface. Use when changing Sahib CSS, desktop layout, Home, Explore/Adhkar, Daily Practice, Prayer, Settings, typography, theme tokens, contrast, or screenshots.
metadata:
  project: sahib
  version: "1.0"
  authority: sahib-context.txt
---

# Sahib Almanac

Use this skill for visual, layout, typography, accessibility, and desktop-shell
work in Sahib. It records the chosen art direction and the rules that keep later
changes coherent. It does **not** replace `sahib-context.txt`; that file remains
the authority for architecture, data, service-worker, patching, and safety
rules. Read it before editing application code.

## 1. Design philosophy

Sahib is a thoughtfully crafted, hand-bound Islamic almanac reinterpreted as a
contemporary desktop application. It is a daily volume, not a dashboard.

The interface should convey:

- Quiet confidence and editorial calm.
- A sense of time, ritual, and continuity.
- Careful composition and useful density.
- Respect for Arabic text and Islamic content.
- A distinct identity that is not generic AI-generated SaaS.

The almanac is an **art direction, not a costume**. Do not add fake paper
texture, torn edges, faux stitching, ornate frames, excessive gradients, or
decorative elements that compete with content. Express the metaphor through
composition, typography, rules, margins, and restrained colour.

Sahib is Arabic-first RTL with English working labels. Arabic is the primary
calligraphic voice; English is the annotation. Neither should look like an
afterthought.

## 2. Composition and density

- Use desktop width intentionally. Do not trap the product in an artificially
  narrow column; the shell content width is defined by
  `--content-max-width` and `--page-gutter`.
- Compose a page rather than stacking identical cards. Vary module shape by
  purpose: masthead, reading page, index, ledger, margin note, daybook.
- Home is an agenda: date and prayer context first, then what matters today,
  what is next, what can continue, then the quiet index.
- Make the next prayer, the current day, and the next useful action easy to
  identify without scanning every surface.
- Use a deliberate grid with consistent alignment and shared rules.
- Use a **three-column Explore/category grid** at desktop widths where the
  available content width supports it. Collapse gracefully through the
  existing responsive authority.
- Let whitespace establish hierarchy; do not use emptiness as a substitute for
  missing content.
- Keep body copy readable at normal desktop scale. Do not shrink metadata below
  the point where it cannot meet contrast requirements.
- Use meaningful empty states. An empty daybook, library, or search result is
  part of the composition, not an error.

### Home rhythm

The preferred Home order is:

1. Dated masthead and day context.
2. Live next-prayer widget and prayer summary.
3. Today's reading / quote as a composed reading page.
4. Today's few things (Daily Practice) with real state.
5. The Sahib Index (Adhkar, Practice, Hijri, Prayer, Library, Names, Search,
   Tasbih) as a quiet ruled index.
6. Daily prayer cycle and its legend.
7. Local-first privacy statement.

Do not turn the index into a grid of identical feature cards. Ruled rows,
editorial numbering, and Arabic/English pairing are preferred.

## 3. Visual language

- Pair Arabic and Latin type intentionally:
  - `--font-arabic` / `--font-display` for Arabic and editorial display.
  - `--font-ui` for interface text.
  - `--font-label` for small caps, metadata, and letter-spaced labels.
- Preserve Arabic shaping, diacritics, RTL direction, and line height. Never
  letter-space Arabic. Never force Arabic into a Latin line-height.
- Use subtle borders, editorial rules, dividers, and meaningful grouping before
  adding elevation.
- Avoid repetitive rounded rectangles, excessive pill controls, generic
  gradients, decorative micro-labels that repeat the obvious, and shadows on
  every surface.
- Ornament must be subordinate to content. The generated girih/grain tokens
  are optional atmosphere; they must never reduce legibility or imply a fake
  material.
- Use the sprite icon system via `icon()` / `data-icon`. Do not use emoji for
  interface rendering.
- Use accent colour for navigation, state, and a single decisive rule — not as
  a wash over whole screens.
- Keep touch/click targets comfortable. Do not make edit/delete controls more
  visually dominant than the content they act on.

## 4. Semantic tokens and theming

- Put component colour on semantic tokens:
  `--color-background`, `--color-surface`, `--color-surface-raised`,
  `--color-surface-sunken`, `--color-text-primary`, `--color-text-secondary`,
  `--color-text-muted`, `--color-border*`, `--color-accent*`,
  `--color-on-accent`, `--color-success/warning/danger/info`, and their
  `--color-on-*` pairs.
- Never hard-code palette hex values in a component when a semantic token
  exists. A new shade belongs in `css/tokens.css`, not in a view.
- Preserve all five theme families, both modes, all nine accents, and the four
  font choices. Legacy aliases (`--bg`, `--surface`, `--text`, `--accent`,
  `--ctp-*`, etc.) stay available until a deliberate migration removes them.
- Keep the theme paper wash subtle. Theme families must remain distinguishable;
  do not flatten them into a single cream/brown palette.
- Test light and dark. A fix for one mode must not create a failure in another.
- Preserve the recorded offline downloaded-state visual unless an explicit
  requirement changes it.

## 5. Accessibility

Target **WCAG 2.2 Level AA** where applicable.

- Normal text: **4.5:1** minimum contrast.
- Large text (≥24px, or ≥18.66px bold): **3:1** minimum.
- Meaningful UI components, boundaries, focus indicators, and graphical
  indicators: **3:1** minimum against adjacent colours.
- Do not use contrast ratios interchangeably. Decide which criterion applies.
- Check the actual composited background, including opacity and layered
  surfaces, not just the base palette.
- Check body text, headings, metadata, links, buttons, disabled states, form
  labels and placeholders, sidebar/navigation, borders that convey state,
  focus rings, modal/popover/toast surfaces, and each theme family in both
  modes. Accent changes that affect text or fills must also be checked.
- Fix failures with semantic tokens and state colours. Do not weaken
  accessibility to preserve a decorative treatment.
- Visible focus is mandatory. Use the existing focus-ring token and keep focus
  visible on dark and light paper.
- Icon-only controls need accessible names. Keyboard order must follow visual
  and reading order. Dialogs must manage focus and restore it on close.
- Honor `prefers-reduced-motion`; the token system already zeroes durations.
- RTL is a first-class mode. Prefer logical properties. Flip only directional
  icons; never flip non-directional symbols. English prose inside an RTL shell
  needs explicit `dir`/alignment where punctuation would jump.

## 6. Design quality gate

Before calling a screen finished, verify from the rendered browser:

- It has one clear primary purpose.
- Hierarchy is visible at a glance.
- Text is readable at normal desktop scale.
- The composition is deliberate, not a stack of interchangeable cards.
- Empty states are meaningful and interactions work.
- Colours come from semantic tokens and all supported themes/modes remain
  coherent.
- Contrast has been measured, not assumed.
- There is no horizontal overflow at the required widths
  (at least 1280, 1440, and 1920; check narrow fallback where relevant).
- The page has been reviewed as a screenshot, not only as CSS.

## 7. Engineering compatibility

- Sahib remains vanilla HTML/CSS/JavaScript. No framework, bundler, or build
  step unless `sahib-context.txt` explicitly permits one.
- Preserve IndexedDB schema and semantics, user data, offline behaviour,
  service-worker contracts, cache exemptions (`sahib-books`,
  `sahib-asma-audio`), prayer calculation, reader internals, and religious
  source data.
- Desktop shell rules belong in `css/design.css`. Responsive overrides belong
  only in `css/responsive.css`; do not add new responsive rules to
  `layout.css`.
- Follow the exact FIND/REPLACE patch discipline in `sahib-context.txt`.
  Read the disk file first; never patch from memory or a chat snapshot.
- After every JavaScript edit run `node --check`. After any js/css/html edit,
  bump `sw.js VERSION` and verify cache cleanup.
- Do not add third-party runtime dependencies, analytics, accounts, telemetry,
  or cloud storage for a visual change.
- Judge the interface from actual screenshots and browser behaviour, not from
  the intention behind the CSS.

When this skill and `sahib-context.txt` disagree on architecture, data,
patching, offline behaviour, or safety, `sahib-context.txt` wins.
