//! Native compact UI with an independently owned Explorer child and hidden lifecycle anchor.
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
static ACK: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);
static BLINKING: AtomicBool = AtomicBool::new(false);
/// True while any taskbar widget is blinking; the scheduler then ticks twice a second.
pub fn blinking() -> bool {
    BLINKING.load(std::sync::atomic::Ordering::Relaxed)
}
/// Clicking or activating the widget acknowledges the current reminder: the border stops blinking.
fn acknowledge() {
    ACK.store(widget_now_ms(), std::sync::atomic::Ordering::Relaxed);
}
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
    pub parent: isize,
    pub host_process: u32,
    pub owner: isize,
    pub shell_lifted: bool,
    pub style: String,
    #[serde(skip)]
    clip: Option<(u32, u32, i32)>,
    #[serde(skip)]
    drag: Option<(i32, i32)>,
    #[serde(skip)]
    flags: Option<(bool, bool, u8)>,
}
#[derive(Default)]
pub struct State {
    pub views: Mutex<HashMap<String, View>>,
    pub hosts: Mutex<Vec<taskbar_host::Host>>,
    pub panel_monitor: Mutex<String>,
    panel_creating: AtomicBool,
    pub panel_ready: AtomicBool,
    pub panel_suspended: AtomicBool,
    panel_hidden: Mutex<Option<Instant>>,
    fonts: Mutex<HashMap<String, (isize, isize, isize)>>,
}
pub fn active(app: &tauri::AppHandle) -> bool {
    let state = app.state::<DesktopState>();
    let disk = state.disk.lock().unwrap();
    experiment::mode() == "native"
        && disk.prefs.widget_mode == "taskbar"
        && disk.prefs.widget_renderer != "web"
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
pub fn focus(app: &tauri::AppHandle) {
    let h = app.clone();
    let _ = app.run_on_main_thread(move || {
        let view = h
            .state::<State>()
            .views
            .lock()
            .unwrap()
            .get("native-widget")
            .cloned();
        if let Some(v) = view.filter(|v| v.visible) {
            unsafe {
                SetForegroundWindow(v.handle as HWND);
                windows_sys::Win32::UI::Input::KeyboardAndMouse::SetFocus(v.handle as HWND);
            }
        }
    });
}
pub fn ensure(app: &tauri::AppHandle, p: &DesktopPrefs) {
    if widget_watch::quiescing() {
        return;
    }
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
                .title("Sahib · Prayer companion")
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
                    if widget_watch::quiescing() {
                        return;
                    }
                    if let Some(w) = h.get_window(&name) {
                        if let Ok(handle) = w.hwnd() {
                            unsafe {
                                SetWindowSubclass(
                                    handle.0 as HWND,
                                    Some(controller_subclass),
                                    1,
                                    0,
                                );
                            }
                        }
                    }
                });
            }
        }
    }
}
pub fn apply(app: &tauri::AppHandle, p: &DesktopPrefs) {
    let h = app.clone();
    let p = p.clone();
    let _ = app.run_on_main_thread(move || apply_ui(&h, &p));
}
fn apply_ui(app: &tauri::AppHandle, p: &DesktopPrefs) {
    if widget_watch::quiescing() {
        return;
    }
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
            let view = state.views.lock().unwrap().get(&label).cloned();
            if let Some(v) = view {
                unsafe {
                    DestroyWindow(v.handle as HWND);
                }
            }
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
        let owner = hwnd.0 as isize;
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
        let width = (if p.widget_style == "awqat" { 196. } else { 240. } * scale).round() as i32;
        let safe = bar.map(|b| taskbar::safe_edges(b, scale));
        let name = m.name().cloned().unwrap_or_default();
        let mut fits = safe.map(|(a, b, _)| b - a >= width).unwrap_or(false);
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
                taskbar_host::compact_fallback(area, bar, scale)
            }
        } else {
            taskbar_host::compact_fallback(area, bar, scale)
        };
        let host = state
            .hosts
            .lock()
            .unwrap()
            .iter()
            .find(|h| Some(h.rect) == bar)
            .cloned();
        let slot = host
            .as_ref()
            .and_then(|h| taskbar_host::gap(h, width, bounds.0, scale));
        fits &= slot.is_some();
        let (parent, host_process) = if fits {
            bounds.0 = slot.unwrap();
            let inset = (4. * scale).round() as i32;
            if bounds.3 as i32 > 2 * inset + (30. * scale) as i32 {
                bounds.1 += inset;
                bounds.3 -= (2 * inset) as u32;
            }
            let host = host.as_ref().unwrap();
            (host.handle, host.process)
        } else {
            bounds = taskbar_host::compact_fallback(area, bar, scale);
            (0, 0)
        };
        let mut old = state.views.lock().unwrap().get(&label).cloned();
        if let Some(v) = &old {
            if v.parent != parent
                || v.host_process != host_process
                || v.scale != scale
                || unsafe { IsWindow(v.handle as HWND) == 0 }
            {
                unsafe {
                    DestroyWindow(v.handle as HWND);
                }
                old = None;
            }
        }
        let handle = if let Some(v) = &old {
            v.handle
        } else {
            let window = unsafe { taskbar_host::create(parent, owner) };
            if window.is_null() {
                continue;
            }
            if unsafe { SetWindowSubclass(window, Some(subclass), 1, 0) } == 0 {
                unsafe {
                    DestroyWindow(window);
                }
                continue;
            }
            window as isize
        };
        let rebuilding = !taskbar_host::shell_available();
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
            bounds,
            bar,
            work: area,
            visible,
            reason: reason.into(),
            handle,
            parent,
            host_process,
            owner,
            shell_lifted: false,
            style: p.widget_style.clone(),
            clip: old.as_ref().and_then(|v| v.clip),
            drag: old.as_ref().and_then(|v| v.drag),
            flags: old.as_ref().and_then(|v| v.flags),
        };
        let flags = (
            fits || p.widget_always_on_top,
            !fits && p.widget_click_through,
            (p.widget_opacity.clamp(0.9, 1.0) * 255.).round() as u8,
        );
        if view.flags != Some(flags) {
            unsafe {
                let style = GetWindowLongPtrW(handle as HWND, GWL_EXSTYLE);
                let style = (style | WS_EX_LAYERED as isize) & !(WS_EX_TRANSPARENT as isize);
                SetWindowLongPtrW(
                    handle as HWND,
                    GWL_EXSTYLE,
                    style
                        | if flags.1 {
                            WS_EX_TRANSPARENT as isize
                        } else {
                            0
                        },
                );
                if parent == 0 {
                    SetWindowPos(
                        handle as HWND,
                        if flags.0 {
                            HWND_TOPMOST
                        } else {
                            HWND_NOTOPMOST
                        },
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }
                SetLayeredWindowAttributes(handle as HWND, 0, flags.2, LWA_ALPHA);
            }
            view.flags = Some(flags);
        }
        state
            .views
            .lock()
            .unwrap()
            .insert(label.clone(), view.clone());
        if !visible {
            unsafe {
                ShowWindow(handle as HWND, SW_HIDE);
            }
        } else {
            let size_changed =
                old.as_ref().map(|v| (v.bounds.2, v.bounds.3)) != Some((bounds.2, bounds.3));
            unsafe {
                let mut actual = RECT::default();
                let positioned = GetWindowRect(handle as HWND, &mut actual) != 0
                    && (actual.left, actual.top, actual.right, actual.bottom)
                        == (
                            bounds.0,
                            bounds.1,
                            bounds.0 + bounds.2 as i32,
                            bounds.1 + bounds.3 as i32,
                        );
                let hit = WindowFromPoint(POINT {
                    x: bounds.0 + bounds.2 as i32 / 2,
                    y: bounds.1 + bounds.3 as i32 / 2,
                });
                let covered = parent != 0
                    && hit != handle as HWND
                    && GetAncestor(hit, GA_ROOT) == parent as HWND;
                if !positioned || covered {
                    if !taskbar_host::position(handle as HWND, parent, bounds) {
                        ShowWindow(handle as HWND, SW_HIDE);
                        view.visible = false;
                        view.reason = "host-unavailable".into();
                        state.views.lock().unwrap().insert(label.clone(), view);
                        continue;
                    }
                }
            }
            let corner = (match p.widget_style.as_str() {
                "minimal" => 1.,
                "awqat" => 6.,
                _ => 14.,
            } * scale) as i32;
            let clip = (bounds.2, bounds.3, corner);
            if size_changed || view.clip != Some(clip) {
                unsafe {
                    let region = CreateRoundRectRgn(
                        0,
                        0,
                        bounds.2 as i32 + 1,
                        bounds.3 as i32 + 1,
                        corner,
                        corner,
                    );
                    if !region.is_null() {
                        if SetWindowRgn(handle as HWND, region, 1) != 0 {
                            view.clip = Some(clip);
                            state
                                .views
                                .lock()
                                .unwrap()
                                .insert(label.clone(), view.clone());
                        } else {
                            DeleteObject(region);
                        }
                    }
                }
            }
            unsafe {
                if IsWindowVisible(handle as HWND) == 0 {
                    ShowWindow(handle as HWND, SW_SHOWNOACTIVATE);
                }
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
        if old.as_ref().map(|v| (v.scale, v.style.clone())) != Some((scale, p.widget_style.clone()))
        {
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
    if widget_watch::quiescing() {
        return;
    }
    for view in app.state::<State>().views.lock().unwrap().values() {
        if view.visible {
            unsafe {
                InvalidateRect(view.handle as HWND, ptr::null(), 0);
            }
        }
    }
}
pub fn shutdown(app: &tauri::AppHandle) {
    let handles: Vec<_> = app
        .state::<State>()
        .views
        .lock()
        .unwrap()
        .values()
        .map(|v| v.handle)
        .collect();
    for handle in handles {
        unsafe {
            DestroyWindow(handle as HWND);
        }
    }
}
const PANEL_IDLE: Duration = Duration::from_secs(5);
fn panel_idle(app: &tauri::AppHandle) -> Duration {
    #[cfg(any(debug_assertions, feature = "desktop-qa"))]
    if app.config().identifier == "com.sahib.companion.qa" {
        if let Ok(ms) = std::env::var("SAHIB_PANEL_IDLE_MS")
            .unwrap_or_default()
            .parse::<u64>()
        {
            return Duration::from_millis(ms.clamp(5000, 60000));
        }
    }
    let _ = app;
    PANEL_IDLE
}
fn resume_panel(app: &tauri::AppHandle, w: &tauri::WebviewWindow) {
    use windows_core::Interface;
    app.state::<State>()
        .panel_suspended
        .store(false, Ordering::Release);
    let _ = w.with_webview(|webview| unsafe {
        let controller = webview.controller();
        if let Ok(core) = controller.CoreWebView2() {
            if let Ok(core) =
                core.cast::<webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3>()
            {
                let _ = core.Resume();
            }
        }
        let _ = controller.SetIsVisible(true);
    });
}
fn suspend_panel(app: &tauri::AppHandle, w: &tauri::WebviewWindow) {
    use windows_core::Interface;
    let app = app.clone();
    let _ = w.with_webview(move |webview| unsafe {
        let controller = webview.controller();
        let _ = controller.SetIsVisible(false);
        let Ok(core) = controller.CoreWebView2() else {
            return;
        };
        let Ok(core) =
            core.cast::<webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3>()
        else {
            return;
        };
        let callback =
            webview2_com::TrySuspendCompletedHandler::create(Box::new(move |result, suspended| {
                if result.is_ok() && suspended {
                    if let Some(w) = app.get_webview_window("widget") {
                        if app
                            .state::<DesktopState>()
                            .widget_expanded
                            .load(Ordering::Relaxed)
                            || w.is_visible().unwrap_or(false)
                        {
                            resume_panel(&app, &w);
                        } else {
                            app.state::<State>()
                                .panel_suspended
                                .store(true, Ordering::Release);
                        }
                    }
                }
                Ok(())
            }));
        let _ = core.TrySuspend(&callback);
    });
}
pub fn resume_compatibility_panel(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("widget") {
        resume_panel(app, &w);
    }
    *app.state::<State>().panel_hidden.lock().unwrap() = None;
}
pub fn panel_loaded(app: &tauri::AppHandle) {
    if !active(app) {
        return;
    }
    app.state::<State>()
        .panel_ready
        .store(true, Ordering::Release);
    if !app
        .state::<DesktopState>()
        .widget_expanded
        .load(Ordering::Relaxed)
    {
        if let Some(w) = app.get_webview_window("widget") {
            if !w.is_visible().unwrap_or(false) {
                suspend_panel(app, &w);
            }
        }
    }
}
pub fn hide_panel(app: &tauri::AppHandle) {
    let state = app.state::<State>();
    let Some(w) = app.get_webview_window("widget") else {
        state.panel_ready.store(false, Ordering::Release);
        return;
    };
    if w.is_visible().unwrap_or(false) {
        let _ = w.emit("sahib:panel-hidden", ());
        let _ = w.hide();
        suspend_panel(app, &w);
    }
    let expired = {
        let mut hidden = state.panel_hidden.lock().unwrap();
        hidden.get_or_insert_with(Instant::now).elapsed() >= panel_idle(app)
    };
    if expired {
        let _ = retire_webview(&w);
        state.panel_ready.store(false, Ordering::Release);
        state.panel_suspended.store(false, Ordering::Release);
        *state.panel_hidden.lock().unwrap() = None;
    }
}
fn reveal_panel(app: &tauri::AppHandle) {
    if widget_watch::quiescing() {
        return;
    }
    acknowledge();
    let state = app.state::<DesktopState>();
    if !state.widget_expanded.load(Ordering::Relaxed) {
        hide_panel(app);
        return;
    }
    *app.state::<State>().panel_hidden.lock().unwrap() = None;
    let id = panel_perf::id();
    panel_perf::mark(id, "windowReadyMs");
    if let Some(w) = app.get_webview_window("widget") {
        resume_panel(app, &w);
    }
    if let Ok(snapshot) = widget_payload(app, "widget") {
        let _ = app.emit_to(
            "widget",
            "sahib:panel-open",
            serde_json::json!({"id":id,"state":snapshot}),
        );
    }
    let prefs = state.disk.lock().unwrap().prefs.clone();
    apply_widget(app, &prefs);
    if let Some(w) = app.get_webview_window("widget") {
        let _ = w.set_focus();
        panel_perf::mark(id, "shownMs");
    }
}
fn create_panel(app: &tauri::AppHandle) {
    let state = app.state::<State>();
    if state.panel_creating.swap(true, Ordering::AcqRel) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let prefs = app
            .state::<DesktopState>()
            .disk
            .lock()
            .unwrap()
            .prefs
            .clone();
        if !active(&app) || !prefs.widget_visible {
            app.state::<State>()
                .panel_creating
                .store(false, Ordering::Release);
            return;
        }
        if app.get_webview_window("widget").is_none() {
            if let Err(error) = experiment::build_window(&app, "widget") {
                eprintln!("[panel] {error}");
                app.state::<State>()
                    .panel_creating
                    .store(false, Ordering::Release);
                return;
            }
        }
        app.state::<State>()
            .panel_creating
            .store(false, Ordering::Release);
        let h = app.clone();
        let _ = app.run_on_main_thread(move || reveal_panel(&h));
    });
}
pub fn panel(app: &tauri::AppHandle, monitor: String) {
    let warm = app.get_webview_window("widget").is_some()
        && app.state::<State>().panel_ready.load(Ordering::Acquire);
    panel_perf::begin(warm);
    *app.state::<State>().panel_monitor.lock().unwrap() = monitor;
    app.state::<DesktopState>()
        .widget_expanded
        .store(true, Ordering::Relaxed);
    if app.get_webview_window("widget").is_some() {
        let h = app.clone();
        let _ = app.run_on_main_thread(move || reveal_panel(&h));
    } else {
        create_panel(app);
    }
}

pub fn toggle_panel(app: &tauri::AppHandle, monitor: String) {
    let expanded = app
        .state::<DesktopState>()
        .widget_expanded
        .load(Ordering::Relaxed);
    let same_monitor = *app.state::<State>().panel_monitor.lock().unwrap() == monitor;
    if expanded && same_monitor {
        app.state::<DesktopState>()
            .widget_expanded
            .store(false, Ordering::Relaxed);
        if let Some(view) = app
            .state::<DesktopState>()
            .widget_views
            .lock()
            .unwrap()
            .get_mut("widget")
        {
            view.expanded = false;
        }
        hide_panel(app);
        emit_state(app);
    } else {
        panel(app, monitor);
    }
}

fn color(value: &str) -> Option<u32> {
    let hex = value.strip_prefix('#')?;
    let n = u32::from_str_radix(hex, 16).ok()?;
    if hex.len() != 6 {
        return None;
    }
    Some(((n >> 16) & 255) | ((n >> 8) & 255) << 8 | (n & 255) << 16)
}
fn light_mode(d: &DiskState) -> bool {
    if d.prefs.widget_theme == "windows" {
        taskbar::system_light()
    } else {
        d.schedule
            .theme
            .get("mode")
            .map(|s| s == "light")
            .unwrap_or(true)
    }
}
fn palette(app: &tauri::AppHandle, d: &DiskState) -> [u32; 5] {
    let light = light_mode(d);
    let mut colors = palette_tokens(app, d, light);
    if light {
        colors[1] = 0x111111;
        colors[2] = 0x333333;
    }
    colors
}
fn palette_tokens(app: &tauri::AppHandle, d: &DiskState, light: bool) -> [u32; 5] {
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
                let selector = selector.rsplit("*/").next().unwrap_or(selector).trim();
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
    if let Some(app) = APP.get() {
        let surface = GetBkColor(dc);
        if native_text::draw(app, dc, value, rect, font, color, surface, flags) {
            return;
        }
    }
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
    let (name, clock, at, previous, ar, colors, style, show_seconds, period, light) = {
        let ds = app.state::<DesktopState>();
        let d = ds.disk.lock().unwrap();
        let now = widget_now_ms();
        let next = d
            .schedule
            .widget_days
            .iter()
            .flat_map(|d| &d.prayers)
            .chain(d.schedule.prayers.iter())
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
            d.prefs.widget_style.clone(),
            d.prefs.widget_show_seconds,
            next.map(|p| p.name.clone()).unwrap_or_default(),
            light_mode(&d),
        )
    };
    let (surface, ink, muted, line, accent) =
        (colors[0], colors[1], colors[2], colors[3], colors[4]);
    // Awqat style: gold before a prayer, red just after it, blinking yellow border until acknowledged.
    let extra = {
        let ds = app.state::<DesktopState>();
        let d = ds.disk.lock().unwrap();
        let now = widget_now_ms();
        let prev = d
            .schedule
            .widget_days
            .iter()
            .flat_map(|d| &d.prayers)
            .filter(|p| p.at <= now)
            .max_by_key(|p| p.at)
            .map(|p| {
                (
                    p.at,
                    if d.schedule.language == "ar" {
                        p.name_ar.clone()
                    } else {
                        p.name.clone()
                    },
                    p.clock.clone(),
                )
            });
        (prev, d.prefs.widget_warning_minutes as i64, d.prefs.widget_blink)
    };
    let awq = style == "awqat";
    let now_w = widget_now_ms();
    let warn_ms = extra.1 * 60_000;
    let entered = awq
        && extra
            .0
            .as_ref()
            .is_some_and(|p| now_w >= p.0 && now_w - p.0 < 15 * 60_000);
    let soon = awq && !entered && at.is_some_and(|t| t > now_w && t - now_w <= warn_ms);
    let state_start = if entered {
        extra.0.as_ref().map_or(0, |p| p.0)
    } else {
        at.unwrap_or(0) - warn_ms
    };
    let acked = ACK.load(std::sync::atomic::Ordering::Relaxed) >= state_start;
    let blink = (soon || entered) && !acked && extra.2;
    BLINKING.store(blink, std::sync::atomic::Ordering::Relaxed);
    let (surface, ink, muted) = if soon {
        (0x6c9eb0, 0x151515, 0x2d2d2d)
    } else if entered {
        (0x5a5ab8, 0xffffff, 0xf2f2f2)
    } else {
        (surface, ink, muted)
    };
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
    SetBkColor(dc, surface);
    fill(dc, rect, surface);
    let scale = view.scale;
    let u = |n: f64| (n * scale).round() as i32;
    let (sky_color, sky_y, horizon, moon) = match period.as_str() {
        "Fajr" => (0x986068, 7., false, true),
        "Sunrise" => (0x9380cf, 18., true, false),
        "Dhuhr" => (0x58bce0, 6., false, false),
        "Asr" => (0x68aece, 11., false, false),
        "Maghrib" => (0x5482e7, 21., true, false),
        _ => (0xa66759, 10., false, true),
    };
    if !awq {
    let sky_x = if ar { w - u(14.) } else { u(7.) };
    let brush = CreateSolidBrush(sky_color);
    let old_brush = SelectObject(dc, brush);
    let pen = CreatePen(PS_SOLID, 1, sky_color);
    let old_pen = SelectObject(dc, pen);
    Ellipse(dc, sky_x, u(sky_y), sky_x + u(7.), u(sky_y + 7.));
    if horizon {
        MoveToEx(dc, sky_x - u(2.), u(sky_y + 6.), ptr::null_mut());
        LineTo(dc, sky_x + u(9.), u(sky_y + 6.));
    }
    SelectObject(dc, old_brush);
    SelectObject(dc, old_pen);
    DeleteObject(brush);
    DeleteObject(pen);
    if moon {
        let brush = CreateSolidBrush(surface);
        let old_brush = SelectObject(dc, brush);
        let pen = CreatePen(PS_SOLID, 1, surface);
        let old_pen = SelectObject(dc, pen);
        Ellipse(
            dc,
            sky_x + u(2.),
            u(sky_y - 1.),
            sky_x + u(9.),
            u(sky_y + 5.),
        );
        SelectObject(dc, old_brush);
        SelectObject(dc, old_pen);
        DeleteObject(brush);
        DeleteObject(pen);
    }
    }
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
                font(if style == "countdown" { 21. } else { 16. }, FW_SEMIBOLD),
            )
        })
    };
    let seconds = at.map(|t| ((t - widget_now_ms()) / 1000).max(0));
    let countdown = seconds
        .map(|s| {
            if show_seconds {
                format!("{:02}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60)
            } else {
                format!("{:02}:{:02}", s / 3600, s / 60 % 60)
            }
        })
        .unwrap_or("—".into());
    if awq {
        let cy = h / 2;
        let (n, c, label, value) = if entered {
            let p = extra.0.as_ref().unwrap();
            let s = ((now_w - p.0) / 1000).max(0);
            (
                p.1.clone(),
                p.2.clone(),
                if ar { "منذ" } else { "Since" },
                if show_seconds {
                    format!("+{:02}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60)
                } else {
                    format!("+{:02}:{:02}", s / 3600, s / 60 % 60)
                },
            )
        } else {
            (
                name.clone(),
                clock.clone(),
                if ar { "بعد" } else { "After" },
                countdown.clone(),
            )
        };
        let split = w * 45 / 100;
        let (a_left, a_right, b_left, b_right) = if ar {
            (w - split, w - u(5.), u(5.), w - split)
        } else {
            (u(5.), split, split, w - u(5.))
        };
        let name_flags = if ar { DT_CENTER | DT_RTLREADING } else { DT_CENTER };
        let line = |left: i32, right: i32, second: bool| RECT {
            left,
            top: if second { cy } else { cy - u(17.) },
            right,
            bottom: if second { cy + u(17.) } else { cy },
        };
        text(dc, &n, line(a_left, a_right, false), fonts.0 as _, ink, name_flags);
        text(dc, &c, line(a_left, a_right, true), fonts.1 as _, ink, DT_CENTER);
        text(dc, label, line(b_left, b_right, false), fonts.1 as _, muted, name_flags);
        text(dc, &value, line(b_left, b_right, true), fonts.0 as _, ink, DT_CENTER);
    } else if style == "slim" || style == "countdown" {
        let cy = h / 2;
        let name_left = if ar { w - u(83.) } else { u(8.) };
        let name_right = if ar { w - u(8.) } else { u(83.) };
        let flags = if ar {
            DT_RIGHT | DT_RTLREADING
        } else {
            DT_LEFT
        };
        if style == "slim" {
            text(
                dc,
                &name,
                RECT {
                    left: name_left,
                    top: cy - u(10.),
                    right: name_right,
                    bottom: cy + u(11.),
                },
                fonts.0 as _,
                ink,
                flags,
            );
            text(
                dc,
                &clock,
                RECT {
                    left: if ar { w - u(132.) } else { u(86.) },
                    top: cy - u(10.),
                    right: if ar { w - u(86.) } else { u(132.) },
                    bottom: cy + u(11.),
                },
                fonts.1 as _,
                muted,
                DT_CENTER,
            );
            text(
                dc,
                &countdown,
                RECT {
                    left: if ar { u(8.) } else { u(136.) },
                    top: cy - u(10.),
                    right: if ar { w - u(136.) } else { w - u(8.) },
                    bottom: cy + u(11.),
                },
                fonts.0 as _,
                ink,
                if ar { DT_LEFT } else { DT_RIGHT },
            );
        } else {
            text(
                dc,
                &name,
                RECT {
                    left: name_left,
                    top: cy - u(17.),
                    right: name_right,
                    bottom: cy,
                },
                fonts.1 as _,
                muted,
                flags,
            );
            text(
                dc,
                &clock,
                RECT {
                    left: name_left,
                    top: cy,
                    right: name_right,
                    bottom: cy + u(17.),
                },
                fonts.1 as _,
                ink,
                flags & !DT_RTLREADING,
            );
            text(
                dc,
                &countdown,
                RECT {
                    left: if ar { u(8.) } else { u(88.) },
                    top: cy - u(15.),
                    right: if ar { w - u(88.) } else { w - u(8.) },
                    bottom: cy + u(17.),
                },
                fonts.2 as _,
                if light { ink } else { accent },
                if ar { DT_LEFT } else { DT_RIGHT },
            );
        }
    } else {
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
            (
                u(93.),
                w - u(if style == "minimal" { 12. } else { 45. }),
                DT_RIGHT | DT_RTLREADING,
            )
        } else {
            (
                u(if style == "minimal" { 12. } else { 45. }),
                w - u(92.),
                DT_LEFT,
            )
        };
        if style == "minimal" {
            fill(
                dc,
                RECT {
                    left: if ar { w - u(40.) } else { 0 },
                    top: 0,
                    right: if ar { w } else { u(40.) },
                    bottom: h,
                },
                surface,
            );
        }
        if style == "ribbon" {
            fill(
                dc,
                RECT {
                    left: if ar { w - u(4.) } else { 0 },
                    top: u(5.),
                    right: if ar { w } else { u(4.) },
                    bottom: h - u(5.),
                },
                accent,
            );
        }
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
            flags & !DT_RTLREADING,
        );
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
            flags & !DT_RTLREADING,
        );
    }
    if let (Some(at), Some(previous)) = (at, previous.filter(|_| !awq)) {
        if at > previous {
            let progress =
                ((widget_now_ms() - previous) as f64 / (at - previous) as f64).clamp(0., 1.);
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
    if blink
        && (std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            / 500)
            % 2
            == 0
    {
        let t = u(3.).max(2);
        let yellow = 0x1fd2ff;
        for r in [
            RECT { left: 0, top: 0, right: w, bottom: t },
            RECT { left: 0, top: h - t, right: w, bottom: h },
            RECT { left: 0, top: 0, right: t, bottom: h },
            RECT { left: w - t, top: 0, right: w, bottom: h },
        ] {
            fill(dc, r, yellow);
        }
    }
    if windows_sys::Win32::UI::Input::KeyboardAndMouse::GetFocus() == hwnd {
        let focus_rect = RECT {
            left: u(3.),
            top: u(3.),
            right: w - u(3.),
            bottom: h - u(3.),
        };
        DrawFocusRect(dc, &focus_rect);
    }
    BitBlt(screen, 0, 0, w, h, dc, 0, 0, SRCCOPY);
    SelectObject(dc, old);
    DeleteObject(bitmap);
    DeleteDC(dc);
    EndPaint(hwnd, &ps);
}
fn show_context_menu(app: &tauri::AppHandle, label: &str, keyboard: bool) {
    let ar = app
        .state::<DesktopState>()
        .disk
        .lock()
        .unwrap()
        .schedule
        .language
        == "ar";
    if let (Some(window), Ok(menu)) = (app.get_window(label), make_menu(app, ar)) {
        let view = app
            .state::<State>()
            .views
            .lock()
            .unwrap()
            .get(label)
            .cloned();
        if let Some(v) = &view {
            let _ = window.set_position(tauri::PhysicalPosition::new(v.bounds.0, v.bounds.1));
        }
        let _ = if keyboard {
            window.popup_menu_at(&menu, tauri::PhysicalPosition::new(8, 8))
        } else {
            window.popup_menu(&menu)
        };
    }
}
unsafe extern "system" fn controller_subclass(
    hwnd: HWND,
    msg: u32,
    wp: WPARAM,
    lp: LPARAM,
    _: usize,
    _: usize,
) -> LRESULT {
    if msg == WM_NCDESTROY {
        if let Some(app) = APP.get() {
            let views: Vec<_> = app
                .state::<State>()
                .views
                .lock()
                .unwrap()
                .values()
                .filter(|v| v.owner == hwnd as isize)
                .map(|v| v.handle)
                .collect();
            for handle in views {
                DestroyWindow(handle as HWND);
            }
        }
        RemoveWindowSubclass(hwnd, Some(controller_subclass), 1);
    }
    DefSubclassProc(hwnd, msg, wp, lp)
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
            WM_GETOBJECT if lp as i32 == -25 => {
                return native_accessibility::get(app, &label, hwnd as isize, wp, lp);
            }
            WM_KEYDOWN | WM_SYSKEYDOWN => match wp as u32 {
                13 | 32 => {
                    let view = app
                        .state::<State>()
                        .views
                        .lock()
                        .unwrap()
                        .get(&label)
                        .cloned();
                    if let Some(v) = view {
                        acknowledge();
                        toggle_panel(app, v.monitor);
                    }
                    return 0;
                }
                93 | 121 => {
                    show_context_menu(app, &label, true);
                    return 0;
                }
                _ => {}
            },
            WM_SETFOCUS | WM_KILLFOCUS => {
                InvalidateRect(hwnd, ptr::null(), 0);
            }
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
                        acknowledge();
                        toggle_panel(app, v.0.monitor);
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
            WM_RBUTTONUP | WM_CONTEXTMENU => {
                show_context_menu(app, &label, msg == WM_CONTEXTMENU && lp == -1);
                return 0;
            }
            WM_NCDESTROY => {
                native_accessibility::disconnect(hwnd as isize);
                drop_fonts(&app.state::<State>(), &label);
                app.state::<State>().views.lock().unwrap().remove(&label);
                RemoveWindowSubclass(hwnd, Some(subclass), 1);
            }
            WM_DPICHANGED | WM_DISPLAYCHANGE | WM_SETTINGCHANGE => {
                widget_watch::LAYOUT_DIRTY.store(true, Ordering::Release);
            }
            _ => {}
        }
    }
    DefSubclassProc(hwnd, msg, wp, lp)
}
