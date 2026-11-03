# Changelog

## 0.2.5 — Native Windows taskbar integration

- Embed the compact prayer widget directly inside Explorer's taskbar, preserving Sahib's existing design and prayer data.
- Keep the widget in its taskbar slot when Start opens; choose clear gaps around taskbar controls and other widgets, with a compact fallback when no space is available.
- Improve monitor-local fullscreen hiding, auto-hide recovery, per-monitor DPI and Explorer restart recovery.
- Use black primary text and dark secondary labels in light mode, including Countdown Focus digits; correct native theme-token matching.
- Fix keyboard panel re-entry and monitor-switch cleanup while preserving the accepted shutdown lifecycle and bounded panel reuse.
- Keep the compact widget native-only in the background, without an additional WebView, worker or timer.


## 0.2.4 — standard Windows build prepared, distribution clearance pending

- Enable the completed native compact widget and bounded expanded-panel reuse in the ordinary build, retaining the existing application identifier and storage.
- Use approved Windows launcher/installer/shortcut/tray artwork by default, with normal Sahib titles and 0.2.4 metadata.
- Add the user-supplied Fajr YouTube reference in About and audio notices without claiming recording identity or redistribution permission; no YouTube audio downloaded.
- Keep main/Pages unchanged. Public Windows release remains subject to the documented rights and notices gates.

## 0.2.4-rc.7 — unreleased local performance candidate

- Reuse and suspend the expanded widget for a bounded idle interval instead of recreating it on each click.
- Bootstrap authoritative cached state, consolidate widget CSS loading and add cold/warm opening timing markers.
- Keep native-only background startup and release the cached WebView after idle; preserve compatibility/floating modes.

## 0.2.4-rc.6 — unreleased local feature-freeze candidate

- Add desktop Adhkar workspace and immersive controls for the existing PDF reader.
- Generate the book catalog during builds, preserve offline identities and add desktop cards/folder browsing. Gate new PDF downloads on verified redistribution permission.
- Add four independent compact layouts and six timer sound choices with separate volume/custom import.
- Resolve native theme colors correctly; preserve user preferences and existing Adhan scheduling.
- Add localized permanent greeting, Arabic Names prominence, keyboard search and regional method suggestions.
- Include the preceding confirmed DPI clipping and Windows 10 vertical-taskbar fallback fixes. Windows 10 physical acceptance and distribution rights review remain pending.

No main merge, production release or automatic updater.
