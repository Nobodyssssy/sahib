//! Explorer owns only the parent. Sahib owns and recreates its drawing surface.
use crate::widget_watch;
use std::{
    ptr,
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use windows::{
    core::Interface,
    Win32::{Foundation::HWND as WinHwnd, System::Com::*, UI::Accessibility::*},
};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::Gdi::ScreenToClient,
    UI::{HiDpi::*, WindowsAndMessaging::*},
};

pub type Rect = (i32, i32, i32, i32);
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
    pub handle: isize,
    pub process: u32,
    pub rect: Rect,
    pub occupied: Vec<(i32, i32)>,
    pub measured: bool,
}
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}
fn identity(window: HWND) -> u32 {
    let mut process = 0;
    unsafe {
        GetWindowThreadProcessId(window, &mut process);
    }
    process
}
fn bars() -> Vec<Host> {
    let mut result = Vec::new();
    unsafe {
        let primary = FindWindowW(wide("Shell_TrayWnd").as_ptr(), ptr::null());
        let process = identity(primary);
        if process == 0 {
            return result;
        }
        let mut window = primary;
        loop {
            let mut r = RECT::default();
            if identity(window) == process && GetWindowRect(window, &mut r) != 0 {
                result.push(Host {
                    handle: window as isize,
                    process,
                    rect: (r.left, r.top, r.right, r.bottom),
                    occupied: Vec::new(),
                    measured: false,
                });
            }
            window = FindWindowExW(
                ptr::null_mut(),
                if window == primary {
                    ptr::null_mut()
                } else {
                    window
                },
                wide("Shell_SecondaryTrayWnd").as_ptr(),
                ptr::null(),
            );
            if window.is_null() {
                break;
            }
        }
    }
    result
}
pub fn shell_available() -> bool {
    unsafe { !FindWindowW(wide("Shell_TrayWnd").as_ptr(), ptr::null()).is_null() }
}
pub fn valid(host: &Host) -> bool {
    unsafe { IsWindow(host.handle as HWND) != 0 && identity(host.handle as HWND) == host.process }
}
pub struct Probe {
    automation: Option<IUIAutomation>,
    initialized: bool,
    previous: Vec<Host>,
    at: Instant,
}
impl Probe {
    // This object lives on the existing non-window-owning worker, never the UI thread.
    pub fn new() -> Self {
        let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).is_ok() };
        let automation: Option<IUIAutomation> = if initialized {
            unsafe { CoCreateInstance(&CUIAutomation8, None, CLSCTX_INPROC_SERVER).ok() }
        } else {
            None
        };
        if let Some(client) = &automation {
            if let Ok(client) = client.cast::<IUIAutomation2>() {
                unsafe {
                    let _ = client.SetConnectionTimeout(300);
                    let _ = client.SetTransactionTimeout(500);
                }
            }
        }
        Self {
            automation,
            initialized,
            previous: Vec::new(),
            at: Instant::now() - Duration::from_secs(60),
        }
    }
    pub fn snapshot(&mut self) -> Vec<Host> {
        let mut hosts = bars();
        let same = hosts
            .iter()
            .map(|h| (h.handle, h.process, h.rect))
            .eq(self.previous.iter().map(|h| (h.handle, h.process, h.rect)));
        let dirty = widget_watch::LAYOUT_DIRTY.load(Ordering::Acquire);
        if same
            && (self.at.elapsed() < Duration::from_millis(500)
                || !dirty && self.at.elapsed() < Duration::from_secs(10))
        {
            return self.previous.clone();
        }
        widget_watch::LAYOUT_DIRTY.store(false, Ordering::Release);
        for host in &mut hosts {
            if widget_watch::quiescing() {
                break;
            }
            if let Some(client) = &self.automation {
                host.measured = unsafe { measure(client, host) }.is_ok();
            }
            unsafe {
                EnumChildWindows(
                    host.handle as HWND,
                    Some(foreign_surface),
                    host as *mut Host as isize,
                );
            }
        }
        self.at = Instant::now();
        self.previous = hosts.clone();
        hosts
    }
}
impl Drop for Probe {
    fn drop(&mut self) {
        self.automation.take();
        if self.initialized {
            unsafe {
                CoUninitialize();
            }
        }
    }
}
unsafe fn measure(client: &IUIAutomation, host: &mut Host) -> windows::core::Result<()> {
    let root = client.ElementFromHandle(WinHwnd(host.handle as _))?;
    let cache = client.CreateCacheRequest()?;
    cache.SetAutomationElementMode(AutomationElementMode_None)?;
    cache.AddProperty(UIA_BoundingRectanglePropertyId)?;
    cache.AddProperty(UIA_ControlTypePropertyId)?;
    cache.AddProperty(UIA_ProcessIdPropertyId)?;
    let elements = root.FindAllBuildCache(
        TreeScope_Descendants,
        &client.CreateTrueCondition()?,
        &cache,
    )?;
    let length = elements.Length()?;
    if length > 512 {
        return Err(windows::core::Error::from_hresult(windows::core::HRESULT(
            0x80004005u32 as i32,
        )));
    }
    let mut controls = 0;
    for i in 0..length {
        let element = elements.GetElement(i)?;
        if element.CachedProcessId()? == std::process::id() as i32 {
            continue;
        }
        let kind = element.CachedControlType()?;
        if [
            UIA_ButtonControlTypeId,
            UIA_CheckBoxControlTypeId,
            UIA_ComboBoxControlTypeId,
            UIA_EditControlTypeId,
            UIA_HyperlinkControlTypeId,
            UIA_ListItemControlTypeId,
            UIA_MenuItemControlTypeId,
            UIA_RadioButtonControlTypeId,
            UIA_SliderControlTypeId,
            UIA_SplitButtonControlTypeId,
            UIA_TabItemControlTypeId,
        ]
        .contains(&kind)
        {
            let r = element.CachedBoundingRectangle()?;
            if r.right > r.left && r.bottom > host.rect.1 && r.top < host.rect.3 {
                host.occupied.push((r.left, r.right));
                controls += 1;
            }
        }
    }
    // An empty or unavailable accessibility tree is not proof of an empty taskbar.
    if controls == 0 {
        return Err(windows::core::Error::from_hresult(windows::core::HRESULT(
            0x80004005u32 as i32,
        )));
    }
    Ok(())
}
unsafe extern "system" fn foreign_surface(window: HWND, data: LPARAM) -> i32 {
    let host = &mut *(data as *mut Host);
    let process = identity(window);
    if process != host.process && process != std::process::id() && IsWindowVisible(window) != 0 {
        let mut r = RECT::default();
        if GetWindowRect(window, &mut r) != 0 && r.bottom > host.rect.1 && r.top < host.rect.3 {
            host.occupied.push((r.left, r.right));
        }
    }
    1
}
pub fn gap(host: &Host, width: i32, wanted: i32, scale: f64) -> Option<i32> {
    if !host.measured || !valid(host) {
        return None;
    }
    free_position(
        (host.rect.0, host.rect.2),
        &host.occupied,
        width,
        wanted,
        (6. * scale).ceil() as i32,
    )
}
pub fn compact_fallback(work: Rect, bar: Option<Rect>, scale: f64) -> (i32, i32, u32, u32) {
    let gap = (8. * scale).round() as i32;
    let width = ((240. * scale).round() as i32).min((work.2 - work.0 - 2 * gap).max(1));
    let height = ((48. * scale).round() as i32).min((work.3 - work.1 - 2 * gap).max(1));
    let top = bar.is_some_and(|b| b.3 <= work.1 + gap);
    (
        work.2 - gap - width,
        if top {
            work.1 + gap
        } else {
            work.3 - gap - height
        },
        width as u32,
        height as u32,
    )
}
fn free_position(
    range: (i32, i32),
    occupied: &[(i32, i32)],
    width: i32,
    wanted: i32,
    padding: i32,
) -> Option<i32> {
    let left = range.0.checked_add(padding)?;
    let right = range.1.checked_sub(padding)?;
    if width <= 0 || right - left < width {
        return None;
    }
    let mut blocks: Vec<_> = occupied
        .iter()
        .map(|(a, b)| {
            (
                a.saturating_sub(padding).max(left),
                b.saturating_add(padding).min(right),
            )
        })
        .filter(|(a, b)| b > a)
        .collect();
    blocks.sort_unstable();
    let mut start = left;
    let mut choices = Vec::new();
    for (a, b) in blocks.into_iter().chain(Some((right, right))) {
        if a - start >= width {
            choices.push(wanted.clamp(start, a - width));
        }
        start = start.max(b);
    }
    choices
        .into_iter()
        .min_by_key(|x| (*x as i64 - wanted as i64).abs())
}
pub unsafe fn create(parent: isize, owner: isize) -> HWND {
    const SS_NOTIFY: u32 = 0x0100;
    let context = if parent != 0 {
        GetWindowDpiAwarenessContext(parent as HWND)
    } else {
        -4isize as _
    };
    let previous = SetThreadDpiAwarenessContext(context);
    let window = if previous.is_null() {
        ptr::null_mut()
    } else {
        CreateWindowExW(
            WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
            wide("STATIC").as_ptr(),
            wide("Sahib · Prayer companion").as_ptr(),
            (if parent != 0 {
                WS_CHILD | WS_CLIPSIBLINGS
            } else {
                WS_POPUP
            }) | SS_NOTIFY,
            0,
            0,
            1,
            1,
            if parent != 0 {
                parent as HWND
            } else {
                owner as HWND
            },
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null(),
        )
    };
    let error = GetLastError();
    if !previous.is_null() {
        SetThreadDpiAwarenessContext(previous);
    }
    if window.is_null() {
        SetLastError(error);
    }
    window
}
pub unsafe fn position(window: HWND, parent: isize, bounds: (i32, i32, u32, u32)) -> bool {
    let mut point = POINT {
        x: bounds.0,
        y: bounds.1,
    };
    if parent != 0 && ScreenToClient(parent as HWND, &mut point) == 0 {
        return false;
    }
    SetWindowPos(
        window,
        if parent != 0 {
            HWND_TOP
        } else {
            ptr::null_mut()
        },
        point.x,
        point.y,
        bounds.2 as i32,
        bounds.3 as i32,
        SWP_NOACTIVATE | SWP_NOOWNERZORDER | if parent == 0 { SWP_NOZORDER } else { 0 },
    ) != 0
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn placement_avoids_controls_and_neighbour_widgets() {
        let occupied = [(5, 201), (1114, 1445), (2098, 2560)];
        assert_eq!(free_position((0, 2560), &occupied, 300, 0, 8), Some(209));
        assert_eq!(
            free_position((0, 2560), &occupied, 300, 2300, 8),
            Some(1790)
        );
        assert_eq!(
            free_position((0, 2560), &occupied, 300, 1200, 8),
            Some(1453)
        );
    }
    #[test]
    fn gaps_handle_full_bars_overlaps_negative_monitors_and_scaling() {
        assert_eq!(
            free_position((0, 600), &[(0, 350), (300, 600)], 240, 200, 6),
            None
        );
        assert_eq!(
            free_position((-1920, 0), &[(-1200, -800)], 300, -1100, 8),
            Some(-792)
        );
        for scale in [1., 1.25, 1.5, 2.] {
            let w = (240. * scale) as i32;
            let x = free_position(
                (-2560, 0),
                &[(-2500, -2300), (-1500, -800)],
                w,
                -2400,
                (6. * scale) as i32,
            )
            .unwrap();
            assert!(x >= -2300 + (6. * scale) as i32 && x + w <= -1500 - (6. * scale) as i32);
        }
        assert_eq!(free_position((0, 200), &[], 240, 0, 6), None);
    }
    #[test]
    fn child_uses_parent_coordinates_and_dies_with_its_parent() {
        unsafe {
            let previous = SetThreadDpiAwarenessContext(-4isize as _);
            let parent = CreateWindowExW(
                0,
                wide("STATIC").as_ptr(),
                ptr::null(),
                WS_POPUP,
                300,
                250,
                800,
                60,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null(),
            );
            assert!(!parent.is_null());
            let child = create(parent as isize, 0);
            assert!(!child.is_null(), "{}", std::io::Error::last_os_error());
            assert_eq!(GetParent(child), parent);
            assert_ne!(GetWindowLongPtrW(child, GWL_STYLE) & WS_CHILD as isize, 0);
            assert!(position(child, parent as isize, (350, 255, 240, 48)));
            let mut rect = RECT::default();
            assert_ne!(GetWindowRect(child, &mut rect), 0);
            assert_eq!(
                (rect.left, rect.top, rect.right, rect.bottom),
                (350, 255, 590, 303)
            );
            assert_eq!(GetDpiForWindow(child), GetDpiForWindow(parent));
            assert_ne!(DestroyWindow(parent), 0);
            assert_eq!(IsWindow(child), 0);
            if !previous.is_null() {
                SetThreadDpiAwarenessContext(previous);
            }
        }
    }
    #[test]
    fn crowded_fallback_keeps_compact_size_inside_the_work_area() {
        for scale in [1., 1.25, 1.5, 2.] {
            let work = (-2560, -1440, 0, -60);
            let (x, y, w, h) = compact_fallback(work, Some((-2560, -60, 0, 0)), scale);
            assert_eq!(w, (240. * scale) as u32);
            assert_eq!(h, (48. * scale) as u32);
            assert!(x >= work.0 && y >= work.1 && x + w as i32 <= work.2 && y + h as i32 <= work.3);
        }
        let (_, y, _, _) = compact_fallback((0, 48, 1920, 1080), Some((0, 0, 1920, 48)), 1.);
        assert_eq!(y, 56);
    }
}
