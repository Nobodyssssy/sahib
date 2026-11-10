'use strict';

/* ═══════════════════════════════════════════════════════════
   Icon helper — returns inline SVG strings referencing sprite.svg
   Usage:
     icon('menu')                    → 24px default icon
     icon('menu', 16)                → 16px
     icon('menu', 16, 'my-class')    → with custom class
     icon('favorite-filled', 20)     → filled star
   ═══════════════════════════════════════════════════════════ */

function icon(name, size, className, extraAttrs){
  size = size || 20;
  const cls = className ? ` class="${className}"` : '';
  const attrs = extraAttrs ? ' ' + extraAttrs : '';
  return `<svg width="${size}" height="${size}"${cls}${attrs} aria-hidden="true"><use href="assets/icons/sprite.svg#icon-${name}"></use></svg>`;
}

