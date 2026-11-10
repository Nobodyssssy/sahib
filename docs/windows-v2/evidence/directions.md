The current app has a coherent palette, but its hierarchy changes between screens: Home is crowded, Adhkar repeats oversized cards, Prayer scatters related information, and Tasbih leaves most of the desktop unused. The next version should make reading and daily actions feel like parts of one application.

All three directions share these rules:

- Mirror navigation, alignment and directional controls in Arabic. Keep Arabic passages RTL and time values isolated so mixed text stays readable.
- Use **24 px minimum click targets for secondary controls, 36 px for standard controls and 44 px for primary actions**. Every control gets a visible keyboard focus indicator.
- Support `Ctrl+K` for navigation and search, predictable Tab order, Escape to close overlays, and keyboard shortcuts shown beside commands.
- Show completion as neutral information. No streaks, overdue warnings or celebratory pressure.
- Use Islamic identity through excellent Arabic typography, accurate content and thoughtful reading rhythms. Remove repeated mosque scenery and ornamental framing.

**1. The Reading Desk**

**Visual idea —** A warm, typographic application built like a well-edited reference book. Fine rules, generous text measures and a disciplined margin replace the current collection of cards.

**Navigation model:** A persistent **184 px sidebar** contains the primary sections, with Arabic or English labels. Each section has one clear page title and a **48 px toolbar**; remove the repeated “Sahib / section / subtitle” header and the redundant Back button on top-level pages.

**Layout and density:**

- **24 px page margins**, **24 px column gaps**, **8 px spacing unit**.
- Main content grows to **1,440 px**, then stays centred within the workspace.
- Reading text uses a **640–760 px column**; reference information occupies an optional **280 px side column**.
- Lists use **56 px rows**, toolbars **40 px controls**, section boundaries **1 px rules**.
- At 1280 × 720, the side column becomes an explicit “Details” drawer. Primary actions remain visible without scrolling.
- White surfaces appear only where a reading or editing task needs a boundary; no card around every item.

**Typography including Arabic:** Source Serif 4 for English titles, **30/38 px**; Source Sans 3 for UI, **15/22 px**, with metadata no smaller than **13/18 px**. Noto Sans Arabic handles Arabic interface labels at **16/26 px**; Noto Naskh Arabic handles devotional passages at **28/48 px**, with a persistent reading-size setting.

**Colour roles:** Warm paper `#F5F2EB` for the workspace; near-white `#FFFEFA` for reading surfaces; ink `#173C31` for text; muted grey-green `#637068` for secondary text. Rust `#82492F` marks primary actions and selection; `#DCDDD4` supplies rules. Colour always accompanies a label, weight or position change.

**Screen changes:**

- **Home:** A compact date and location heading, followed by one clear next-prayer line and the day’s full timetable. Below it, a two-column layout pairs “Continue your practice” with one daily reading; Library and 99 Names become compact text links further down.
- **Adhkar list:** A searchable index grouped by time and situation. Each row contains the category name, number of passages, today’s completion and one Start action; editing moves to a secondary menu. Selecting a category opens its passage list in the reading column.
- **Prayer times:** Date, location, calculation method and timetable form one continuous page. Highlight the next prayer with a slim accent bar; place monthly view, export and print together in the toolbar.
- **Tasbih:** A centred reading column with the phrase, translation, large count and a **320 × 96 px “Count · Space” button**. Target, sound and reset sit in a compact supporting row; the page needs no enclosing panel.

**Main risk:** The restrained, booklike character can feel too quiet. Strong type hierarchy and unmistakable action buttons must carry the interface.

**2. The Daily Ledger**

**Visual idea —** A precise desktop utility organised around time, lists and immediate action. Its Islamic character comes from a prayer-led day and carefully set Arabic, expressed through a crisp, mostly monochrome interface.

**Navigation model:** A **152 px navigation rail** combines icons with labels. A persistent **52 px application bar** holds the current section, global search and location; contextual commands sit directly above their content.

**Layout and density:**

- **20 px page margins**, **16 px gutters**, **4 px spacing unit**.
- Use the available workspace width; cap individual text blocks rather than the entire page.
- Standard list rows are **44 px**, expanded rows **64 px**, table headers **36 px**.
- A selectable **Comfortable** setting raises rows to **56 px** and UI text to **16 px**.
- At widths above **1,600 px**, add a **320 px details pane**. Below that width, open details inline or in a drawer.
- Separate groups with rules and headings; use filled surfaces only for selection, active work and dialogs.

**Typography including Arabic:** IBM Plex Sans at **14/20 px** for controls, **24/32 px** for page titles, and tabular numerals at **16/24 px** for times. IBM Plex Sans Arabic at **15/24 px** for UI; Noto Naskh Arabic at **26/44 px** for passages. Avoid all-caps micro-labels.

**Colour roles:** Soft white `#FAFAF6` background, ink `#182B25`, secondary text `#606B65`, separators `#D8DDD7`. Deep green `#205641` identifies active navigation and primary commands; pale green `#E7EFE7` marks the selected row. Rust is reserved for destructive actions with explicit text.

**Screen changes:**

- **Home:** A working daily ledger: today’s prayer times occupy the first horizontal band; practice collections form a concise list below. A **320 px reading column** provides one passage and a Continue reading link. No hero image or promotional tiles.
- **Adhkar list:** A sortable table with Category, Passages, Today and Action columns. Search filters immediately; arrow keys move through results, Enter opens the selected collection, and an explicitly labelled Start command begins its session.
- **Prayer times:** A strong Today/Month switch changes the same timetable area. Today shows six readable rows; Month shows a full-width table with a sticky date column and a clear current-day highlight. Calculation settings remain one click away.
- **Tasbih:** A practical two-pane tool: saved phrases on the left, active phrase and counter on the right. Space counts when the counter has focus; holding a key never produces repeated counts. Decrement and reset remain visibly separate.

**Main risk:** Dense tables can make a reflective practice feel administrative. Keep scripture outside table cells and give active reading a quieter, larger presentation.

**3. The Practice Studio**

**Visual idea —** A calm desktop workspace that separates choosing a practice from performing it. A stable navigation shell opens into a focused reading or counting stage, with supporting information available at the edge.

**Navigation model:** A **168 px sidebar** remains visible while browsing. Starting a session enters a dedicated focus view with a **56 px header**, a labelled “Exit session” control and an optional **280 px contents drawer**; exiting restores the previous selection and scroll position.

**Layout and density:**

- Browse views use **24 px margins**, **20 px gutters** and **52 px list rows**.
- Active practice uses a **720 px maximum reading column** with **32 px internal margins**.
- A **64 px bottom action bar** keeps Previous, repetition count and Next in consistent positions.
- At 720 px window height, reduce outer spacing to **16 px** before reducing reading size.
- On wide screens, the optional side pane holds translation, source or session contents. It never stretches devotional text across the screen.
- Space around the active passage is intentional; browsing pages stay compact.

**Typography including Arabic:** Source Sans 3 for UI at **15/22 px** and titles at **28/36 px**. Noto Sans Arabic for interface text at **16/26 px**; Amiri for devotional passages at **32/54 px**, with translation at **17/28 px**. Users can independently resize Arabic and translation.

**Colour roles:** Warm neutral `#F3F1EA` for browsing, ivory `#FFFEF8` for active practice, dark green `#183E32` for text. Ochre-brown `#79532D` identifies primary actions; muted olive `#68705C` carries supporting information. Use a simple filled navigation marker and thin progress line.

**Screen changes:**

- **Home:** Lead with “Continue” when a session exists; otherwise show Morning, Evening and Choose a practice as three compact rows. Place next prayer beside them, followed by today’s reading. Everything essential fits above the fold at 1280 × 720.
- **Adhkar list:** A compact category index with passage previews in an adjacent pane. “Read” opens browsing; “Start session” enters the focus view. Translation and source visibility persist between sessions.
- **Prayer times:** Today’s timetable remains a straightforward list with next-prayer emphasis. An optional day timeline sits beneath it; exact times remain the primary information.
- **Tasbih:** Shares the session stage: phrase above, **72 px count**, target below and a **360 × 112 px count surface**. Keyboard focus is immediately visible; changing phrases and targets happens in the contents drawer.

**Main risk:** Focus mode introduces a second navigation context. A permanent exit control, preserved browsing state and consistent Escape behaviour are essential.

I would ship **The Reading Desk**.
It gives prayer times, Arabic reading, the library and everyday tools one coherent desktop structure.
It fixes the current hierarchy and density problems while preserving warmth and a distinctive Islamic identity.