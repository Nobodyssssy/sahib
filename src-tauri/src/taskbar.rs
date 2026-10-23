// Own top-level overlay; never inject code into Explorer or modify its taskbar.
use std::{ffi::c_void, ptr};
#[repr(C)]
#[derive(Default, Clone, Copy)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}
#[link(name = "user32")]
extern "system" {
    fn GetForegroundWindow() -> *mut c_void;
    fn GetClassNameW(window: *mut c_void, name: *mut u16, count: i32) -> i32;
    fn FindWindowW(class: *const u16, title: *const u16) -> *mut c_void;
    fn FindWindowExW(
        parent: *mut c_void,
        after: *mut c_void,
        class: *const u16,
        title: *const u16,
    ) -> *mut c_void;
    fn GetWindowRect(window: *mut c_void, rect: *mut Rect) -> i32;
}
pub fn fullscreen(monitor: (i32, i32, i32, i32), widget: isize) -> bool {
    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() || window as isize == widget {
            return false;
        }
        let mut class = [0u16; 128];
        let count = GetClassNameW(window, class.as_mut_ptr(), 128);
        let name = String::from_utf16_lossy(&class[..count.max(0) as usize]);
        if [
            "Progman",
            "WorkerW",
            "Shell_TrayWnd",
            "Shell_SecondaryTrayWnd",
        ]
        .contains(&name.as_str())
        {
            return false;
        }
        let mut rect = Rect::default();
        GetWindowRect(window, &mut rect) != 0
            && rect.left <= monitor.0
            && rect.top <= monitor.1
            && rect.right >= monitor.2
            && rect.bottom >= monitor.3
    }
}
#[link(name = "advapi32")]
extern "system" {
    fn RegGetValueW(
        key: *mut c_void,
        subkey: *const u16,
        value: *const u16,
        flags: u32,
        kind: *mut u32,
        data: *mut c_void,
        size: *mut u32,
    ) -> i32;
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
pub fn system_light() -> bool {
    let key = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
    let value = wide("SystemUsesLightTheme");
    let mut light = 0u32;
    let mut size = 4u32;
    // HKCU, DWORD only. Read-only; no Windows settings are changed.
    unsafe {
        RegGetValueW(
            0x80000001u32 as i32 as isize as *mut c_void,
            key.as_ptr(),
            value.as_ptr(),
            0x10,
            ptr::null_mut(),
            &mut light as *mut _ as *mut c_void,
            &mut size,
        ) == 0
            && light != 0
    }
}
pub fn bounds(monitor: (i32, i32, i32, i32)) -> Option<(i32, i32, i32, i32)> {
    let mut bars = Vec::new();
    unsafe {
        let primary = FindWindowW(wide("Shell_TrayWnd").as_ptr(), ptr::null());
        let mut rect = Rect::default();
        if !primary.is_null() && GetWindowRect(primary, &mut rect) != 0 {
            bars.push(rect);
        }
        let mut after = ptr::null_mut();
        loop {
            after = FindWindowExW(
                ptr::null_mut(),
                after,
                wide("Shell_SecondaryTrayWnd").as_ptr(),
                ptr::null(),
            );
            if after.is_null() {
                break;
            }
            if GetWindowRect(after, &mut rect) != 0 {
                bars.push(rect);
            }
        }
    }
    bars.into_iter()
        .find(|r| {
            let x = (r.left + r.right) / 2;
            x >= monitor.0
                && x < monitor.2
                && r.bottom > monitor.1
                && r.top < monitor.3
                && r.right - r.left > r.bottom - r.top
        })
        .map(|r| (r.left, r.top, r.right, r.bottom))
}
