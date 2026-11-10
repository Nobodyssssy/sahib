// Isolated QA: when the session timer finishes, no widget mode may expand, resize, load its panel or take focus.
// usage: node tools/qa/verify-timer-no-expand.mjs <qa-exe> [out-dir]   (QA identifier build only)
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { startQA } from '../desktop-qa-session.mjs';
import { fixture, qaControl } from '../compare-widget-memory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXE = process.argv[2];
if (!EXE) { console.error('usage: node tools/qa/verify-timer-no-expand.mjs <qa-exe> [out-dir]'); process.exit(2); }
const ROOT = path.resolve(process.argv[3] || path.join(here, '..', '..', '.qa', 'timer-no-expand'));
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const PS1 = path.join(here, 'win32.ps1');
const ps = (mode, pid) => { const o = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-ProcessId', String(pid), '-Mode', mode], { encoding: 'utf8' }).trim(); return o ? JSON.parse(o) : null; };
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const MODES = [
  ['taskbar + lightweight (native)', { widgetMode: 'taskbar', widgetRenderer: 'native' }],
  ['floating + lightweight (native)', { widgetMode: 'floating', widgetRenderer: 'native' }],
  ['floating + web widget', { widgetMode: 'floating', widgetRenderer: 'web' }],
];

for (const [label, prefs] of MODES) {
  const out = path.join(ROOT, label.replace(/[^a-z]+/gi, '-'));
  fs.mkdirSync(out, { recursive: true });
  const qa = await startQA(out, { exe: EXE, profile: path.join(out, 'data'), env: { SAHIB_PANEL_IDLE_MS: '120000' } });
  const control = qaControl(qa);
  try {
    const main = await qa.connect('main');
    await qa.waitReady(main);
    await fixture(main);
    await main.evaluate('SahibDesktop.preferences("widgetVisible", true)');
    for (const [k, v] of Object.entries(prefs)) await main.evaluate(`SahibDesktop.preferences(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
    await sleep(3000);
    // move the main window out of the way so any pop-up would be obvious
    await control('collapse');
    const inv = (cmd, args) => main.evaluate(`window.__TAURI__.core.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args || {})})`);
    const snapshot = async () => {
      const s = await control('status');
      const st = await inv('desktop_state');
      const wins = arr(ps('windows', qa.app.pid)).map(w => ({ rect: w.rect, title: w.title }));
      const fg = ps('foreground', qa.app.pid);
      return { webviews: (s.webviews || []).slice().sort(), expanded: !!(st.view && st.view.expanded) || !!st.widgetExpanded, native: Object.values(s.native || {}).map(v => ({ b: v.bounds, vis: v.visible })), wins, fg: JSON.stringify(fg), targets: (await qa.targets()).map(t => t.url.split('/').pop()).sort() };
    };
    const before = await snapshot();
    await inv('desktop_timer', { action: 'start', seconds: 10, repeat: false, focus: false });
    await sleep(14000);
    const t = (await inv('desktop_state')).timer;
    check(`[${label}] timer actually finished`, t.finished === true, JSON.stringify(t));
    const after = await snapshot();
    check(`[${label}] widget not expanded`, !after.expanded, `expanded=${after.expanded}`);
    check(`[${label}] expanded panel webview not loaded`, !after.targets.includes('desktop-widget.html') || before.targets.includes('desktop-widget.html'), `before=${before.targets} after=${after.targets}`);
    check(`[${label}] native widget size unchanged`, JSON.stringify(before.native) === JSON.stringify(after.native), `${JSON.stringify(before.native)} -> ${JSON.stringify(after.native)}`);
    check(`[${label}] visible window sizes unchanged`, JSON.stringify(before.wins.map(w => w.rect.slice(2))) === JSON.stringify(after.wins.map(w => w.rect.slice(2))), `${JSON.stringify(before.wins.map(w => w.rect))} -> ${JSON.stringify(after.wins.map(w => w.rect))}`);
    check(`[${label}] did not take foreground`, !/sahib/i.test(String(after.fg)) || String(after.fg) === String(before.fg), String(after.fg).slice(0, 90));
  } catch (e) {
    check(`[${label}] run completed`, false, String(e && e.message || e));
  } finally {
    await qa.stop();
  }
}
const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed; artifacts in ${ROOT}`);
process.exit(failed.length ? 1 : 0);
