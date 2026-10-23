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
    fn GetClientRect(window: *mut c_void, rect: *mut Rect) -> i32;
    fn ClientToScreen(window: *mut c_void, point: *mut Point) -> i32;
    fn GetCursorPos(point: *mut Point) -> i32;
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
#[repr(C)]
#[derive(Default)]
struct Point {
    x: i32,
    y: i32,
}
pub fn cursor_x() -> i32 {
    let mut point = Point::default();
    unsafe {
        GetCursorPos(&mut point);
    }
    point.x
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
        // A maximized outer frame can extend beyond the work area. Test the
        // actual client area instead, including maximized borderless games.
        let mut rect = Rect::default();
        if GetClientRect(window, &mut rect) == 0 {
            return false;
        }
        let mut first = Point {
            x: rect.left,
            y: rect.top,
        };
        let mut last = Point {
            x: rect.right,
            y: rect.bottom,
        };
        ClientToScreen(window, &mut first) != 0
            && ClientToScreen(window, &mut last) != 0
            && first.x <= monitor.0
            && first.y <= monitor.1
            && last.x >= monitor.2
            && last.y >= monitor.3
    }
}
pub fn safe_edges(bar: (i32, i32, i32, i32), scale: f64) -> (i32, i32, bool) {
    let mut tray = bar.2 - (400.0 * scale) as i32;
    let mut detected = false;
    unsafe {
        for class in ["Shell_TrayWnd", "Shell_SecondaryTrayWnd"] {
            let mut after = ptr::null_mut();
            loop {
                after = FindWindowExW(ptr::null_mut(), after, wide(class).as_ptr(), ptr::null());
                if after.is_null() {
                    break;
                }
                let mut rect = Rect::default();
                if GetWindowRect(after, &mut rect) == 0 || rect.left != bar.0 || rect.right != bar.2
                {
                    continue;
                }
                let child = FindWindowExW(
                    after,
                    ptr::null_mut(),
                    wide("TrayNotifyWnd").as_ptr(),
                    ptr::null(),
                );
                if !child.is_null()
                    && GetWindowRect(child, &mut rect) != 0
                    && rect.left > bar.0
                    && rect.left < bar.2
                {
                    tray = rect.left;
                    detected = true;
                    break;
                }
            }
        }
    }
    (
        bar.0 + (56.0 * scale) as i32,
        tray - (8.0 * scale) as i32,
        detected,
    )
}

// Physical pixels throughout; the caller converts the measured logical content height once.
pub fn panel_rect(
    work: (i32, i32, i32, i32),
    bar: Option<(i32, i32, i32, i32)>,
    anchor: i32,
    scale: f64,
    height: f64,
) -> (i32, i32, u32, u32) {
    let gap = (8.0 * scale).round() as i32;
    let width = ((380.0 * scale).round() as i32).min((work.2 - work.0 - 2 * gap).max(80));
    let top_limit = work.1 + gap;
    let bottom_limit = work.3 - gap;
    let height = ((height.clamp(140.0, 900.0) * scale).ceil() as i32)
        .min((bottom_limit - top_limit).max(80));
    let x = anchor.clamp(work.0 + gap, (work.2 - gap - width).max(work.0 + gap));
    let y = match bar {
        Some(b) if b.1 <= work.1 && b.3 <= work.1 + gap => (b.3 + gap).min(bottom_limit - height),
        Some(b) => (b.1 - gap - height).clamp(top_limit, (bottom_limit - height).max(top_limit)),
        None => top_limit,
    };
    (x, y, width as u32, height as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scaled_panels_stay_in_negative_and_positive_work_areas() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            for work in [
                (-1920, 0, 0, 1032),
                (0, 0, 2560, 1380),
                (-2560, -1440, 0, -60),
            ] {
                for height in [280.0, 420.0, 800.0] {
                    let (x, y, w, h) = panel_rect(
                        work,
                        Some((work.0, work.3, work.2, work.3 + 60)),
                        work.2 - 10,
                        scale,
                        height,
                    );
                    assert!(
                        x >= work.0
                            && y >= work.1
                            && x + w as i32 <= work.2
                            && y + h as i32 <= work.3
                    );
                }
            }
        }
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
