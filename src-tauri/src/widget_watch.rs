//! Out-of-context Windows observations. No Explorer parenting, DLL injection, or input hooks.
use serde::Serialize;
use std::{
    collections::HashMap,
    ffi::c_void,
    fs,
    io::Write,
    path::Path,
    ptr,
    sync::{
        atomic::{AtomicU32, Ordering},
        mpsc::{sync_channel, Receiver, SyncSender},
        OnceLock,
    },
    time::{SystemTime, UNIX_EPOCH},
};
type Hwnd = *mut c_void;
#[repr(C)]
#[derive(Default, Clone, Copy, Serialize, PartialEq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}
#[repr(C)]
#[derive(Default, Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}
#[repr(C)]
struct Message {
    hwnd: Hwnd,
    message: u32,
    wparam: usize,
    lparam: isize,
    time: u32,
    point: Point,
    private: u32,
}
type EventProc = unsafe extern "system" fn(Hwnd, u32, Hwnd, i32, i32, u32, u32);
#[link(name = "user32")]
extern "system" {
    fn SetWinEventHook(
        min: u32,
        max: u32,
        module: Hwnd,
        callback: EventProc,
        process: u32,
        thread: u32,
        flags: u32,
    ) -> Hwnd;
    fn GetMessageW(msg: *mut Message, window: Hwnd, min: u32, max: u32) -> i32;
    fn GetWindowRect(window: Hwnd, rect: *mut Rect) -> i32;
    fn GetWindowLongPtrW(window: Hwnd, index: i32) -> isize;
    fn GetWindow(window: Hwnd, command: u32) -> Hwnd;
    fn GetTopWindow(window: Hwnd) -> Hwnd;
    fn GetAncestor(window: Hwnd, flags: u32) -> Hwnd;
    fn GetForegroundWindow() -> Hwnd;
    fn WindowFromPoint(point: Point) -> Hwnd;
    fn IsWindow(window: Hwnd) -> i32;
    fn IsWindowVisible(window: Hwnd) -> i32;
    fn IsIconic(window: Hwnd) -> i32;
    fn GetClassNameW(window: Hwnd, name: *mut u16, count: i32) -> i32;
    fn GetWindowThreadProcessId(window: Hwnd, process: *mut u32) -> u32;
    fn SetWindowPos(window: Hwnd, after: Hwnd, x: i32, y: i32, w: i32, h: i32, flags: u32) -> i32;
}
#[link(name = "dwmapi")]
extern "system" {
    fn DwmGetWindowAttribute(window: Hwnd, attribute: u32, value: *mut u32, size: u32) -> i32;
}
static WAKE: OnceLock<SyncSender<u32>> = OnceLock::new();
static EVENTS: AtomicU32 = AtomicU32::new(0);
static LAST_EVENT: AtomicU32 = AtomicU32::new(0);
static HOOKS: AtomicU32 = AtomicU32::new(0);
fn class(window: Hwnd) -> String {
    unsafe {
        let mut name = [0u16; 160];
        let n = GetClassNameW(window, name.as_mut_ptr(), 160);
        String::from_utf16_lossy(&name[..n.max(0) as usize])
    }
}
fn shell(name: &str) -> bool {
    matches!(
        name,
        "Shell_TrayWnd" | "Shell_SecondaryTrayWnd" | "Progman" | "WorkerW" | "#32769"
    )
}
unsafe extern "system" fn event(
    _: Hwnd,
    code: u32,
    window: Hwnd,
    object: i32,
    child: i32,
    _: u32,
    _: u32,
) {
    if code >= 0x8000 {
        if child != 0 || (object != 0 && object != -4) {
            return;
        }
        let name = class(window);
        let mut process = 0;
        GetWindowThreadProcessId(window, &mut process);
        // Ignore our own reorder/location events: recovery must not trigger a feedback loop.
        let own = process == std::process::id();
        if !(shell(&name)
            || (code == 0x8004 && !own)
            || (code == 0x800b && window == GetForegroundWindow())
            || (own && matches!(code, 0x8001..=0x8003 | 0x8017 | 0x8018))
            || (code == 0x8001 && object == 0))
        {
            return;
        }
    }
    EVENTS.fetch_add(1, Ordering::Relaxed);
    LAST_EVENT.store(code, Ordering::Relaxed);
    if let Some(tx) = WAKE.get() {
        let _ = tx.try_send(code);
    }
}
pub fn start() -> Receiver<u32> {
    let (tx, rx) = sync_channel(1);
    let _ = WAKE.set(tx);
    std::thread::spawn(|| unsafe {
        let mut hooks = Vec::new();
        for (min, max) in [
            (3, 3),
            (0x16, 0x17),
            (0x20, 0x20),
            (0x8000, 0x8004),
            (0x800b, 0x800b),
            (0x8017, 0x8018),
        ] {
            let hook = SetWinEventHook(min, max, ptr::null_mut(), event, 0, 0, 0);
            if !hook.is_null() {
                hooks.push(hook);
            }
        }
        HOOKS.store(hooks.len() as u32, Ordering::Relaxed);
        if let Some(tx) = WAKE.get() {
            let _ = tx.try_send(0);
        }
        let mut message: Message = std::mem::zeroed();
        while GetMessageW(&mut message, ptr::null_mut(), 0, 0) > 0 {}
    });
    rx
}
#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    pub valid: bool,
    pub visible: bool,
    pub minimized: bool,
    pub cloaked: u32,
    pub topmost: bool,
    pub bounds: Rect,
    pub widget_rank: i32,
    pub taskbar_rank: i32,
    pub covered_by_taskbar: bool,
    pub covering_class: String,
    pub foreground_class: String,
    pub foreground: isize,
}
fn rank(target: Hwnd) -> i32 {
    if target.is_null() {
        return -1;
    }
    unsafe {
        let mut window = GetTopWindow(ptr::null_mut());
        for n in 0..4096 {
            if window.is_null() {
                break;
            }
            if window == target {
                return n;
            }
            window = GetWindow(window, 2);
        }
    }
    -1
}
pub fn observe(handle: isize) -> Observation {
    unsafe {
        let window = handle as Hwnd;
        let mut bounds = Rect::default();
        GetWindowRect(window, &mut bounds);
        let mut cloaked = 0;
        DwmGetWindowAttribute(window, 14, &mut cloaked, 4);
        let hit = GetAncestor(
            WindowFromPoint(Point {
                x: (bounds.left + bounds.right) / 2,
                y: (bounds.top + bounds.bottom) / 2,
            }),
            2,
        );
        let covering_class = class(hit);
        let foreground = GetForegroundWindow();
        let is_bar = matches!(
            covering_class.as_str(),
            "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
        );
        Observation {
            valid: IsWindow(window) != 0,
            visible: IsWindowVisible(window) != 0,
            minimized: IsIconic(window) != 0,
            cloaked,
            topmost: GetWindowLongPtrW(window, -20) & 8 != 0,
            bounds,
            widget_rank: rank(window),
            taskbar_rank: if is_bar { rank(hit) } else { -1 },
            covered_by_taskbar: is_bar,
            covering_class,
            foreground_class: class(foreground),
            foreground: foreground as isize,
        }
    }
}
pub fn recover_order(handle: isize) -> bool {
    unsafe { SetWindowPos(handle as Hwnd, -1isize as Hwnd, 0, 0, 0, 0, 0x213) != 0 }
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub audits: u64,
    pub operations: HashMap<String, u64>,
    pub latest: HashMap<String, serde_json::Value>,
    #[serde(skip)]
    previous: HashMap<String, serde_json::Value>,
}
impl Diagnostics {
    pub fn operation(&mut self, name: &str) {
        *self.operations.entry(name.into()).or_default() += 1;
    }
    pub fn record<T: Serialize>(
        &mut self,
        state_file: &Path,
        label: &str,
        reason: &str,
        observation: Observation,
        context: &T,
        action: &str,
    ) {
        self.audits += 1;
        let signature = serde_json::json!({"reason":reason,"observation":observation,"context":context,"action":action});
        self.latest.insert(label.into(), signature.clone());
        if self.previous.get(label) == Some(&signature) {
            return;
        }
        self.previous.insert(label.into(), signature.clone());
        let Some(parent) = state_file.parent() else {
            return;
        };
        let file = parent.join("widget-diagnostics.jsonl");
        if fs::metadata(&file)
            .map(|m| m.len() > 2 * 1024 * 1024)
            .unwrap_or(false)
        {
            let old = parent.join("widget-diagnostics.previous.jsonl");
            let _ = fs::remove_file(&old);
            let _ = fs::rename(&file, old);
        }
        let entry = serde_json::json!({"at":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(),"window":label,"hooks":HOOKS.load(Ordering::Relaxed),"lastEvent":LAST_EVENT.load(Ordering::Relaxed),"events":EVENTS.load(Ordering::Relaxed),"data":signature});
        if let Ok(mut output) = fs::OpenOptions::new().create(true).append(true).open(file) {
            let _ = writeln!(output, "{}", entry);
        }
    }
}
