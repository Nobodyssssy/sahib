# Sahib theme palettes

The approved courtyard design is shared by every page. Theme families change surfaces, text, controls, focus rings, progress indicators, and live panels; they retain the same layout and content.

| Family | Palette basis | Default accent | Available accents |
| --- | --- | --- | --- |
| Sahib | Original warm ivory / forest palette; companion dark palette | Sage | Sage, Brass, Clay, Madder, Plum, Indigo, Verdigris, Rosewood, Faience |
| Aura | Official Aura dark palette; light version adapted for this app | Purple | Purple, Green, Orange, Red, Pink, Blue |
| Dracula | Dracula Classic / Alucard | Purple | Purple, Pink, Cyan, Green, Yellow, Orange, Red |
| Catppuccin | Mocha / Latte | Mauve | Yellow, Peach, Red, Mauve, Blue, Teal, Green, Pink, Sky |
| Rosé Pine | Rosé Pine / Dawn | Rose | Rose, Iris, Foam, Pine, Gold, Love |
| Tokyo Night | Night with Storm surfaces / Day | Blue | Blue, Magenta, Cyan, Teal, Green, Yellow, Orange, Red |

Raw swatch colors come from each family. Interactive fills in light mode are darkened from those colors so white labels stay readable; some secondary text and raised surfaces are adjusted for app contrast. These are product adaptations, not claims of pixel-identical editor themes. The original courtyard illustration and typographic book covers remain artwork across themes.

Sources inspected on 22 October 2026:

- [Aura official repository](https://github.com/daltonmenezes/aura-theme)
- [Dracula specification](https://draculatheme.com/spec)
- [Catppuccin palette](https://catppuccin.com/palette/)
- [Rosé Pine palette](https://rosepinetheme.com/palette/)
- [Tokyo Night official repository](https://github.com/folke/tokyonight.nvim)

The existing family and accent IDs remain compatible with saved preferences. New `themeAccents` metadata remembers a separate valid accent for each family. Sidebar side, collapse state, fonts, counts and religious records keep their existing storage paths. Tasbih's custom color selector uses the current family's accents, with Theme as a fallback when a previously selected color is unavailable.
