//! Native compact UI: a Tauri HWND with GDI surfaces and DirectWrite text.
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
    if let Some(w) = app.get_window("native-widget") {
        let _ = w.set_focus();
    }
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
                .title(if cfg!(feature = "brand-preview") {
                    "Sahib RC · Prayer companion"
                } else {
                    "Sahib · Prayer companion"
                })
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
    if p.widget_visible && active(app) {
        preload_panel(app);
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
            bounds = taskbar::shell_safe_position(bounds, area, scale);
        }
        let rebuilding = bar.is_none()
            && old.as_ref().and_then(|v| v.bar).is_some()
            && taskbar::vertical_bounds(monitor).is_none();
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
            let _ = w.set_always_on_top(flags.0);
            let _ = w.set_ignore_cursor_events(flags.1);
            unsafe {
                let style = GetWindowLongPtrW(handle as HWND, GWL_EXSTYLE);
                SetWindowLongPtrW(handle as HWND, GWL_EXSTYLE, style | WS_EX_LAYERED as isize);
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
            if w.is_visible().unwrap_or(false) {
                let _ = w.hide();
            }
        } else {
            let position = tauri::PhysicalPosition::new(bounds.0, bounds.1);
            let size = tauri::PhysicalSize::new(bounds.2, bounds.3);
            let size_changed = w.inner_size().ok() != Some(size);
            if size_changed {
                let _ = w.set_size(size);
            }
            let corner = (if p.widget_style == "minimal" { 1. } else { 14. } * scale) as i32;
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
                && flags.0
                && (observed.covered_by_taskbar || !observed.topmost)
            {
                let success = widget_watch::recover_order(handle);
                if shell_active && widget_watch::observe(handle).covered_by_taskbar {
                    bounds = taskbar::shell_safe_position(bounds, area, scale);
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
    for view in app.state::<State>().views.lock().unwrap().values() {
        if view.visible {
            unsafe {
                InvalidateRect(view.handle as HWND, ptr::null(), 0);
            }
        }
    }
}
const PANEL_IDLE: Duration = Duration::from_secs(60);
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
    if app
        .get_webview_window("main")
        .is_some_and(|m| m.is_visible().unwrap_or(false))
    {
        *state.panel_hidden.lock().unwrap() = None;
        return;
    }
    let expired = {
        let mut hidden = state.panel_hidden.lock().unwrap();
        hidden.get_or_insert_with(Instant::now).elapsed() >= panel_idle(app)
    };
    if expired {
        let _ = w.destroy();
        state.panel_ready.store(false, Ordering::Release);
        state.panel_suspended.store(false, Ordering::Release);
        *state.panel_hidden.lock().unwrap() = None;
    }
}
pub fn preload_panel(app: &tauri::AppHandle) {
    if app.get_webview_window("widget").is_some()
        || !app
            .get_webview_window("main")
            .is_some_and(|w| w.is_visible().unwrap_or(false))
    {
        return;
    }
    create_panel(app, true);
}
fn reveal_panel(app: &tauri::AppHandle) {
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
fn create_panel(app: &tauri::AppHandle, preload: bool) {
    let state = app.state::<State>();
    if state.panel_creating.swap(true, Ordering::AcqRel) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        if preload {
            for _ in 0..30 {
                if app
                    .state::<DesktopState>()
                    .widget_expanded
                    .load(Ordering::Relaxed)
                {
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
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
        if preload
            && !app
                .state::<DesktopState>()
                .widget_expanded
                .load(Ordering::Relaxed)
            && !app
                .get_webview_window("main")
                .is_some_and(|w| w.is_visible().unwrap_or(false))
        {
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
        create_panel(app, false);
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
    if let Some(app) = APP.get() {
        let d = app.state::<DesktopState>();
        let surface = {
            let disk = d.disk.lock().unwrap();
            palette(app, &disk)[0]
        };
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
    let (name, clock, at, previous, ar, colors, style, show_seconds) = {
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
            d.prefs.widget_style.clone(),
            d.prefs.widget_show_seconds,
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
                font(if style == "countdown" { 21. } else { 16. }, FW_SEMIBOLD),
            )
        })
    };
    let seconds = at.map(|t| ((t - now_ms()) / 1000).max(0));
    let countdown = seconds
        .map(|s| {
            if show_seconds {
                format!("{:02}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60)
            } else {
                format!("{:02}:{:02}", s / 3600, s / 60 % 60)
            }
        })
        .unwrap_or("—".into());
    if style == "slim" || style == "countdown" {
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
                accent,
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
            WM_KEYDOWN => match wp as u32 {
                13 | 32 => {
                    if let Some(v) = app
                        .state::<State>()
                        .views
                        .lock()
                        .unwrap()
                        .get(&label)
                        .cloned()
                    {
                        panel(app, v.monitor);
                    }
                    return 0;
                }
                121 => {
                    experiment::open_main(app, true, Some("settings"));
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
                native_accessibility::disconnect(hwnd as isize);
                drop_fonts(&app.state::<State>(), &label);
                app.state::<State>().views.lock().unwrap().remove(&label);
                RemoveWindowSubclass(hwnd, Some(subclass), 1);
            }
            _ => {}
        }
    }
    DefSubclassProc(hwnd, msg, wp, lp)
}
