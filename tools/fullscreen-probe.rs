#![allow(dead_code)]
use std::ffi::c_void;
#[path = "../src-tauri/src/taskbar.rs"]
mod taskbar;

#[link(name = "user32")]
extern "system" {
    fn SetThreadDpiAwarenessContext(context: isize) -> isize;
    fn GetForegroundWindow() -> *mut c_void;
    fn GetWindowThreadProcessId(window: *mut c_void, process: *mut u32) -> u32;
    fn GetWindowInfo(window: *mut c_void, info: *mut WindowInfo) -> i32;
    fn GetClassNameW(window: *mut c_void, name: *mut u16, count: i32) -> i32;
    fn IsZoomed(window: *mut c_void) -> i32;
}
#[repr(C)]
#[derive(Default)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}
#[repr(C)]
#[derive(Default)]
struct WindowInfo {
    size: u32,
    window: Rect,
    client: Rect,
    style: u32,
    extended: u32,
    status: u32,
    border_x: u32,
    border_y: u32,
    atom: u16,
    version: u16,
}

fn main() {
    unsafe {
        SetThreadDpiAwarenessContext(-4);
    }
    if std::env::args().nth(1).as_deref() == Some("--foreground") {
        unsafe {
            let window = GetForegroundWindow();
            let mut pid = 0;
            let mut info = WindowInfo::default();
            info.size = std::mem::size_of::<WindowInfo>() as u32;
            let mut class = [0u16; 256];
            GetWindowThreadProcessId(window, &mut pid);
            GetWindowInfo(window, &mut info);
            let rect = info.window;
            let count = GetClassNameW(window, class.as_mut_ptr(), 256);
            let name = String::from_utf16_lossy(&class[..count.max(0) as usize])
                .replace('\\', "\\\\")
                .replace('"', "\\\"");
            println!(
                "{{\"pid\":{},\"class\":\"{}\",\"maximized\":{},\"bounds\":[{},{},{},{}]}}",
                pid,
                name,
                IsZoomed(window) != 0,
                rect.left,
                rect.top,
                rect.right,
                rect.bottom
            );
        }
        return;
    }
    let bounds: Vec<i32> = std::env::args()
        .skip(1)
        .map(|s| s.parse().expect("Monitor coordinate"))
        .collect();
    assert_eq!(
        bounds.len(),
        4,
        "Usage: fullscreen-probe left top right bottom"
    );
    println!(
        "{}",
        taskbar::fullscreen((bounds[0], bounds[1], bounds[2], bounds[3]), 0)
    );
}
