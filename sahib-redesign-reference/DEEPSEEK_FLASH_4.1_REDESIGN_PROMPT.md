# DEEPSEEK FLASH 4.1 — SAHIB: INDEPENDENT PRODUCT REDESIGN, NOT A COSMETIC PATCH

## Mission

You are the principal product designer, creative director, frontend architect, accessibility specialist, and test engineer for Sahib (صاحب), an offline-first Islamic companion PWA.

Repository: `C:\Users\Protagonist\source\repos\adkar`

Reference prototype folder (inspect the HTML and open its pages in a browser): copy/extract `sahib-redesign-reference` beside the repository, or use the folder path supplied by the user. Its `index.html` is the starting page. It contains separate HTML reference screens and shared CSS. It is an exploratory reference, NOT the final design, not production code, and not a specification to copy literally.

The existing screenshot shows the current UI, not the desired endpoint. The user is dissatisfied with the current design. Do not defend or incrementally polish it by default. Reconsider the composition, information architecture, visual hierarchy, interaction model, and component system from first principles.

Your goal is a genuinely exceptional, distinctive, coherent experience that could credibly score 9/10 or higher in a rigorous independent design review. Do not fabricate scores or claim 9/10 without evidence.

## Non-negotiable first steps

1. Inspect `git status`, current branch, recent commits, and the actual app entry points. Do not discard work, reset the branch, or rewrite history.
2. Read `Objective.txt` if present, `sahib-context.txt`, `REDESIGN_PROGRESS.md`, and `DESIGN_REVIEW.md` if present.
3. Inspect the reference prototype's HTML/CSS and view every relevant reference page in a real browser. Treat it as a moodboard and design exploration, not a pixel-perfect target. Identify what is useful, what is generic, and what should be rejected.
4. Load and actually apply the relevant installed OpenCode skills. Do not just mention their names. Read their `SKILL.md` files and any relevant reference files. Prioritize:
   - `C:\Users\Protagonist\.config\opencode\skills\ui-ux-pro-max\SKILL.md`
   - `...\design\SKILL.md`
   - `...\design-system\SKILL.md`
   - `...\ui-styling\SKILL.md`
   - `...\brand\SKILL.md`
   - `...\banner-design\SKILL.md` only if using a real banner/illustration
   - any installed frontend, CSS, JavaScript, accessibility, Playwright, browser testing, or code review skills relevant to the repository.
   Resolve the real full paths rather than assuming the abbreviated paths above are directly usable. Read skill instructions before using their scripts. Do not run destructive scripts without understanding them.
5. Inspect the entire existing design system, theme files, CSS ownership rules, and page modules before editing. Understand which components and tokens are already shared.
6. Write a short evidence-based diagnosis of why the current design fails. Do not start by randomly changing CSS values.

## Product and religious-content principles

Sahib is a private, offline-first Islamic companion. Preserve its existing functionality and trusted content.

- No accounts, tracking, or cloud sync.
- User-imported PDFs stay on the device.
- Preserve IndexedDB schema, migrations, saved favorites, counters, categories, and reading positions.
- Preserve prayer calculations, location behavior, offline snapshots, service-worker behavior, and cache exemptions.
- Never invent Quran text, hadith, citations, religious rulings, sources, or devotional formulas.
- Distinguish sourced religious guidance from optional personal preferences.
- Do not imply that all users have identical circumstances.
- Keep reminders respectful, configurable, and non-shaming.
- The reference includes a reminder concept for weekly personal-care routines and tracking a potentially relevant forty-night interval. Do not treat its sample wording as a final religious ruling. Verify all religious wording against trusted project data and cited sources; make tracking configurable and explain uncertainty accurately.
- Never fake statistics, streaks, completion rates, or prayer information to make a screen look populated.

## Rethink the product, not just its skin

Explore multiple materially different concepts before choosing the final direction. They must differ in layout and information hierarchy, not only color and typography. Consider but are not limited to:
- A daily companion organized around prayer and the user's immediate context.
- An Islamic editorial reading environment with exceptional Arabic typography.
- A timeline-led day planner.
- A private personal almanac with recurring practices, reminders, and reading continuity.
- A more unconventional concept that better serves the actual app.

Select the strongest coherent direction yourself. Do not ask the user to choose between unfinished concepts. Do not blindly copy the reference prototype's page order, card layout, palette, or sample content.

The design must feel purpose-built for Sahib—not like a generic AI-generated admin dashboard. Avoid excessive rounded cards, repetitive boxes, giant empty hero panels, meaningless metadata, arbitrary gradients, tiny text, generic purple-on-gray layouts, decorative clutter, and excessive centered layouts. These are cautions, not a request to eliminate all cards, gradients, or centered text regardless of context.

Use purposeful composition, confident hierarchy, well-considered Arabic/Latin typography, readable content density, intentional whitespace, meaningful interactions, and a clear visual identity. Use ornament, texture, or illustration only when it improves meaning or the brand.

## Required screen coverage

Inspect and redesign all existing screens, not only Home. Use the prototype as a reminder of possible coverage:

- Home / daily overview
- Daily Practice
- Reminders and personal routines
- Adhkar browsing
- Adhkar focused recitation session and detail/source states
- Prayer timetable, next-prayer countdown, monthly timetable and alert settings
- Hijri calendar and event details
- 99 Names grid and individual detail/audio state
- Library discovery, grid/list variants, import/download states
- PDF reader and reader settings
- Tasbih
- Search and search results/empty states
- Settings, including themes, fonts, sidebar behavior, privacy, prayer, and alerts
- Relevant dialogs, menus, loading, error, empty, selected, completed, and overdue states discovered in the real app.

Do not force every page into the same template. Use shared components where they improve consistency, and page-specific layouts where tasks differ.

## Mandatory CSS-owned visual architecture

Visual design must have one source of truth: the CSS design system and theme layer. JavaScript controls behavior and application state, not arbitrary visual styling.

Audit all `.js` files, generated HTML templates, CSS, and theme files for:
- Hardcoded palette colors used for presentation.
- Inline `style` attributes in JavaScript-generated HTML.
- Assignments such as `element.style.color`, `backgroundColor`, `border`, `boxShadow`, `fontSize`, `fontFamily`, `borderRadius`, and other presentation properties.
- Theme-specific color conditionals and duplicate color maps in JavaScript.
- Dynamically injected stylesheets that bypass the token system.
- Hardcoded typography, spacing, radii, shadows, and other repeated visual values that belong in shared tokens.
- SVG presentation colors that should inherit CSS variables.

Move ordinary visual styling to CSS, theme tokens, semantic classes, or data attributes. JavaScript should express states such as `.is-active`, `.is-current`, `.is-overdue`, `.is-loading`, `.is-success`, and `.is-error`; CSS decides their appearance. Use appropriate native HTML and ARIA states.

Do not perform a reckless global replacement. Preserve real calculations and dynamic behavior. A calculated progress value, chart geometry, measured position, canvas drawing, or a third-party API requirement may need a dynamic value. In such cases, keep JavaScript limited to the dynamic measurement/value, keep colors and ordinary appearance in CSS, and document legitimate inline-style exceptions. Do not treat ordinary inline styling as a legitimate exception.

Centralize semantic tokens for text, surfaces, borders, actions, focus, selection, disabled states, feedback states, prayer and reminder states, overlays, data visualization, typography, spacing, radii, shadows, and motion. Keep palette values inside theme definitions and map them to semantic variables. Components must not depend on palette-specific variable names.

Preserve all five existing theme families (Catppuccin, Dracula, Tokyo Night, Rosé Pine, Aura), their light/dark modes, nine accents per family if implemented in the project, and font choices. Verify the real existing implementation rather than assuming the prototype is authoritative. Changing a theme must change the complete UI consistently.

Follow `sahib-context.txt` exactly. In particular, if it still establishes `css/responsive.css` as the sole authority for responsive layout overrides, preserve that rule. Respect required exact FIND/REPLACE patch blocks, use unique source matches, inspect diffs, and run `node --check` after every JavaScript edit.

Create a maintainable automated audit for hardcoded visual styles if appropriate. It must report confirmed violations, documented legitimate exceptions, and non-presentation literals separately. It must not hide violations by excluding difficult files or falsely flag Arabic content, dates, calculation constants, identifiers, SVG geometry, or ordinary data.

## Desktop-first design and implementation

Focus first on desktop at 1280, 1440, 1600, and 1920 px. Use available width intentionally, without stretching long reading content too far or leaving huge unused regions. Establish a coherent grid, aligned edges, clear navigation, purposeful column proportions, readable type, and a visible primary task.

The Home page should quickly answer:
1. What is the current context of my day?
2. What is the next prayer and how long remains?
3. What should I pay attention to today?
4. Which configured routines or reminders are relevant?
5. What can I continue reading or doing?
6. How do I reach frequent features?

These are priorities, not a demand to cram every widget above the fold. A configured daily-practice list and an empty one must have different visual weight. Empty states should be compact, useful, and inviting—not giant panels that dominate the page.

Arabic and RTL content must remain natural and readable. Check font rendering, line height, punctuation, mixed-direction content, source citations, and responsive behavior. Keep touch/Android-specific redesign for a later explicit phase, but do not make the desktop design structurally hostile to smaller screens.

## Visual critic cycle — mandatory

Do not equate passing tests with good design.

1. Implement only the shared shell and the Home composition first.
2. Run the actual application and capture real screenshots at 1280, 1440, and 1920 px, plus representative light/dark themes.
3. Use a genuinely independent critic agent or isolated fresh-context review if available. Give it only the screenshots, user goals, design brief, and rubric—not implementation code during its first review. If no separate agent is available, do a separately labeled second-pass review and be honest about it.
4. Request specific evidence-based scores out of 10 for composition, information hierarchy, use of space, typography, originality, coherence, usability, empty states, accessibility, and overall quality. Require the five most damaging issues and the smallest high-impact fixes. No praise-only reviews.
5. Fix the highest-impact problems, capture new screenshots, and repeat.
6. Do not accept a high score without evidence. Target at least 9/10 overall and no major visual dimension below 9/10. If the design is weak, change the composition rather than polishing details.
7. Only after Home has passed a credible review should the new design language be applied to other modules.
8. Capture actual final screenshots of all important screens and states, not just a single hero page.

## Testing and quality gate

Run the existing functional tests and Playwright tests. If there is no committed automated suite, document what was actually tested and avoid overstating coverage.

Verify:
- All views and navigation.
- Theme families, light/dark modes, accents, font settings, and persistence.
- Prayer countdowns, timetable and offline fallback.
- Reminder creation/editing/completion and overdue/approaching states.
- Adhkar browsing, recitation, repeat counts, favorites, and source displays.
- Library, local PDF import, offline reading, and saved position.
- Tasbih interaction and persistence.
- Search and all relevant empty/error/loading states.
- Arabic/RTL layout and keyboard/accessibility behavior.
- WCAG AA contrast across all supported themes/modes.
- No horizontal overflow at desktop widths and representative narrow widths.
- No new console errors, missing local assets, duplicate app-shell entries, or failed navigation.
- Service worker registration, offline reload, IndexedDB compatibility, and preservation of special cache exemptions.
- CSS ownership audit for hardcoded styles in JavaScript.

After every JavaScript edit run `node --check` on the edited file. Inspect the final diff and run the required tests again after the final changes.

Only bump the service-worker version when the project's rules require it for changed assets. Preserve `sahib-books` and `sahib-asma-audio` cache exemptions.

## Git and safety

Work on the existing intended redesign branch unless the repository context explicitly directs otherwise. Never force-push, delete branches, rewrite published history, discard unrelated work, expose secrets, or deploy without explicit approval. The user has authorized normal implementation and commits, but the new visual direction must be reviewed before publishing. Inspect `git status` before and after changes. Keep commits focused and meaningful.

## Final deliverables

- A short diagnosis of the previous visual failure.
- The concepts explored and rationale for the chosen direction.
- A coherent redesigned Home and all major application screens.
- Real browser screenshots for desktop widths and relevant theme modes.
- Independent critic's actual initial/final scores and findings.
- A written `DESIGN_REVIEW.md` with screenshot evidence and remaining issues.
- Updated `REDESIGN_PROGRESS.md`.
- A hardcoded-visual-style audit and documented exceptions.
- Test, syntax, accessibility/contrast, offline, and service-worker results.
- Final commit hash and branch/worktree status.
- A candid list of unresolved problems.

Never claim 9/10 quality just because the application renders, tests pass, or contrast ratios are compliant. The final result must be visibly, materially better and must preserve the product's actual behavior and religious-content integrity.

Begin with repository inspection, skill loading, and diagnosis. Explore alternatives before implementing. Do not begin with random CSS edits or copy the prototype literally.
