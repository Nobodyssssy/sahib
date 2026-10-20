# Sahib — Design Directions

**Brief.** Sahib is a desktop-first Islamic daily companion: prayer times, adhkar, reading and a new Daily Practice daybook. It should feel calm, private and crafted; it must carry Arabic and English comfortably; it must make the day understandable at a glance without turning worship into a score. Existing data, prayer calculation, offline behaviour, themes and local files must survive the redesign.

Four directions were developed far enough to compare as complete ideas. They are not colour skins: each changes composition, typography, texture and the role of the page.

---

## 1. The hand-bound almanac — **selected**

**Idea.** A daily volume, not an app dashboard. The page is composed like a printed almanac: a dated masthead, ruled sections, a margin for notes, a reading page, a quiet index and a daybook of chosen practices. Ink is the primary material; gold, muted category spines and a single accent rule do the navigational work. Arabic is treated as the primary calligraphic voice, with English as the working annotation.

**Composition.** Home is an agenda: date and prayer context first, then what matters today, what is next and what can continue. Daily Practice uses the same logic at a larger scale: Today is a daybook, Upcoming is a dated ledger, Calendar is a month spread with a day margin, and All Practices is a catalog. Dialogs feel like inserted leaves, not floating app cards.

**Strengths.**
- Distinctive without being theatrical. The ruled page, masthead, Arabic display type and margin notes carry the identity.
- Naturally accommodates RTL and bilingual copy; Arabic can be large and central without looking like decoration.
- Calm by default. Density is controlled through rules and spacing rather than cards, gradients and shadows.
- Fits the product's privacy and offline claims: it feels like a local, personal volume.
- Extensible across all existing modules; the theme families can tint paper and ink without changing the composition.

**Risks.**
- Can become costume if textures, faux paper edges or ornamental borders are overdone.
- A page-like layout can become too sparse if every module is treated as a cover.
- Small metadata needs careful contrast because the palette is warm and low-chroma.
- English prose inside an RTL shell needs explicit direction handling so punctuation does not jump.

**Decision.** This is the direction. The implementation keeps the almanac structure but uses semantic tokens, flat paper, restrained rules and real interaction states. No fake paper grain, no faux stitching and no decorative element that obscures a control. The page metaphor is expressed through composition and typography, not skeuomorphic clutter.

---

## 2. The mihrab threshold — architectural immersion

**Idea.** The interface is organised around thresholds: a tall pointed-arch frame, deep indigo or stone ground, geometric screens and pools of light. Navigation feels like moving between rooms; Home is the courtyard, Prayer is the niche, the daybook is a side chamber. Type is monumental and centred; sections are separated by architecture rather than rules.

**Strengths.**
- Immediately memorable and culturally grounded.
- Strong spatial hierarchy; Prayer and Qibla could feel genuinely orienting.
- Excellent for a large desktop canvas and dramatic light/dark themes.

**Weaknesses.**
- Arch silhouettes consume space and become repetitive across lists, forms and dialogs.
- Difficult to keep calm at high information density, especially the prayer timetable and practice catalog.
- Tends to make every screen a poster; editing a reminder should not feel like entering a shrine.
- Heavy geometry is hard to translate to narrow screens without losing the idea.
- Risks reading as a mosque-themed dashboard rather than a personal daily companion.

**Verdict.** Beautiful as an art direction, too rigid as a whole product. Reserved as a possible accent for Prayer/Qibla, not the app's organising system.

---

## 3. The scholar's marginalia — manuscript annotation

**Idea.** A working manuscript: parchment ground, dense black text, red rubrication, marginal glosses, catchwords and hand-written annotations. Daily Practice would look like a annotated reading copy; sources and scholarly differences sit in the margin as first-class content. The interface is learned, intimate and deliberately bookish.

**Strengths.**
- The strongest fit for sourcing, notes, scholarly disagreement and reading.
- Rich typographic hierarchy; Arabic and English can share the page as text and gloss.
- Feels personal and human; the user's own notes become part of the page.
- The existing Library and quote/tafsir material would sit naturally inside it.

**Weaknesses.**
- Red rubrication and marginal density easily become a guilt or correction aesthetic.
- Dense annotation harms glanceability for prayer times and reminders.
- Hard to make accessible at small sizes or in dark mode without losing the manuscript character.
- The metaphor encourages decoration (ink blots, torn edges) that adds noise.
- Less appropriate for a calm daily ritual; can feel like study rather than companionship.

**Verdict.** A strong secondary voice for sources and notes, not the primary shell. Its best ideas — marginal source notes and a clear distinction between text and commentary — are absorbed into the almanac.

---

## 4. The observatory — celestial timekeeping

**Idea.** A night-sky instrument: deep blue-black, thin luminous lines, orbit-like prayer markers, a horizon arc, star charts and precise numerals. Home is a sky map of the day; the prayer cycle becomes the central visual; Daily Practice is a set of small constellations that fill in over time.

**Strengths.**
- Strong connection to prayer times, lunar dates and the passage of the day.
- Distinctive data visualisation opportunities; excellent dark-mode identity.
- Can make time and direction feel spatial without literal religious imagery.

**Weaknesses.**
- Faint luminous lines and low-contrast stars fight accessibility.
- Risks becoming a generic “space dashboard” and drifting into astrology aesthetics.
- The metaphor overweights time and underweights worship, reading and personal practice.
- “Filling in constellations” can become a streak/guilt mechanic by another name.
- Light mode is difficult to make coherent; the identity depends on darkness.

**Verdict.** Not the system. A restrained celestial motif can appear in the prayer-cycle strip, but never as a progress game.

---

## Evaluation

| Criterion | Hand-bound almanac | Mihrab threshold | Scholar's marginalia | Observatory |
| --- | --- | --- | --- | --- |
| Distinctive | High | Very high | High | High |
| Calm daily use | High | Medium | Medium | Medium |
| Arabic + English | High | Medium | High | Low–medium |
| Dense data readability | High | Low | Medium | Medium |
| Accessibility | High | Medium | Low–medium | Low |
| Fits prayer + practice + reading | High | Medium | High (reading) | Medium (time only) |
| Works across forms/dialogs | High | Low | Medium | Medium |
| Narrow fallback | High | Low | Medium | Medium |
| Buildable without gimmicks | High | Medium | Medium | Medium |

## Definitive choice

**The hand-bound almanac.** It is the only direction that makes the whole product — not just Home — feel like one considered object while staying quiet enough for daily use. Its discipline is editorial: a dated masthead, one reading page, ruled sections, a margin for sources and a daybook that records chosen practices without scoring them. The other directions contribute specific lessons: the mihrab's spatial clarity for Prayer, marginalia's respect for sources, and the observatory's sense of time in the prayer cycle. None of them becomes the shell.

The visual system is implemented through semantic tokens, five theme families, per-theme accent calibration, self-hosted Arabic/Latin type and a single responsive authority. The almanac is a composition, not a texture pack.
