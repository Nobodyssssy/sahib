// Isolated QA: widget -> Open Sahib -> Practice must show content, both from a loaded and from an unloaded (closed) main window.
import path from 'node:path';
import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startQA } from '../desktop-qa-session.mjs';
import { fixture, qaControl } from '../compare-widget-memory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXE = process.argv[2];
if (!EXE) { console.error('usage: node tools/qa/verify-open-practice.mjs <qa-exe> [out-dir]'); process.exit(2); }
const OUT = path.resolve(process.argv[3] || path.join(here, '..', '..', '.qa', 'open-practice'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const qa = await startQA(OUT, { exe: EXE, profile: path.join(OUT, 'data'), env: { SAHIB_PANEL_IDLE_MS: '120000' } });
const control = qaControl(qa);
const probe = `(()=>{const v=document.getElementById('view-practice');const vis=!!v&&v.classList.contains('active');const text=(v&&v.innerText||'').trim();return JSON.stringify({active:document.querySelector('.view.active')?.id,visible:vis,chars:text.length,children:v?v.querySelectorAll('*').length:0,head:text.slice(0,80),ready:window.SahibPractice&&SahibPractice.isReady&&SahibPractice.isReady()})})()`;
async function waitPractice(view, ms = 12000) {
  const end = Date.now() + ms; let last = null;
  while (Date.now() < end) {
    try { last = JSON.parse(await view.evaluate(probe)); if (last.visible && last.chars > 150) return last; } catch {}
    await sleep(300);
  }
  return last;
}
try {
  let main = await qa.connect('main');
  await qa.waitReady(main);
  await fixture(main);
  await main.evaluate('(async()=>{await SahibPractice.enableStarter("morning-adhkar");await SahibPractice.enableStarter("evening-adhkar");await SahibPractice.addStarterSet();await SahibDesktop.sync()})()');
  await sleep(1500);

  // A. main window already loaded
  await control('open', { route: 'practice' });
  const a = await waitPractice(main);
  check('Loaded main window: Practice page has content', a && a.visible && a.chars > 150, JSON.stringify(a));

  // B. main window closed (unloaded), then widget action opens it again
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'win32.ps1'), '-ProcessId', String(qa.app.pid), '-Mode', 'close'], { encoding: 'utf8' });
  for (let i = 0; i < 40; i++) { const st = await control('status'); if (!st.mainExists) break; await sleep(500); }
  let s = await control('status');
  console.log('after close: webviews=', JSON.stringify(s.webviews), 'mainExists=', s.mainExists, 'mainVisible=', s.mainVisible);
  await control('open', { route: 'practice' });
  await sleep(2500);
  let m2 = null;
  for (let i = 0; i < 40 && !m2; i++) { try { m2 = await qa.connect('main'); } catch { await sleep(500); } }
  check('Main window was recreated', !!m2);
  if (m2) {
    await qa.waitReady(m2);
    const b = await waitPractice(m2, 15000);
    check('Recreated main window: Practice page has content', b && b.visible && b.chars > 150, JSON.stringify(b));
    if (!(b && b.visible && b.chars > 150)) {
      const dbg = await m2.evaluate(`JSON.stringify({views:[...document.querySelectorAll('.view')].map(v=>v.id+':'+v.classList.contains('active')),practiceReady:window.SahibPractice&&SahibPractice.isReady&&SahibPractice.isReady(),errors:window.__errs||null,html:document.getElementById('view-practice')?.innerHTML.slice(0,300)})`);
      console.log('DEBUG', dbg);
    }
    await m2.screenshot('practice-after-recreate.png');
  }

  // C. Practice was the last page; window closes (unloads); widget -> Open Sahib with no route must restore a rendered page
  if (m2) {
    const closeMain = async () => {
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'win32.ps1'), '-ProcessId', String(qa.app.pid), '-Mode', 'close'], { encoding: 'utf8' });
      for (let i = 0; i < 40; i++) { const st = await control('status'); if (!st.mainExists) break; await sleep(500); }
    };
    for (const [name, open, view] of [['Practice', 'openPracticeView("today")', 'view-practice'], ['Prayer', 'openPrayerView()', 'view-prayer'], ['Hijri', 'openHijriView()', 'view-hijri'], ['99 Names', 'openAsmaView()', 'view-asma'], ['Library', 'openBooksView()', 'view-books'], ['Tasbih', 'openTasbihView()', 'view-tasbih'], ['Home', 'goHomeView()', 'view-home']]) {
      let cur = await qa.connect('main');
      await cur.evaluate(open); await sleep(2000);
      await closeMain();
      await control('open', {});
      let m3 = null;
      for (let i = 0; i < 40 && !m3; i++) { try { m3 = await qa.connect('main'); } catch { await sleep(500); } }
      await qa.waitReady(m3);
      await sleep(1500);
      const c = JSON.parse(await m3.evaluate(`(()=>{const v=document.getElementById('${view}');return JSON.stringify({active:document.querySelector('.view.active')?.id,chars:(v&&v.innerText||'').trim().length})})()`));
      check('Last page ' + name + ' is restored with content after reopen from widget (no route)', c.active === view && c.chars > (view === 'view-tasbih' ? 40 : 150), JSON.stringify(c));
      await m3.screenshot('restore-' + view + '.png');
    }
  }
} catch (e) {
  check('QA run completed without exception', false, String(e && e.message || e));
} finally {
  await qa.stop();
  const failed = checks.filter(c => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed; artifacts in ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}
