// Isolated live QA of the Awqat-style taskbar widget: look, gold/red states, blinking yellow border, acknowledge.
// Uses the QA-identifier build only (com.sahib.companion.qa). usage: node tools/qa/verify-awqat-widget.mjs <qa-exe> [out-dir]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { startQA } from '../desktop-qa-session.mjs';
import { fixture, qaControl } from '../compare-widget-memory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXE = process.argv[2];
if (!EXE) { console.error('usage: node tools/qa/verify-awqat-widget.mjs <qa-exe> [out-dir]'); process.exit(2); }
const OUT = path.resolve(process.argv[3] || path.join(here, '..', '..', '.qa', 'awqat'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const near = (rgb, want, tol = 28) => rgb && rgb.every((v, i) => Math.abs(v - want[i]) <= tol);
const isYellow = x => x && x.yellow > 25;
const GOLD = [0xb0, 0x9e, 0x6c], RED = [0xb8, 0x5a, 0x5a];

const qa = await startQA(OUT, { exe: EXE, profile: path.join(OUT, 'data'), env: { SAHIB_PANEL_IDLE_MS: '120000' } });
const control = qaControl(qa);
try {
  const main = await qa.connect('main');
  await qa.waitReady(main);
  check('Running the isolated QA build', (await main.evaluate('window.__TAURI__.app.getIdentifier()')) === 'com.sahib.companion.qa');
  await fixture(main);
  await main.evaluate('SahibDesktop.preferences("widgetVisible", true)');
  await main.evaluate('SahibDesktop.preferences("widgetStyle", "awqat")');
  await main.evaluate('SahibDesktop.preferences("widgetBlink", true)');
  await main.evaluate('SahibDesktop.preferences("widgetTheme", "windows")');
  await sleep(2500);

  let view = null;
  for (let i = 0; i < 40 && !view; i++) {
    const s = await control('status');
    view = Object.values(s.native || {}).find(v => v.visible) || null;
    if (!view) await sleep(500);
  }
  check('Native taskbar widget is visible', !!view, view ? `reason=${view.reason} bounds=${JSON.stringify(view.bounds)} style=${view.style}` : 'no visible native view');
  if (!view) throw Error('widget not visible');
  check('Style is awqat and the widget is narrower than the old 240px design', view.style === 'awqat' && view.bounds[2] <= Math.ceil(200 * view.scale), `w=${view.bounds[2]} scale=${view.scale}`);
  const [bx, by, bw, bh] = view.bounds;

  const grab = name => {
    const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'capture-rect.ps1'), '-X', String(bx), '-Y', String(by), '-W', String(bw), '-H', String(bh), '-Out', path.join(OUT, name + '.png')], { encoding: 'utf8' });
    return JSON.parse(out.trim());
  };
  const frames = async (label, n = 8, gap = 240) => {
    const list = [];
    for (let i = 0; i < n; i++) { list.push(grab(`${label}-${i}`)); await sleep(gap); }
    return list;
  };

  const state = (await main.evaluate('window.__TAURI__.core.invoke("desktop_state")'));
  const day = state.schedule.widgetDays.find(d => d.prayers.length >= 5 && d.prayers.every(p => p.at > Date.now() - 86400000)) || state.schedule.widgetDays[0];
  const named = n => day.prayers.find(p => p.name === n);
  const dhuhr = named("Dhuhr"), asr = named("Asr"), maghrib = named("Maghrib");
  console.log('using prayers', JSON.stringify({ dhuhr: dhuhr.clock, asr: asr.clock, maghrib: maghrib.clock }));
  const MIN = 60000;

  // 1. normal: next prayer far away, previous more than 15 minutes ago
  await control('widget-time', { at: dhuhr.at + 60 * MIN });
  await sleep(1500);
  let f = await frames('normal', 5);
  check('Normal state: no yellow border and no coloured fill', f.every(x => !isYellow(x)) && !near(f[0].dominant, GOLD) && !near(f[0].dominant, RED), `center=${JSON.stringify(f[0].dominant)}`);

  // 2. soon: gold fill and a border that actually blinks
  await control('widget-time', { at: asr.at - 5 * MIN });
  await sleep(1500);
  f = await frames('soon');
  const soonY = f.filter(x => isYellow(x)).length;
  check('Before a prayer: gold fill', f.every(x => near(x.dominant, GOLD)), `center=${JSON.stringify(f[0].dominant)}`);
  check('Before a prayer: yellow border blinks (seen on and off)', soonY > 0 && soonY < f.length, `${soonY}/${f.length} frames yellow`);

  // 3. entered: red fill and blinking
  await control('widget-time', { at: asr.at + 2 * MIN });
  await sleep(1500);
  f = await frames('entered');
  const entY = f.filter(x => isYellow(x)).length;
  check('Just after a prayer: red fill', f.every(x => near(x.dominant, RED)), `center=${JSON.stringify(f[0].dominant)}`);
  check('Just after a prayer: yellow border blinks', entY > 0 && entY < f.length, `${entY}/${f.length} frames yellow`);

  // 4. acknowledge: opening the panel stops the blink, fill stays
  await control('panel');
  await sleep(1500);
  const panel = await qa.connect('desktop-widget');
  await sleep(300);
  const ps = await panel.evaluate('({state:document.body.dataset.state,blink:document.body.dataset.blink,expanded:document.body.dataset.expanded,label:document.getElementById("widget-label").textContent})');
  // Freeze the animation in its 'on' phase so a screenshot can show exactly what the outline looks like.
  await panel.evaluate(`(()=>{const s=document.createElement('style');s.id='qa-freeze';s.textContent='.prayer-widget{animation:none!important;box-shadow:0 0 0 3px #ffd21f,0 0 12px 3px rgba(255,210,31,.75)!important}';document.head.appendChild(s)})()`);
  await sleep(100);
  await panel.screenshot('panel-blink-on.png');
  await panel.evaluate('document.getElementById("qa-freeze").remove()');
  const shadows = [];
  for (let i = 0; i < 14; i++) {
    const s = await panel.evaluate('getComputedStyle(document.querySelector(".prayer-widget")).boxShadow');
    shadows.push(/255, 210, 31/.test(s));
    await sleep(110);
  }
  const onCount = shadows.filter(Boolean).length;
  check('Panel outline blinks yellow around the whole widget (seen on and off)', onCount > 0 && onCount < shadows.length, `${onCount}/${shadows.length} samples yellow`);
  f = await frames('acked', 6);
  check('After acknowledging: blinking stops (no yellow in any frame)', f.every(x => !isYellow(x)), `${f.filter(x => isYellow(x)).length}/${f.length} yellow`);
  check('After acknowledging: red fill is kept', f.every(x => near(x.dominant, RED)));
  check('Expanded panel knows it is in the entered state', ps.state === 'entered', JSON.stringify(ps));
  await control('collapse');
  await sleep(800);

  // 5. next prayer: a new reminder blinks again
  await control('widget-time', { at: maghrib.at - 5 * MIN });
  await sleep(1500);
  f = await frames('next-soon');
  const nextY = f.filter(x => isYellow(x)).length;
  check('Next prayer reminder blinks again after an earlier acknowledge', nextY > 0 && nextY < f.length, `${nextY}/${f.length} frames yellow`);

  // 6. preference off: no blinking, fill kept
  await main.evaluate('SahibDesktop.preferences("widgetBlink", false)');
  await sleep(1500);
  f = await frames('blink-off', 5);
  check('Blink preference off: no yellow border, gold fill kept', f.every(x => !isYellow(x)) && f.every(x => near(x.dominant, GOLD)));
  await main.evaluate('SahibDesktop.preferences("widgetBlink", true)');

  // 7. Arabic
  await control('preferences', { language: 'ar' });
  await sleep(1500);
  f = await frames('arabic', 4);
  check('Arabic: gold fill and blinking still work', f.every(x => near(x.dominant, GOLD)) && f.some(x => isYellow(x)));
  await control('preferences', { language: 'en' });

  await control('widget-time', { at: 0 });
  const status = await control('status');
  check('Main app still responsive', !!status);
} catch (e) {
  check('QA run completed without exception', false, String(e && e.message || e));
} finally {
  await qa.stop();
  const failed = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed; artifacts in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}
