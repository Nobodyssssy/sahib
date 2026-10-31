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
    fn GetWindowThreadProcessId(window: *mut c_void, process: *mut u32) -> u32;
    fn GetClientRect(window: *mut c_void, rect: *mut Rect) -> i32;
    fn ClientToScreen(window: *mut c_void, point: *mut Point) -> i32;
    fn GetCursorPos(point: *mut Point) -> i32;
    fn GetForegroundWindow() -> *mut c_void;
    fn EnumWindows(
        callback: unsafe extern "system" fn(*mut c_void, isize) -> i32,
        data: isize,
    ) -> i32;
    fn IsWindowVisible(window: *mut c_void) -> i32;
    fn IsIconic(window: *mut c_void) -> i32;
    fn GetWindowLongPtrW(window: *mut c_void, index: i32) -> isize;
    fn WindowFromPoint(point: Point) -> *mut c_void;
    fn GetAncestor(window: *mut c_void, flags: u32) -> *mut c_void;
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
#[link(name = "dwmapi")]
extern "system" {
    fn DwmGetWindowAttribute(
        window: *mut c_void,
        attribute: u32,
        value: *mut u32,
        size: u32,
    ) -> i32;
}
#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(access: u32, inherit: i32, process: u32) -> *mut c_void;
    fn QueryFullProcessImageNameW(
        process: *mut c_void,
        flags: u32,
        name: *mut u16,
        length: *mut u32,
    ) -> i32;
    fn CloseHandle(handle: *mut c_void) -> i32;
}
// Start/Search can raise Explorer's taskbar above ordinary topmost windows.
// Match the actual shell executable, not every UWP/CoreWindow application.
fn shell_window(window: *mut c_void) -> bool {
    unsafe {
        let mut name = [0u16; 128];
        let n = GetClassNameW(window, name.as_mut_ptr(), 128);
        let name = String::from_utf16_lossy(&name[..n.max(0) as usize]);
        if matches!(name.as_str(), "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
            return true;
        }
        if !matches!(
            name.as_str(),
            "Windows.UI.Core.CoreWindow"
                | "XamlExplorerHostIslandWindow"
                | "Microsoft.UI.Content.DesktopChildSiteBridge"
        ) {
            return false;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(window, &mut pid);
        let process = OpenProcess(0x1000, 0, pid);
        if process.is_null() {
            return false;
        }
        let mut path = [0u16; 2048];
        let mut length = path.len() as u32;
        let success = QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut length);
        CloseHandle(process);
        if success == 0 {
            return false;
        }
        let path = String::from_utf16_lossy(&path[..length as usize]).to_ascii_lowercase();
        path.contains("\\windows\\systemapps\\")
            && [
                "startmenuexperiencehost.exe",
                "searchhost.exe",
                "searchapp.exe",
                "shellexperiencehost.exe",
            ]
            .iter()
            .any(|name| path.ends_with(name))
    }
}
pub fn shell_interaction() -> bool {
    unsafe { shell_window(GetForegroundWindow()) }
}
// Keep a temporary lifted overlay outside the Start/Search panel itself.
// Restore the user's saved placement as soon as shell interaction ends.
pub fn shell_safe_position(
    mut b: (i32, i32, u32, u32),
    area: (i32, i32, i32, i32),
    scale: f64,
) -> (i32, i32, u32, u32) {
    let gap = (8. * scale).round() as i32;
    b.1 = (area.3 - b.3 as i32 - gap).max(area.1);
    // The shell animates multiple surfaces with different bounds. Begin at
    // the work-area edge so a centered Start panel cannot immediately cover
    // a newly lifted widget before the next location event arrives.
    b.0 = area.0 + gap;
    unsafe {
        let mut r = Rect::default();
        let hit = GetAncestor(
            WindowFromPoint(Point {
                x: b.0 + b.2 as i32 / 2,
                y: b.1 + b.3 as i32 / 2,
            }),
            2,
        );
        let mut name = [0u16; 128];
        let n = GetClassNameW(hit, name.as_mut_ptr(), 128);
        let class = String::from_utf16_lossy(&name[..n.max(0) as usize]);
        let panel = if matches!(
            class.as_str(),
            "Windows.UI.Core.CoreWindow"
                | "XamlExplorerHostIslandWindow"
                | "Microsoft.UI.Content.DesktopChildSiteBridge"
        ) {
            hit
        } else {
            GetForegroundWindow()
        };
        if GetWindowRect(panel, &mut r) != 0
            && b.0 < r.right
            && b.0 + b.2 as i32 > r.left
            && b.1 < r.bottom
            && b.1 + b.3 as i32 > r.top
        {
            let candidates = [r.left - gap - b.2 as i32, r.right + gap];
            if let Some(x) = candidates
                .into_iter()
                .filter(|x| *x >= area.0 && *x + b.2 as i32 <= area.2)
                .min_by_key(|x| (*x - b.0).abs())
            {
                b.0 = x;
            } else if r.top - gap - b.3 as i32 >= area.1 {
                b.1 = r.top - gap - b.3 as i32;
            }
        }
    }
    b
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
    let mut search = FullscreenSearch {
        monitor,
        widget,
        owner: std::process::id(),
        found: false,
    };
    // Foreground focus can move to another display while this one remains fullscreen.
    unsafe {
        EnumWindows(
            fullscreen_window,
            &mut search as *mut FullscreenSearch as isize,
        );
    }
    search.found
}
struct FullscreenSearch {
    monitor: (i32, i32, i32, i32),
    widget: isize,
    owner: u32,
    found: bool,
}
fn covers_monitor(rect: Rect, monitor: (i32, i32, i32, i32)) -> bool {
    rect.left <= monitor.0
        && rect.top <= monitor.1
        && rect.right >= monitor.2
        && rect.bottom >= monitor.3
}
unsafe extern "system" fn fullscreen_window(window: *mut c_void, data: isize) -> i32 {
    let search = &mut *(data as *mut FullscreenSearch);
    if window as isize == search.widget || IsWindowVisible(window) == 0 || IsIconic(window) != 0 {
        return 1;
    }
    let mut owner = 0;
    GetWindowThreadProcessId(window, &mut owner);
    if owner == search.owner {
        return 1;
    }
    // Click-through/non-activating overlays do not occupy the monitor.
    if GetWindowLongPtrW(window, -20) & (0x20 | 0x08000000) != 0 {
        return 1;
    }
    let mut cloaked = 0;
    if DwmGetWindowAttribute(window, 14, &mut cloaked, 4) == 0 && cloaked != 0 {
        return 1;
    }
    unsafe {
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
            return 1;
        }
        // A maximized outer frame can extend beyond the work area. Test the
        // actual client area instead, including maximized borderless games.
        let mut rect = Rect::default();
        if GetClientRect(window, &mut rect) == 0 {
            return 1;
        }
        let mut first = Point {
            x: rect.left,
            y: rect.top,
        };
        let mut last = Point {
            x: rect.right,
            y: rect.bottom,
        };
        if ClientToScreen(window, &mut first) != 0
            && ClientToScreen(window, &mut last) != 0
            && covers_monitor(
                Rect {
                    left: first.x,
                    top: first.y,
                    right: last.x,
                    bottom: last.y,
                },
                search.monitor,
            )
            && !shell_window(window)
        {
            search.found = true;
            return 0;
        }
    }
    1
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
    fn fullscreen_coverage_is_monitor_local() {
        let primary = (0, 0, 2560, 1440);
        let secondary = (-1920, 0, 0, 1080);
        let game = Rect {
            left: 0,
            top: 0,
            right: 2560,
            bottom: 1440,
        };
        assert!(covers_monitor(game, primary));
        assert!(!covers_monitor(game, secondary));
        let other = Rect {
            left: -1920,
            top: 0,
            right: 0,
            bottom: 1080,
        };
        assert!(covers_monitor(other, secondary));
        assert!(!covers_monitor(other, primary));
    }

    #[test]
    fn maximized_client_and_auto_hide_gap_are_not_fullscreen() {
        let monitor = (0, 0, 2560, 1440);
        assert!(!covers_monitor(
            Rect {
                left: 0,
                top: 32,
                right: 2560,
                bottom: 1380
            },
            monitor
        ));
        assert!(!covers_monitor(
            Rect {
                left: 0,
                top: 0,
                right: 2560,
                bottom: 1439
            },
            monitor
        ));
        assert!(covers_monitor(
            Rect {
                left: 0,
                top: 0,
                right: 2560,
                bottom: 1440
            },
            monitor
        ));
    }
    #[test]
    fn windows10_vertical_and_horizontal_taskbars_are_distinguished() {
        let monitor = (0, 0, 1920, 1080);
        for r in [
            Rect {
                left: 0,
                top: 0,
                right: 64,
                bottom: 1080,
            },
            Rect {
                left: 1856,
                top: 0,
                right: 1920,
                bottom: 1080,
            },
            Rect {
                left: -62,
                top: 0,
                right: 2,
                bottom: 1080,
            },
        ] {
            assert!(matches_bar(r, monitor, false));
            assert!(!matches_bar(r, monitor, true));
        }
        for r in [
            Rect {
                left: 0,
                top: 0,
                right: 1920,
                bottom: 48,
            },
            Rect {
                left: 0,
                top: 1032,
                right: 1920,
                bottom: 1080,
            },
        ] {
            assert!(matches_bar(r, monitor, true));
            assert!(!matches_bar(r, monitor, false));
        }
    }
    #[test]
    fn windows10_vertical_fallback_respects_negative_work_area_at_all_scales() {
        let monitor = (-1920, -200, 0, 880);
        let bar = Rect {
            left: -1920,
            top: -200,
            right: -1856,
            bottom: 880,
        };
        assert!(matches_bar(bar, monitor, false));
        assert!(!matches_bar(bar, (0, 0, 1920, 1080), false));
        let work = (-1856, -200, 0, 880);
        for scale in [1., 1.25, 1.5, 2.] {
            let (x, y, w, h) = panel_rect(work, None, work.2 - 240, scale, 180.);
            assert!(x >= work.0 && y >= work.1 && x + w as i32 <= work.2 && y + h as i32 <= work.3);
        }
    }
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
    bounds_for_axis(monitor, true)
}

pub fn vertical_bounds(monitor: (i32, i32, i32, i32)) -> Option<(i32, i32, i32, i32)> {
    bounds_for_axis(monitor, false)
}

fn matches_bar(r: Rect, monitor: (i32, i32, i32, i32), horizontal: bool) -> bool {
    if horizontal {
        let x = (r.left + r.right) / 2;
        x >= monitor.0
            && x < monitor.2
            && r.bottom > monitor.1
            && r.top < monitor.3
            && r.right - r.left > r.bottom - r.top
    } else {
        let y = (r.top + r.bottom) / 2;
        y >= monitor.1
            && y < monitor.3
            && r.right > monitor.0
            && r.left < monitor.2
            && r.bottom - r.top > r.right - r.left
    }
}

fn bounds_for_axis(
    monitor: (i32, i32, i32, i32),
    horizontal: bool,
) -> Option<(i32, i32, i32, i32)> {
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
        .find(|r| matches_bar(*r, monitor, horizontal))
        .map(|r| (r.left, r.top, r.right, r.bottom))
}
