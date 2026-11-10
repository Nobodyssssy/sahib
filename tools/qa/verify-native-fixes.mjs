// Isolated QA of the native fixes. Uses the QA-identifier build only (com.sahib.companion.qa); never the installed Sahib.
import path from 'node:path';
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { startQA } from '../desktop-qa-session.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Usage: build the QA binary first (identifier com.sahib.companion.qa), then:
//   node tools/qa/verify-native-fixes.mjs <path-to-qa-exe> [output-dir]
// Never point this at the installed Sahib: the data-directory override only works for the QA identifier.
const EXE = process.argv[2];
if (!EXE) { console.error('usage: node tools/qa/verify-native-fixes.mjs <qa-exe> [out-dir]'); process.exit(2); }
const OUT = path.resolve(process.argv[3] || path.join(here, '..', '..', '.qa', 'native-fixes'));
const PS1 = path.join(here, 'win32.ps1');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const ps = (mode, pid = 0) => {
  const out = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-ProcessId', String(pid), '-Mode', mode], { encoding: 'utf8' }).trim();
  return out ? JSON.parse(out.startsWith('closed') ? JSON.stringify(out) : out) : null;
};
const asArray = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

function centreDelta(w) {
  const [x, y, ww, hh] = w.rect, [wx, wy, wW, wH] = w.work;
  return { dx: Math.round(x + ww / 2 - (wx + wW / 2)), dy: Math.round(y + hh / 2 - (wy + wH / 2)) };
}
async function mainWindow(pid, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const wins = asArray(ps('windows', pid)).filter(w => w.rect[2] >= 700 && w.rect[3] >= 500);
    if (wins.length) return wins[0];
    await sleep(500);
  }
  return null;
}

const qa = await startQA(OUT, { exe: EXE, profile: path.join(OUT, 'data') });
const pid = qa.app.pid;
console.log('QA pid', pid, 'profile', qa.profile);
try {
  let main = await qa.connect('main');
  await qa.waitReady(main);
  await sleep(1500);

  /* 1. Startup placement */
  let w = await mainWindow(pid);
  check('Main window exists at startup', !!w, w ? JSON.stringify(w.rect) : '');
  if (w) {
    const d = centreDelta(w);
    check('Startup: centred in monitor work area (|dx|,|dy| <= 2px)', Math.abs(d.dx) <= 2 && Math.abs(d.dy) <= 2, `rect=${w.rect} work=${w.work} delta=${d.dx},${d.dy}`);
  }

  /* 2. Timer lifecycle: restart honours the new duration; stop clears everything */
  const inv = (cmd, args) => main.evaluate(`window.SahibDesktop.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)})`);
  const timer = async () => (await main.evaluate('window.SahibDesktop.invoke("desktop_state")')).timer;
  await inv('desktop_timer', { action: 'start', seconds: 300, repeat: true, focus: false });
  let t = await timer();
  check('Timer start persists 300 s repeating', t.seconds === 300 && t.repeat && t.deadline > Date.now(), JSON.stringify(t));
  await inv('desktop_timer', { action: 'restart', seconds: 600, repeat: false, focus: false });
  t = await timer();
  check('Restart uses the newly chosen 600 s and repeat=false', t.seconds === 600 && t.repeat === false, JSON.stringify(t));
  await inv('desktop_timer', { action: 'stop' });
  t = await timer();
  check('Stop clears seconds, deadline and repeat', t.seconds === 0 && t.deadline === 0 && t.repeat === false, JSON.stringify(t));

  /* 3. A finished timer must not expand the widget or take focus (widget visible, sound off to stay silent) */
  await main.evaluate('window.SahibDesktop.preferences("timerSound","off")');
  await main.evaluate('window.SahibDesktop.preferences("widgetVisible", true)');
  await sleep(2500);
  let st = await main.evaluate('window.SahibDesktop.invoke("desktop_state")');
  check('Widget is visible for the test', st.prefs.widgetVisible === true, `mode=${st.prefs.widgetMode} renderer=${st.prefs.widgetRenderer}`);
  const before = { expanded: st.widgetExpanded };
  const notepad = spawn('notepad.exe', [], { detached: false });
  await sleep(2500);
  const fg0 = ps('foreground');
  await inv('desktop_timer', { action: 'start', seconds: 10, repeat: false, focus: false });
  await sleep(14000);
  st = await main.evaluate('window.SahibDesktop.invoke("desktop_state")');
  const fg1 = ps('foreground');
  check('Timer finished (finished flag set)', st.timer.finished === true, JSON.stringify(st.timer));
  check('Widget did not auto-expand', st.widgetExpanded === before.expanded && st.widgetExpanded === false, `before=${before.expanded} after=${st.widgetExpanded}`);
  check('Sahib did not take the foreground when the timer finished', !!fg1 && fg1.pid !== pid, `before=${fg0?.title} after=${fg1?.title} (foreground may change for other reasons; it must not be the QA process)`);
  try { notepad.kill(); } catch {}
  await inv('desktop_timer', { action: 'stop' });
  await main.evaluate('window.SahibDesktop.preferences("widgetVisible", false)');
  await sleep(1000);

  /* 4. Reopen through the single-instance (shortcut) path after closing the main window */
  ps('close', pid);
  await sleep(3500);
  const reopened = spawn(path.resolve(EXE), [], { env: { ...process.env, SAHIB_TEST_DATA_DIR: qa.profile }, windowsHide: true, stdio: 'ignore' });
  await Promise.race([new Promise(r => reopened.once('exit', r)), sleep(6000)]);
  await sleep(2500);
  const w2 = await mainWindow(pid, 30);
  check('Main window visible again after shortcut launch', !!w2, w2 ? JSON.stringify(w2.rect) : 'not visible');
  if (w2) {
    const d2 = centreDelta(w2);
    check('Reopen: centred in monitor work area (|dx|,|dy| <= 2px)', Math.abs(d2.dx) <= 2 && Math.abs(d2.dy) <= 2, `rect=${w2.rect} work=${w2.work} delta=${d2.dx},${d2.dy}`);
  }
} catch (e) {
  check('QA run completed without exception', false, String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
} finally {
  await qa.stop();
}
const failed = checks.filter(c => !c.pass);
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ checks, failed: failed.length }, null, 1));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
