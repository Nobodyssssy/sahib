//! Experimental compact UI: a plain Tauri HWND painted with Win32 GDI.
//! No WebView, Explorer parenting, IPC server or second prayer engine.
use super::*;
use std::{ptr, sync::OnceLock};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::Gdi::*,
    UI::{
        Input::KeyboardAndMouse::{ReleaseCapture, SetCapture},
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::*,
    },
};
static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
type Bounds = (i32, i32, u32, u32);
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    pub monitor: String,
    pub scale: f64,
    pub bounds: Bounds,
    pub bar: Option<(i32, i32, i32, i32)>,
    pub work: (i32, i32, i32, i32),
    pub visible: bool,
    pub reason: String,
    pub handle: isize,
    pub shell_lifted: bool,
    #[serde(skip)]
    drag: Option<(i32, i32)>,
}
#[derive(Default)]
pub struct State {
    pub views: Mutex<HashMap<String, View>>,
    pub panel_monitor: Mutex<String>,
    fonts: Mutex<HashMap<String, (isize, isize, isize)>>,
}
pub fn active(app: &tauri::AppHandle) -> bool {
    experiment::mode() == "native"
        && app
            .state::<DesktopState>()
            .disk
            .lock()
            .unwrap()
            .prefs
            .widget_mode
            == "taskbar"
}
fn native_label(i: usize) -> String {
    if i == 0 {
        "native-widget".into()
    } else {
        format!("native-widget-{i}")
    }
}
pub fn init(app: &tauri::AppHandle) {
    let _ = APP.set(app.clone());
}
pub fn ensure(app: &tauri::AppHandle, p: &DesktopPrefs) {
    let count = if p.widget_monitor == "all" {
        app.available_monitors().unwrap_or_default().len()
    } else {
        1
    };
    if !p.widget_visible {
        return;
    }
    for i in 0..count {
        let label = native_label(i);
        if app.get_window(&label).is_none() {
            if let Err(e) = tauri::WindowBuilder::new(app, &label)
                .title("Sahib experimental compact widget")
                .inner_size(240., 48.)
                .decorations(false)
                .resizable(false)
                .shadow(false)
                .skip_taskbar(true)
                .always_on_top(true)
                .focused(false)
                .visible(false)
                .build()
            {
                eprintln!("[native-widget] {e}");
            } else if let Some(w) = app.get_window(&label) {
                let h = app.clone();
                let name = label.clone();
                let _ = w.run_on_main_thread(move || {
                    if let Some(w) = h.get_window(&name) {
                        if let Ok(handle) = w.hwnd() {
                            unsafe {
                                SetWindowSubclass(handle.0 as HWND, Some(subclass), 1, 0);
                            }
                        }
                    }
                });
            }
        }
    }
}
pub fn apply(app: &tauri::AppHandle, p: &DesktopPrefs) {
    let mut monitors = app.available_monitors().unwrap_or_default();
    let primary = app.primary_monitor().ok().flatten();
    monitors.sort_by_key(|m| {
        if primary
            .as_ref()
            .map(|p| p.position() == m.position())
            .unwrap_or(false)
        {
            0
        } else {
            1
        }
    });
    let selected: Vec<_> = if p.widget_monitor == "all" {
        monitors.clone()
    } else {
        monitors
            .iter()
            .find(|m| m.name().map(|n| n == &p.widget_monitor).unwrap_or(false))
            .cloned()
            .or(primary)
            .into_iter()
            .collect()
    };
    let state = app.state::<State>();
    for (label, w) in app.windows() {
        if label.starts_with("native-widget")
            && !selected
                .iter()
                .enumerate()
                .any(|(i, _)| native_label(i) == label)
        {
            drop_fonts(&state, &label);
            let _ = w.destroy();
            state.views.lock().unwrap().remove(&label);
        }
    }
    for (i, m) in selected.iter().enumerate() {
        let label = native_label(i);
        let Some(w) = app.get_window(&label) else {
            continue;
        };
        let Ok(hwnd) = w.hwnd() else { continue };
        let handle = hwnd.0 as isize;
        let pos = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        let monitor = (
            pos.x,
            pos.y,
            pos.x + size.width as i32,
            pos.y + size.height as i32,
        );
        let work = m.work_area();
        let area = (
            work.position.x,
            work.position.y,
            work.position.x + work.size.width as i32,
            work.position.y + work.size.height as i32,
        );
        let bar = taskbar::bounds(monitor);
        let width = (240. * scale).round() as i32;
        let safe = bar.map(|b| taskbar::safe_edges(b, scale));
        let name = m.name().cloned().unwrap_or_default();
        let fits = safe.map(|(a, b, _)| b - a >= width).unwrap_or(false);
        let mut bounds = if let (Some(b), Some((left, right, _))) = (bar, safe) {
            if fits {
                let offset = if p.widget_edge == "right" {
                    p.widget_right_offset
                } else {
                    p.widget_offset
                };
                let x = match p.widget_edge.as_str() {
                    "right" => right - width - (offset as f64 * scale).round() as i32,
                    "manual" => {
                        b.0 + (p
                            .widget_positions
                            .get(&name)
                            .copied()
                            .unwrap_or(p.widget_offset as f64)
                            * scale)
                            .round() as i32
                    }
                    _ => b.0 + (offset as f64 * scale).round() as i32,
                }
                .clamp(left, right - width);
                (x, b.1, width as u32, (b.3 - b.1).max(1) as u32)
            } else {
                taskbar::panel_rect(area, None, area.2 - width, scale, 80.)
            }
        } else {
            taskbar::panel_rect(area, None, area.2 - width, scale, 80.)
        };
        let old = state.views.lock().unwrap().get(&label).cloned();
        let shell_active = taskbar::shell_interaction();
        let lifted = shell_active && old.as_ref().is_some_and(|v| v.shell_lifted);
        if lifted {
            bounds.1 = (area.3 - bounds.3 as i32 - (8. * scale) as i32).max(area.1);
        }
        let rebuilding = bar.is_none() && old.as_ref().and_then(|v| v.bar).is_some();
        let reason = if !p.widget_visible {
            "user-hidden"
        } else if rebuilding {
            "taskbar-rebuilding"
        } else if taskbar::fullscreen(monitor, handle) {
            "fullscreen"
        } else if bar
            .map(|b| b.3.min(monitor.3) - b.1.max(monitor.1) < (8. * scale) as i32)
            .unwrap_or(false)
        {
            "taskbar-auto-hide"
        } else if !fits {
            "floating-compact-fallback"
        } else {
            "normal"
        };
        let visible = matches!(reason, "normal" | "floating-compact-fallback");
        let mut view = View {
            monitor: name,
            scale,
            bounds: if rebuilding {
                old.as_ref().unwrap().bounds
            } else {
                bounds
            },
            bar: if rebuilding {
                old.as_ref().and_then(|v| v.bar)
            } else {
                bar
            },
            work: area,
            visible,
            reason: reason.into(),
            handle,
            shell_lifted: lifted,
            drag: old.as_ref().and_then(|v| v.drag),
        };
        state
            .views
            .lock()
            .unwrap()
            .insert(label.clone(), view.clone());
        if !visible {
            if w.is_visible().unwrap_or(false) {
                let _ = w.hide();
            }
        } else {
            let position = tauri::PhysicalPosition::new(bounds.0, bounds.1);
            let size = tauri::PhysicalSize::new(bounds.2, bounds.3);
            if w.inner_size().ok() != Some(size) {
                let _ = w.set_size(size);
                unsafe {
                    SetWindowRgn(
                        handle as HWND,
                        CreateRoundRectRgn(
                            0,
                            0,
                            bounds.2 as i32 + 1,
                            bounds.3 as i32 + 1,
                            (14. * scale) as i32,
                            (14. * scale) as i32,
                        ),
                        1,
                    );
                }
            }
            if w.outer_position().ok() != Some(position) {
                let _ = w.set_position(position);
            }
            if !w.is_visible().unwrap_or(false) {
                let _ = w.show();
            }
            let observed = widget_watch::observe(handle);
            if observed.valid
                && observed.visible
                && observed.cloaked == 0
                && (observed.covered_by_taskbar || !observed.topmost)
            {
                let success = widget_watch::recover_order(handle);
                if shell_active && widget_watch::observe(handle).covered_by_taskbar {
                    bounds.1 = (area.3 - bounds.3 as i32 - (8. * scale) as i32).max(area.1);
                    let _ = w.set_position(tauri::PhysicalPosition::new(bounds.0, bounds.1));
                    view.bounds = bounds;
                    view.shell_lifted = true;
                    state
                        .views
                        .lock()
                        .unwrap()
                        .insert(label.clone(), view.clone());
                }
                app.state::<DesktopState>()
                    .widget_diagnostics
                    .lock()
                    .unwrap()
                    .operation(if success {
                        "native-raise"
                    } else {
                        "native-raise-failed"
                    });
            }
        }
        let ds = app.state::<DesktopState>();
        ds.widget_diagnostics.lock().unwrap().record(
            &ds.file,
            &label,
            reason,
            widget_watch::observe(handle),
            &view,
            "native-observe",
        );
        if old.as_ref().map(|v| v.scale) != Some(scale) {
            drop_fonts(&state, &label);
        }
        unsafe {
            InvalidateRect(handle as HWND, ptr::null(), 0);
        }
    }
}
fn drop_fonts(state: &State, label: &str) {
    if let Some((a, b, c)) = state.fonts.lock().unwrap().remove(label) {
        unsafe {
            DeleteObject(a as _);
            DeleteObject(b as _);
            DeleteObject(c as _);
        }
    }
}
pub fn tick(app: &tauri::AppHandle) {
    for view in app.state::<State>().views.lock().unwrap().values() {
        if view.visible {
            unsafe {
                InvalidateRect(view.handle as HWND, ptr::null(), 0);
            }
        }
    }
}
pub fn panel(app: &tauri::AppHandle, monitor: String) {
    *app.state::<State>().panel_monitor.lock().unwrap() = monitor;
    let state = app.state::<DesktopState>();
    state.widget_expanded.store(true, Ordering::Relaxed);
    let app = app.clone();
    std::thread::spawn(move || {
        if app.get_webview_window("widget").is_none() {
            if let Err(e) = experiment::build_window(&app, "widget") {
                eprintln!("[experiment] Panel: {e}");
                return;
            }
        }
        let h = app.clone();
        let _ = app.run_on_main_thread(move || {
            let p = h.state::<DesktopState>().disk.lock().unwrap().prefs.clone();
            apply_widget(&h, &p);
            emit_state(&h);
            if let Some(w) = h.get_webview_window("widget") {
                let _ = w.set_focus();
            }
        });
    });
}
fn color(value: &str) -> Option<u32> {
    let hex = value.strip_prefix('#')?;
    let n = u32::from_str_radix(hex, 16).ok()?;
    if hex.len() != 6 {
        return None;
    }
    Some(((n >> 16) & 255) | ((n >> 8) & 255) << 8 | (n & 255) << 16)
}
fn palette(app: &tauri::AppHandle, d: &DiskState) -> [u32; 5] {
    let light = if d.prefs.widget_theme == "windows" {
        taskbar::system_light()
    } else {
        d.schedule
            .theme
            .get("mode")
            .map(|s| s == "light")
            .unwrap_or(true)
    };
    if d.prefs.widget_theme == "windows" {
        return if light {
            [0xf3f3f3, 0x171717, 0x505050, 0xc5c5c5, 0xb85f00]
        } else {
            [0x202020, 0xffffff, 0xd0d0d0, 0x595959, 0xffba75]
        };
    }
    if d.prefs.widget_theme == "app" {
        let keys = [
            "--surface",
            "--text",
            "--text-muted",
            "--border",
            "--accent",
        ];
        return std::array::from_fn(|i| {
            d.schedule
                .theme
                .get(keys[i])
                .and_then(|v| color(v))
                .unwrap_or([0xf8fdff, 0x2e3c14, 0x646d64, 0xdbe4e6, 0x5a7448][i])
        });
    }
    // Read the shared CSS palette tokens; do not maintain a second hardcoded family palette.
    let family = &d.prefs.widget_theme;
    let accent = match family.as_str() {
        "sahib" => "green",
        "rose-pine" => "pink",
        "tokyo-night" => "blue",
        _ => "mauve",
    };
    let mode = if light { "light" } else { "dark" };
    let mut tokens = HashMap::<String, String>::new();
    for file in ["css/tokens.css", "css/garden-tokens.css"] {
        if let Some(asset) = app.asset_resolver().get(file.into()) {
            let css = String::from_utf8_lossy(&asset.bytes);
            for block in css.split('}') {
                let Some((selector, body)) = block.split_once('{') else {
                    continue;
                };
                let matches = selector.contains(":root")
                    || (!selector.contains(":")
                        && (!selector.contains("data-theme")
                            || selector.contains(&format!("data-theme=\"{family}\"")))
                        && (!selector.contains("data-mode")
                            || selector.contains(&format!("data-mode=\"{mode}\"")))
                        && (!selector.contains("data-accent")
                            || selector.contains(&format!("data-accent=\"{accent}\""))));
                if matches {
                    for declaration in body.split(';') {
                        if let Some((key, value)) = declaration.split_once(':') {
                            if key.trim().starts_with("--") {
                                tokens.insert(key.trim().into(), value.trim().into());
                            }
                        }
                    }
                }
            }
        }
    }
    fn resolve(tokens: &HashMap<String, String>, key: &str) -> Option<u32> {
        let mut v = tokens.get(key)?.as_str();
        for _ in 0..8 {
            if let Some(c) = color(v) {
                return Some(c);
            }
            let key = v
                .strip_prefix("var(")?
                .strip_suffix(')')?
                .split(',')
                .next()?
                .trim();
            v = tokens.get(key)?;
        }
        None
    }
    [
        resolve(&tokens, "--raw-surface-raised"),
        resolve(&tokens, "--raw-text-primary"),
        resolve(&tokens, "--raw-text-secondary"),
        resolve(&tokens, "--raw-border"),
        resolve(&tokens, &format!("--accent-{accent}")),
    ]
    .map(|v| v.unwrap_or(if light { 0x303030 } else { 0xdddddd }))
}
unsafe fn text(dc: HDC, value: &str, rect: RECT, font: HFONT, color: u32, flags: u32) {
    let v: Vec<u16> = value.encode_utf16().collect();
    let old = SelectObject(dc, font);
    SetTextColor(dc, color);
    let mut rect = rect;
    DrawTextW(
        dc,
        v.as_ptr(),
        v.len() as i32,
        &mut rect,
        flags | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX | DT_END_ELLIPSIS,
    );
    SelectObject(dc, old);
}
unsafe fn fill(dc: HDC, r: RECT, color: u32) {
    let brush = CreateSolidBrush(color);
    FillRect(dc, &r, brush);
    DeleteObject(brush);
}
unsafe fn paint(hwnd: HWND, label: &str, app: &tauri::AppHandle) {
    let state = app.state::<State>();
    let Some(view) = state.views.lock().unwrap().get(label).cloned() else {
        return;
    };
    let (name, clock, at, previous, ar, colors) = {
        let ds = app.state::<DesktopState>();
        let d = ds.disk.lock().unwrap();
        let now = now_ms();
        let next = d
            .schedule
            .prayers
            .iter()
            .filter(|p| p.at > now)
            .min_by_key(|p| p.at);
        let prev = d
            .schedule
            .widget_days
            .iter()
            .flat_map(|d| &d.prayers)
            .filter(|p| p.at <= now)
            .map(|p| p.at)
            .max();
        let ar = d.schedule.language == "ar";
        let next = if d.schedule.valid_until > now {
            next
        } else {
            None
        };
        (
            next.map(|p| {
                if ar {
                    p.name_ar.clone()
                } else {
                    p.name.clone()
                }
            })
            .unwrap_or("Sahib".into()),
            next.map(|p| p.clock.clone()).unwrap_or("—".into()),
            next.map(|p| p.at),
            prev,
            ar,
            palette(app, &d),
        )
    };
    let (surface, ink, muted, line, accent) =
        (colors[0], colors[1], colors[2], colors[3], colors[4]);
    let mut ps: PAINTSTRUCT = std::mem::zeroed();
    let screen = BeginPaint(hwnd, &mut ps);
    let mut rect: RECT = std::mem::zeroed();
    GetClientRect(hwnd, &mut rect);
    let w = rect.right;
    let h = rect.bottom;
    let dc = CreateCompatibleDC(screen);
    let bitmap = CreateCompatibleBitmap(screen, w, h);
    let old = SelectObject(dc, bitmap);
    SetBkMode(dc, TRANSPARENT as i32);
    fill(dc, rect, surface);
    let scale = view.scale;
    let u = |n: f64| (n * scale).round() as i32;
    let fonts = {
        let mut fonts = state.fonts.lock().unwrap();
        *fonts.entry(label.into()).or_insert_with(|| {
            let family: Vec<u16> = "Segoe UI\0".encode_utf16().collect();
            let font = |size: f64, weight: u32| {
                CreateFontW(
                    -u(size),
                    0,
                    0,
                    0,
                    weight as i32,
                    0,
                    0,
                    0,
                    DEFAULT_CHARSET as u32,
                    0,
                    0,
                    CLEARTYPE_QUALITY as u32,
                    0,
                    family.as_ptr(),
                ) as isize
            };
            (
                font(13., FW_SEMIBOLD),
                font(12., FW_NORMAL),
                font(16., FW_SEMIBOLD),
            )
        })
    };
    let emblem = if ar { w - u(35.) } else { u(8.) };
    let cy = h / 2;
    fill(
        dc,
        RECT {
            left: emblem,
            top: cy - u(6.),
            right: emblem + u(3.),
            bottom: cy + u(10.),
        },
        accent,
    );
    fill(
        dc,
        RECT {
            left: emblem + u(20.),
            top: cy - u(11.),
            right: emblem + u(23.),
            bottom: cy + u(10.),
        },
        accent,
    );
    fill(
        dc,
        RECT {
            left: emblem + u(6.),
            top: cy,
            right: emblem + u(17.),
            bottom: cy + u(10.),
        },
        accent,
    );
    fill(
        dc,
        RECT {
            left: emblem + u(10.),
            top: cy + u(4.),
            right: emblem + u(13.),
            bottom: cy + u(10.),
        },
        surface,
    );
    let brush = CreateSolidBrush(accent);
    let old_brush = SelectObject(dc, brush);
    let pen = CreatePen(PS_SOLID, 1, accent);
    let old_pen = SelectObject(dc, pen);
    let points = [
        POINT {
            x: emblem + u(5.),
            y: cy - u(1.),
        },
        POINT {
            x: emblem + u(11.),
            y: cy - u(10.),
        },
        POINT {
            x: emblem + u(18.),
            y: cy - u(1.),
        },
    ];
    Polygon(dc, points.as_ptr(), 3);
    SelectObject(dc, old_brush);
    SelectObject(dc, old_pen);
    DeleteObject(brush);
    DeleteObject(pen);
    let separator = if ar { w - u(38.) } else { u(37.) };
    fill(
        dc,
        RECT {
            left: separator,
            top: u(7.),
            right: separator + 1,
            bottom: h - u(7.),
        },
        line,
    );
    let (left, right, flags) = if ar {
        (u(93.), w - u(45.), DT_RIGHT | DT_RTLREADING)
    } else {
        (u(45.), w - u(92.), DT_LEFT)
    };
    text(
        dc,
        &name,
        RECT {
            left,
            top: cy - u(17.),
            right,
            bottom: cy,
        },
        fonts.0 as _,
        ink,
        flags,
    );
    text(
        dc,
        &clock,
        RECT {
            left,
            top: cy,
            right,
            bottom: cy + u(17.),
        },
        fonts.1 as _,
        ink,
        flags,
    );
    let seconds = at.map(|t| ((t - now_ms()) / 1000).max(0));
    let countdown = seconds
        .map(|s| format!("{:02}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60))
        .unwrap_or("—".into());
    let (left, right, flags) = if ar {
        (u(7.), u(93.), DT_LEFT)
    } else {
        (w - u(95.), w - u(7.), DT_RIGHT)
    };
    text(
        dc,
        if ar { "المتبقي" } else { "Remaining" },
        RECT {
            left,
            top: cy - u(19.),
            right,
            bottom: cy - u(3.),
        },
        fonts.1 as _,
        muted,
        flags,
    );
    text(
        dc,
        &countdown,
        RECT {
            left,
            top: cy - u(3.),
            right,
            bottom: cy + u(18.),
        },
        fonts.2 as _,
        ink,
        flags,
    );
    if let (Some(at), Some(previous)) = (at, previous) {
        if at > previous {
            let progress = ((now_ms() - previous) as f64 / (at - previous) as f64).clamp(0., 1.);
            let x = u(5.);
            let width = ((w - 2 * x) as f64 * progress) as i32;
            fill(
                dc,
                RECT {
                    left: if ar { w - x - width } else { x },
                    top: h - u(2.),
                    right: if ar { w - x } else { x + width },
                    bottom: h,
                },
                accent,
            );
        }
    }
    BitBlt(screen, 0, 0, w, h, dc, 0, 0, SRCCOPY);
    SelectObject(dc, old);
    DeleteObject(bitmap);
    DeleteDC(dc);
    EndPaint(hwnd, &ps);
}
unsafe extern "system" fn subclass(
    hwnd: HWND,
    msg: u32,
    wp: WPARAM,
    lp: LPARAM,
    _: usize,
    _: usize,
) -> LRESULT {
    let Some(app) = APP.get() else {
        return DefSubclassProc(hwnd, msg, wp, lp);
    };
    let label = app
        .state::<State>()
        .views
        .lock()
        .unwrap()
        .iter()
        .find(|(_, v)| v.handle == hwnd as isize)
        .map(|(k, _)| k.clone());
    if let Some(label) = label {
        match msg {
            WM_PAINT => {
                paint(hwnd, &label, app);
                return 0;
            }
            WM_ERASEBKGND => return 1,
            WM_MOUSEACTIVATE => return MA_NOACTIVATE as isize,
            WM_LBUTTONDOWN => {
                if let Some(v) = app.state::<State>().views.lock().unwrap().get_mut(&label) {
                    v.drag = Some((taskbar::cursor_x(), v.bounds.0));
                }
                SetCapture(hwnd);
                return 0;
            }
            WM_LBUTTONUP => {
                ReleaseCapture();
                let v = {
                    let ns = app.state::<State>();
                    let mut views = ns.views.lock().unwrap();
                    let v = views.get_mut(&label).unwrap();
                    let drag = v.drag.take();
                    (v.clone(), drag)
                };
                if let Some((cursor, start)) = v.1 {
                    if (taskbar::cursor_x() - cursor).abs() < 4 {
                        panel(app, v.0.monitor);
                    } else if let Some(bar) = v.0.bar {
                        let state = app.state::<DesktopState>();
                        let p = {
                            let mut d = state.disk.lock().unwrap();
                            d.prefs.widget_edge = "manual".into();
                            d.prefs.widget_positions.insert(
                                v.0.monitor,
                                ((start + taskbar::cursor_x() - cursor - bar.0) as f64 / v.0.scale)
                                    .max(0.),
                            );
                            let _ = state.save(&d);
                            d.prefs.clone()
                        };
                        apply(app, &p);
                    }
                }
                return 0;
            }
            WM_RBUTTONUP => {
                experiment::open_main(app, true, Some("settings"));
                return 0;
            }
            WM_NCDESTROY => {
                drop_fonts(&app.state::<State>(), &label);
                app.state::<State>().views.lock().unwrap().remove(&label);
                RemoveWindowSubclass(hwnd, Some(subclass), 1);
            }
            _ => {}
        }
    }
    DefSubclassProc(hwnd, msg, wp, lp)
}
