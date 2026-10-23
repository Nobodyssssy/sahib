mod audio;
mod scheduler;
mod taskbar;
mod widget_watch;
use audio::{AudioJob, NativeAudio};
use scheduler::Schedule;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as AutoExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct DesktopPrefs {
    close_to_tray: bool,
    start_minimized: bool,
    widget_visible: bool,
    widget_always_on_top: bool,
    widget_opacity: f64,
    widget_click_through: bool,
    widget_position: Option<(i32, i32)>,
    widget_mode: String,
    widget_theme: String,
    widget_monitor: String,
    widget_offset: i32,
    widget_right_offset: i32,
    widget_edge: String,
    widget_reminders: bool,
    widget_warning_minutes: i32,
    widget_positions: HashMap<String, f64>,
}
impl Default for DesktopPrefs {
    fn default() -> Self {
        Self {
            close_to_tray: true,
            start_minimized: false,
            widget_visible: false,
            widget_always_on_top: true,
            widget_opacity: 0.96,
            widget_click_through: false,
            widget_position: None,
            widget_mode: "floating".into(),
            widget_theme: "app".into(),
            widget_monitor: "primary".into(),
            widget_offset: 210,
            widget_right_offset: 0,
            widget_edge: "left".into(),
            widget_reminders: true,
            widget_warning_minutes: 10,
            widget_positions: HashMap::new(),
        }
    }
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct DiskState {
    prefs: DesktopPrefs,
    schedule: Schedule,
    fired: HashMap<String, i64>,
}
struct DesktopState {
    disk: Mutex<DiskState>,
    file: PathBuf,
    audio: NativeAudio,
    position_dirty: AtomicBool,
    widget_expanded: AtomicBool,
    widget_views: Mutex<HashMap<String, WidgetView>>,
    creating_widgets: AtomicBool,
    widget_diagnostics: Mutex<widget_watch::Diagnostics>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WidgetView {
    expanded: bool,
    height: f64,
    monitor: String,
    scale: f64,
    bounds: Option<(i32, i32, u32, u32)>,
    bar: Option<(i32, i32, i32, i32)>,
    work: (i32, i32, i32, i32),
    effective_mode: String,
    fallback: bool,
    safe_bounds: Option<(i32, i32)>,
    #[serde(skip)]
    drag: Option<(i32, i32)>,
    #[serde(skip)]
    flags: Option<(bool, bool)>,
    #[serde(skip)]
    floating_position: Option<(i32, i32)>,
}
impl Default for WidgetView {
    fn default() -> Self {
        Self {
            expanded: false,
            height: 420.0,
            monitor: String::new(),
            scale: 1.0,
            bounds: None,
            bar: None,
            work: (0, 0, 0, 0),
            effective_mode: "floating".into(),
            fallback: false,
            safe_bounds: None,
            drag: None,
            flags: None,
            floating_position: None,
        }
    }
}
impl DesktopState {
    fn save(&self, disk: &DiskState) -> Result<(), String> {
        let data = serde_json::to_vec(disk).map_err(|e| e.to_string())?;
        let temporary = self.file.with_extension("tmp");
        fs::write(&temporary, data).map_err(|e| e.to_string())?;
        fs::rename(temporary, &self.file).map_err(|e| e.to_string())
    }
}
fn require_main(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("This action is available only in the main window".into())
    }
}
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}
fn emit_state(app: &tauri::AppHandle) {
    let _ = app.emit("sahib:desktop-state", ());
}
fn is_widget(label: &str) -> bool {
    label == "widget" || label.starts_with("widget-")
}
fn build_extra_widget(app: &tauri::AppHandle, label: &str) -> tauri::Result<()> {
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "widget")
        .unwrap()
        .clone();
    config.label = label.into();
    let builder = tauri::WebviewWindowBuilder::from_config(app, &config)?;
    #[cfg(debug_assertions)]
    let builder = if let Some(dir) = std::env::var_os("SAHIB_TEST_DATA_DIR") {
        let builder = builder.data_directory(PathBuf::from(dir).join("webview"));
        if let Ok(port) = std::env::var("SAHIB_TEST_CDP_PORT") {
            builder.additional_browser_args(&format!("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port={port} --enable-logging=stderr"))
        } else {
            builder
        }
    } else {
        builder
    };
    builder
        .on_navigation(|url| url.host_str() == Some("tauri.localhost") || url.scheme() == "tauri")
        .build()?;
    Ok(())
}
// WebView2 creation must run outside synchronous commands / window callbacks.
fn ensure_widget_windows(app: &tauri::AppHandle, p: &DesktopPrefs) {
    if !p.widget_visible {
        return;
    }
    let state = app.state::<DesktopState>();
    if state.creating_widgets.swap(true, Ordering::AcqRel) {
        return;
    }
    if app.get_webview_window("widget").is_none() {
        if build_extra_widget(app, "widget").is_ok() {
            state
                .widget_diagnostics
                .lock()
                .unwrap()
                .operation("recreate-primary");
        }
    }
    let count = app
        .get_webview_window("widget")
        .and_then(|w| w.available_monitors().ok())
        .map(|m| m.len())
        .unwrap_or(1);
    let count = if p.widget_mode == "taskbar" && p.widget_monitor == "all" {
        count
    } else {
        1
    };
    for i in 1..count {
        let label = format!("widget-{i}");
        if app.get_webview_window(&label).is_none() {
            if let Err(error) = build_extra_widget(app, &label) {
                eprintln!("[widget] {error}");
            }
        }
    }
    state.creating_widgets.store(false, Ordering::Release);
}
fn apply_widget(app: &tauri::AppHandle, p: &DesktopPrefs) {
    let Some(primary_window) = app.get_webview_window("widget") else {
        return;
    };
    let monitors = primary_window.available_monitors().unwrap_or_default();
    let primary = primary_window.primary_monitor().ok().flatten();
    let mut selected =
        if p.widget_visible && p.widget_mode == "taskbar" && p.widget_monitor == "all" {
            let mut list = monitors.clone();
            list.sort_by_key(|m| {
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
            list
        } else {
            monitors
                .iter()
                .find(|m| m.name().map(|n| n == &p.widget_monitor).unwrap_or(false))
                .cloned()
                .or(primary)
                .into_iter()
                .collect()
        };
    if selected.is_empty() {
        selected = monitors.into_iter().take(1).collect();
    }
    let labels: Vec<String> = (0..selected.len())
        .map(|i| {
            if i == 0 {
                "widget".into()
            } else {
                format!("widget-{i}")
            }
        })
        .collect();
    let state = app.state::<DesktopState>();
    for (label, w) in app.webview_windows() {
        if is_widget(&label) && !labels.contains(&label) && label != "widget" {
            let _ = w.destroy();
            state.widget_views.lock().unwrap().remove(&label);
        }
    }
    for (i, m) in selected.iter().enumerate() {
        let label = &labels[i];
        let Some(w) = app.get_webview_window(label) else {
            continue;
        };
        let mut view = state
            .widget_views
            .lock()
            .unwrap()
            .entry(label.clone())
            .or_default()
            .clone();
        if label == "widget" {
            view.expanded = state.widget_expanded.load(Ordering::Relaxed);
        }
        let old_presentation = (
            view.monitor.clone(),
            view.scale,
            view.effective_mode.clone(),
        );
        let pos = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        let work = m.work_area();
        let area = (
            work.position.x,
            work.position.y,
            work.position.x + work.size.width as i32,
            work.position.y + work.size.height as i32,
        );
        let monitor = (
            pos.x,
            pos.y,
            pos.x + size.width as i32,
            pos.y + size.height as i32,
        );
        let bar = taskbar::bounds(monitor);
        if p.widget_mode == "taskbar" && bar.is_none() && view.bar.is_some() {
            if w.is_visible().unwrap_or(false) {
                let _ = w.hide();
                state.widget_diagnostics.lock().unwrap().operation("hide");
            }
            if let Ok(handle) = w.hwnd() {
                state.widget_diagnostics.lock().unwrap().record(
                    &state.file,
                    label,
                    "taskbar-rebuilding",
                    widget_watch::observe(handle.0 as isize),
                    &view,
                    "wait-for-shell",
                );
            }
            continue;
        }
        let width = (240.0 * scale).round() as i32;
        let safe = bar.map(|b| taskbar::safe_edges(b, scale));
        let docked = p.widget_mode == "taskbar"
            && safe
                .map(|(left, right, _)| right - left >= width)
                .unwrap_or(false);
        view.monitor = m.name().cloned().unwrap_or_default();
        view.scale = scale;
        view.work = area;
        view.bar = bar;
        view.safe_bounds = safe.map(|(left, right, _)| (left, right));
        view.fallback = p.widget_mode == "taskbar" && !docked;
        view.effective_mode = if docked { "taskbar" } else { "floating" }.into();
        let target = if docked {
            let b = bar.unwrap();
            let (left, right, _) = safe.unwrap();
            let offset = (if p.widget_edge == "right" {
                p.widget_right_offset
            } else {
                p.widget_offset
            } as f64
                * scale)
                .round() as i32;
            let x = match p.widget_edge.as_str() {
                "right" => right - width - offset,
                "manual" => {
                    b.0 + (p
                        .widget_positions
                        .get(&view.monitor)
                        .copied()
                        .unwrap_or(p.widget_offset as f64)
                        * scale)
                        .round() as i32
                }
                _ => b.0 + offset,
            }
            .clamp(left, right - width);
            if view.expanded {
                taskbar::panel_rect(area, bar, x, scale, view.height)
            } else {
                (x, b.1, width as u32, (b.3 - b.1).max(1) as u32)
            }
        } else {
            let requested = taskbar::panel_rect(
                area,
                None,
                area.2 - (390.0 * scale) as i32,
                scale,
                view.height,
            );
            let (x, y) = view
                .floating_position
                .or(p.widget_position)
                .filter(|(x, y)| {
                    *x >= area.0
                        && *y >= area.1
                        && *x + requested.2 as i32 <= area.2
                        && *y + requested.3 as i32 <= area.3
                })
                .unwrap_or((requested.0, requested.1));
            (x, y, requested.2, requested.3)
        };
        view.bounds = Some(target);
        let flags = (
            docked || p.widget_always_on_top,
            !docked && p.widget_click_through,
        );
        if view.flags != Some(flags) {
            let _ = w.set_always_on_top(flags.0);
            let _ = w.set_ignore_cursor_events(flags.1);
            view.flags = Some(flags);
        }
        state
            .widget_views
            .lock()
            .unwrap()
            .insert(label.clone(), view.clone());
        if old_presentation
            != (
                view.monitor.clone(),
                view.scale,
                view.effective_mode.clone(),
            )
        {
            let _ = app.emit_to(label, "sahib:desktop-state", ());
        }
        let fullscreen =
            docked && taskbar::fullscreen(monitor, w.hwnd().map(|h| h.0 as isize).unwrap_or(0));
        let auto_hidden = docked
            && !view.expanded
            && bar
                .map(|b| b.3.min(monitor.3) - b.1.max(monitor.1) < (8.0 * scale) as i32)
                .unwrap_or(false);
        if !p.widget_visible || fullscreen || auto_hidden {
            let reason = if !p.widget_visible {
                "user-hidden"
            } else if fullscreen {
                "fullscreen"
            } else {
                "taskbar-auto-hide"
            };
            if w.is_visible().unwrap_or(false) {
                let _ = w.hide();
                state.widget_diagnostics.lock().unwrap().operation("hide");
            }
            if let Ok(handle) = w.hwnd() {
                state.widget_diagnostics.lock().unwrap().record(
                    &state.file,
                    label,
                    reason,
                    widget_watch::observe(handle.0 as isize),
                    &view,
                    "suppressed",
                );
            }
            continue;
        }
        let size = tauri::PhysicalSize::new(target.2, target.3);
        if w.inner_size().ok() != Some(size) {
            let _ = w.set_size(size);
            state.widget_diagnostics.lock().unwrap().operation("resize");
        }
        let pos = tauri::PhysicalPosition::new(target.0, target.1);
        if w.outer_position().ok() != Some(pos) {
            let _ = w.set_position(pos);
            state.widget_diagnostics.lock().unwrap().operation("move");
        }
        if !w.is_visible().unwrap_or(false) {
            let _ = w.show();
            state.widget_diagnostics.lock().unwrap().operation("show");
        }
        if let Ok(handle) = w.hwnd() {
            let handle = handle.0 as isize;
            let observation = widget_watch::observe(handle);
            let reason = if observation.cloaked != 0 {
                "virtual-desktop-cloaked"
            } else if observation.covered_by_taskbar {
                "taskbar-covered"
            } else if flags.0 && !observation.topmost {
                "topmost-lost"
            } else {
                "normal"
            };
            let repair = flags.0
                && observation.valid
                && observation.visible
                && observation.cloaked == 0
                && (observation.covered_by_taskbar || !observation.topmost);
            state.widget_diagnostics.lock().unwrap().record(
                &state.file,
                label,
                reason,
                observation,
                &view,
                if repair { "repair-order" } else { "observe" },
            );
            if repair {
                let success = widget_watch::recover_order(handle);
                let mut diagnostics = state.widget_diagnostics.lock().unwrap();
                diagnostics.operation(if success { "raise" } else { "raise-failed" });
                diagnostics.record(
                    &state.file,
                    label,
                    "after-repair",
                    widget_watch::observe(handle),
                    &view,
                    if success { "no-activate" } else { "failed" },
                );
            }
        }
    }
}

fn position_widget(app: &tauri::AppHandle, p: &DesktopPrefs) {
    if let Some(w) = app.get_webview_window("widget") {
        let monitors = w.available_monitors().unwrap_or_default();
        let valid = p.widget_position.filter(|(x, y)| {
            monitors.iter().any(|m| {
                let pos = m.position();
                let size = m.size();
                *x >= pos.x
                    && *y >= pos.y
                    && *x + 160 < pos.x + size.width as i32
                    && *y + 80 < pos.y + size.height as i32
            })
        });
        if let Some((x, y)) = valid {
            let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
        } else if let Ok(Some(m)) = w.primary_monitor() {
            let scale = m.scale_factor();
            let pos = m.position();
            let size = m.size();
            let _ = w.set_position(tauri::PhysicalPosition::new(
                pos.x + size.width as i32 - (380.0 * scale) as i32,
                pos.y + (50.0 * scale) as i32,
            ));
        }
    }
}
fn make_menu(app: &tauri::AppHandle, ar: bool) -> tauri::Result<Menu<tauri::Wry>> {
    let text = |en, arabic| if ar { arabic } else { en };
    let show = MenuItem::with_id(
        app,
        "show",
        text("Open Sahib", "فتح صاحب"),
        true,
        None::<&str>,
    )?;
    let widget = MenuItem::with_id(
        app,
        "widget",
        text("Show / hide prayer widget", "إظهار / إخفاء أداة الصلاة"),
        true,
        None::<&str>,
    )?;
    let unlock = MenuItem::with_id(
        app,
        "unlock",
        text("Restore widget clicks", "إعادة تفاعل الأداة"),
        true,
        None::<&str>,
    )?;
    let stop = MenuItem::with_id(
        app,
        "stop",
        text("Stop audio", "إيقاف الصوت"),
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(
        app,
        "quit",
        text("Quit Sahib", "إنهاء صاحب"),
        true,
        None::<&str>,
    )?;
    Menu::with_items(app, &[&show, &widget, &unlock, &stop, &quit])
}
fn play(app: &tauri::AppHandle, id: &str, volume: f32) -> Result<(), String> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err("Invalid volume".into());
    }
    let state = app.state::<DesktopState>();
    let job = match id {
        "off" => return Ok(()),
        "chime" => AudioJob::Chime(volume),
        "local-standard" | "local-fajr" => {
            let name = if id == "local-fajr" {
                "fajr.bin"
            } else {
                "standard.bin"
            };
            let file = state.file.parent().unwrap().join("audio").join(name);
            let bytes = fs::read(file)
                .map_err(|_| "Import the local recording again in Alerts".to_string())?;
            AudioJob::Play(bytes, volume)
        }
        _ => {
            let file = audio::recording_path(id).ok_or("Unknown recording")?;
            let asset = app
                .asset_resolver()
                .get(file.into())
                .ok_or("Bundled recording unavailable")?;
            AudioJob::Play(asset.bytes, volume)
        }
    };
    state.audio.sender.send(job).map_err(|e| e.to_string())
}
#[tauri::command]
fn desktop_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let state = app.state::<DesktopState>();
    let d = state.disk.lock().map_err(|e| e.to_string())?.clone();
    let widget_bounds = app.get_webview_window("widget").and_then(|w| {
        let pos = w.outer_position().ok()?;
        let size = w.inner_size().ok()?;
        Some((pos.x, pos.y, size.width, size.height))
    });
    let taskbar_bounds = taskbar::bounds((i32::MIN, i32::MIN, i32::MAX, i32::MAX));
    let diagnostic_snapshot =
        serde_json::to_value(&*state.widget_diagnostics.lock().unwrap()).unwrap();
    let view_snapshot = state.widget_views.lock().unwrap().clone();
    let widget_windows:Vec<_>=app.webview_windows().into_iter().filter(|(label,_)|is_widget(label)).map(|(label,w)|serde_json::json!({"label":label,"visible":w.is_visible().unwrap_or(false),"position":w.outer_position().ok(),"size":w.inner_size().ok(),"scale":w.scale_factor().ok()})).collect();
    Ok(
        serde_json::json!({"widgetDiagnostics":diagnostic_snapshot,"widgetLogPath":state.file.parent().unwrap().join("widget-diagnostics.jsonl"),"widgetWindows":widget_windows,"widgetViews":view_snapshot,"widgetBounds":widget_bounds,"taskbarBounds":taskbar_bounds,"prefs":d.prefs,"schedule":d.schedule,"now":now_ms(),"autostart":app.autolaunch().is_enabled().unwrap_or(false),"audioPlaying":state.audio.active.load(Ordering::Relaxed),"audioError":*state.audio.error.lock().unwrap(),"notificationPermission":app.notification().permission_state().ok(),"widgetExpanded":state.widget_expanded.load(Ordering::Relaxed),"systemLight":taskbar::system_light(),"monitors":app.get_webview_window("widget").and_then(|w| w.available_monitors().ok()).unwrap_or_default().iter().filter_map(|m|m.name().cloned()).collect::<Vec<_>>()}),
    )
}
#[tauri::command]
fn desktop_sync_schedule(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    schedule: Schedule,
) -> Result<(), String> {
    require_main(&window)?;
    scheduler::validate(&schedule, now_ms())?;
    let state = app.state::<DesktopState>();
    let mut d = state.disk.lock().map_err(|e| e.to_string())?;
    let language_changed = d.schedule.language != schedule.language;
    let ar = schedule.language == "ar";
    d.schedule = schedule;
    state.save(&d)?;
    drop(d);
    if language_changed {
        if let Some(tray) = app.tray_by_id("sahib") {
            if let Ok(menu) = make_menu(&app, ar) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    }
    emit_state(&app);
    Ok(())
}
#[tauri::command]
async fn desktop_set_preferences(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    mut prefs: DesktopPrefs,
    autostart: Option<bool>,
) -> Result<(), String> {
    require_main(&window)?;
    if !prefs.widget_opacity.is_finite() {
        return Err("Invalid opacity".into());
    }
    prefs.widget_opacity = prefs.widget_opacity.clamp(0.5, 1.0);
    if !["floating", "taskbar"].contains(&prefs.widget_mode.as_str())
        || ![
            "app",
            "windows",
            "sahib",
            "aura",
            "dracula",
            "catppuccin",
            "rose-pine",
            "tokyo-night",
        ]
        .contains(&prefs.widget_theme.as_str())
        || !["left", "right", "manual"].contains(&prefs.widget_edge.as_str())
        || prefs.widget_monitor.len() > 200
    {
        return Err("Invalid widget preferences".into());
    }
    prefs.widget_offset = prefs.widget_offset.clamp(0, 4000);
    prefs.widget_right_offset = prefs.widget_right_offset.clamp(0, 4000);
    if prefs.widget_positions.len() > 16
        || prefs
            .widget_positions
            .iter()
            .any(|(name, x)| name.len() > 200 || !x.is_finite() || *x < 0.0 || *x > 100000.0)
    {
        return Err("Invalid widget positions".into());
    }
    prefs.widget_warning_minutes = prefs.widget_warning_minutes.clamp(1, 60);
    if let Some(on) = autostart {
        if on {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        }
        .map_err(|e| e.to_string())?;
    }
    let state = app.state::<DesktopState>();
    let mut d = state.disk.lock().map_err(|e| e.to_string())?;
    let mode_changed = d.prefs.widget_mode != prefs.widget_mode;
    d.prefs = prefs.clone();
    state.save(&d)?;
    drop(d);
    if mode_changed {
        state.widget_expanded.store(false, Ordering::Relaxed);
        if prefs.widget_mode == "floating" {
            position_widget(&app, &prefs);
        }
    }
    ensure_widget_windows(&app, &prefs);
    apply_widget(&app, &prefs);
    emit_state(&app);
    Ok(())
}
#[tauri::command]
fn desktop_widget_state(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    if !is_widget(window.label()) {
        return Err("Widget only".into());
    }
    let state = app.state::<DesktopState>();
    let now = now_ms();
    let d = state.disk.lock().map_err(|e| e.to_string())?;
    let mut prayers: Vec<_> = d.schedule.prayers.iter().filter(|p| p.at > now).collect();
    prayers.sort_by_key(|p| p.at);
    prayers.truncate(2);
    let days: Vec<_> = d
        .schedule
        .widget_days
        .iter()
        .filter(|d| d.end > now && d.start < now + 2 * 86400000)
        .take(2)
        .collect();
    let mut value = serde_json::json!({"prefs":d.prefs,"schedule":{"prayers":prayers,"widgetDays":days,"language":d.schedule.language,"theme":d.schedule.theme,"location":d.schedule.location,"validUntil":d.schedule.valid_until},"audioPlaying":state.audio.active.load(Ordering::Relaxed)});
    drop(d);
    let mut view = state
        .widget_views
        .lock()
        .unwrap()
        .get(window.label())
        .cloned()
        .unwrap_or_default();
    if window.label() == "widget" {
        view.expanded = state.widget_expanded.load(Ordering::Relaxed)
    }
    value["widgetExpanded"] = view.expanded.into();
    value["view"] = serde_json::to_value(view).unwrap();
    value["systemLight"] = taskbar::system_light().into();
    Ok(value)
}
#[tauri::command]
fn desktop_widget_size(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    height: f64,
) -> Result<(), String> {
    if !is_widget(window.label()) || !height.is_finite() {
        return Err("Invalid widget size".into());
    }
    let state = app.state::<DesktopState>();
    let mut views = state.widget_views.lock().unwrap();
    let view = views.entry(window.label().into()).or_default();
    let height = height.clamp(140.0, 900.0);
    if (view.height - height).abs() < 2.0 {
        return Ok(());
    }
    view.height = height;
    drop(views);
    let p = state.disk.lock().unwrap().prefs.clone();
    apply_widget(&app, &p);
    Ok(())
}
#[tauri::command]
fn desktop_widget_drag(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    phase: String,
) -> Result<(), String> {
    if !is_widget(window.label()) {
        return Err("Widget only".into());
    }
    let state = app.state::<DesktopState>();
    let mut views = state.widget_views.lock().unwrap();
    let view = views.get_mut(window.label()).ok_or("Widget not ready")?;
    if view.effective_mode != "taskbar" || view.expanded {
        return Err("Drag the compact taskbar widget".into());
    }
    let bounds = view.bounds.ok_or("No widget bounds")?;
    if phase == "cancel" {
        view.drag = None;
        return Ok(());
    }
    if phase == "start" {
        view.drag = Some((taskbar::cursor_x(), bounds.0));
        return Ok(());
    }
    let (cursor, start) = view.drag.ok_or("Drag not started")?;
    let left = view.bar.ok_or("Taskbar unavailable")?.0;
    let offset = (start + taskbar::cursor_x() - cursor - left) as f64 / view.scale;
    let monitor = view.monitor.clone();
    if phase == "end" {
        view.drag = None;
    }
    let snapshots = views.clone();
    drop(views);
    let mut disk = state.disk.lock().unwrap();
    if disk.prefs.widget_edge != "manual" {
        for v in snapshots.values() {
            if let (Some(b), Some(pos)) = (v.bar, v.bounds) {
                disk.prefs
                    .widget_positions
                    .insert(v.monitor.clone(), (pos.0 - b.0) as f64 / v.scale);
            }
        }
    }
    disk.prefs.widget_edge = "manual".into();
    disk.prefs.widget_positions.insert(monitor, offset.max(0.0));
    let prefs = disk.prefs.clone();
    if phase == "end" {
        state.save(&disk)?;
    }
    drop(disk);
    apply_widget(&app, &prefs);
    if phase == "end" {
        emit_state(&app)
    }
    Ok(())
}
#[tauri::command]
fn desktop_widget_action(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    action: String,
) -> Result<(), String> {
    if !is_widget(window.label()) && window.label() != "main" {
        return Err("Local widget only".into());
    }
    let label = if window.label() == "main" {
        "widget"
    } else {
        window.label()
    };
    let state = app.state::<DesktopState>();
    let mut views = state.widget_views.lock().unwrap();
    let view = views.entry(label.into()).or_default();
    match action.as_str() {
        "toggle" => view.expanded = !view.expanded,
        "collapse" => view.expanded = false,
        "settings" | "practice" | "timetable" => view.expanded = false,
        "refresh" => {}
        _ => return Err("Unknown widget action".into()),
    }
    let expanded = view.expanded;
    if label == "widget" {
        state.widget_expanded.store(expanded, Ordering::Relaxed)
    }
    drop(views);
    if action == "settings" || action == "practice" || action == "timetable" {
        show_main(&app);
        let _ = app.emit_to("main", "sahib:widget-open", &action);
    }
    if action == "refresh" {
        let _ = app.emit_to("main", "sahib:refresh-schedule", ());
    }
    let prefs = state.disk.lock().unwrap().prefs.clone();
    apply_widget(&app, &prefs);
    if action == "toggle" && expanded {
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.set_focus();
        }
    }
    emit_state(&app);
    Ok(())
}

#[tauri::command]
fn desktop_show_main(app: tauri::AppHandle) {
    show_main(&app)
}
#[tauri::command]
fn desktop_hide_widget(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<DesktopState>();
    let mut d = state.disk.lock().map_err(|e| e.to_string())?;
    d.prefs.widget_visible = false;
    state.save(&d)?;
    let p = d.prefs.clone();
    drop(d);
    apply_widget(&app, &p);
    emit_state(&app);
    Ok(())
}
#[tauri::command]
fn desktop_stop_audio(app: tauri::AppHandle) {
    let _ = app
        .state::<DesktopState>()
        .audio
        .sender
        .send(AudioJob::Stop);
}

#[tauri::command]
fn desktop_remove_audio(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    kind: String,
) -> Result<(), String> {
    require_main(&window)?;
    let name = match kind.as_str() {
        "standard" => "standard.bin",
        "fajr" => "fajr.bin",
        _ => return Err("Invalid audio slot".into()),
    };
    let state = app.state::<DesktopState>();
    let file = state.file.parent().unwrap().join("audio").join(name);
    match fs::remove_file(file) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command]
fn desktop_test_notification(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<(), String> {
    require_main(&window)?;
    app.notification()
        .builder()
        .title("Sahib · صاحب")
        .body("Prayer notifications are ready · تنبيهات الصلاة جاهزة")
        .show()
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn desktop_preview_audio(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    id: String,
    volume: f32,
) -> Result<(), String> {
    require_main(&window)?;
    play(&app, &id, volume)
}
#[tauri::command]
fn desktop_save_audio(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    kind: String,
    encoded: String,
) -> Result<(), String> {
    use base64::Engine;
    require_main(&window)?;
    let name = match kind.as_str() {
        "standard" => "standard.bin",
        "fajr" => "fajr.bin",
        _ => return Err("Invalid audio slot".into()),
    };
    if encoded.len() > 28 * 1024 * 1024 {
        return Err("Audio exceeds 20 MB".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|_| "Invalid audio encoding")?;
    if bytes.len() > 20 * 1024 * 1024 {
        return Err("Audio exceeds 20 MB".into());
    }
    let _ = rodio::Decoder::try_from(std::io::Cursor::new(bytes.clone()))
        .map_err(|_| "Unsupported audio recording")?;
    let state = app.state::<DesktopState>();
    let dir = state.file.parent().unwrap().join("audio");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join(name), bytes).map_err(|e| e.to_string())
}
#[tauri::command]
fn desktop_open_url(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    url: String,
) -> Result<(), String> {
    require_main(&window)?;
    let parsed = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
    if !["https", "http"].contains(&parsed.scheme()) || parsed.host_str().is_none() {
        return Err("Only web links can open externally".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

fn start_scheduler(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut refresh_at = 0;
        let mut zone = scheduler::zone_signature();
        let mut zone_at = 0;
        let mut clock_tick = Instant::now();
        let mut wall = now_ms();
        let mut last_tooltip = None;
        loop {
            let now = now_ms();
            let drift = (now - wall - clock_tick.elapsed().as_millis() as i64).abs();
            wall = now;
            clock_tick = Instant::now();
            if now >= zone_at || drift > 120000 {
                let next = scheduler::zone_signature();
                if next != zone || drift > 120000 {
                    let _ = app.emit_to("main", "sahib:clock-changed", ());
                }
                zone = next;
                zone_at = now + 60000;
            }
            let state = app.state::<DesktopState>();
            let (due, tooltip) = {
                let Ok(mut d) = state.disk.lock() else { break };
                let DiskState {
                    schedule, fired, ..
                } = &mut *d;
                let due = scheduler::take_due(schedule, fired, now);
                if !due.is_empty() || state.position_dirty.swap(false, Ordering::Relaxed) {
                    if let Err(e) = state.save(&d) {
                        eprintln!("[desktop] State save failed: {e}");
                    }
                }
                let tooltip = d
                    .schedule
                    .prayers
                    .iter()
                    .filter(|p| p.at > now)
                    .min_by_key(|p| p.at)
                    .map(|next| {
                        let name = if d.schedule.language == "ar" {
                            &next.name_ar
                        } else {
                            &next.name
                        };
                        let mins = (next.at - now) / 60000;
                        format!(
                            "Sahib · {name} · {} · {}h {}m",
                            next.clock,
                            mins / 60,
                            mins % 60
                        )
                    });
                (due, tooltip)
            };
            // Window/tray APIs dispatch to the UI thread. Never hold the data
            // mutex here: a window event on that thread can also need the data.
            if tooltip != last_tooltip {
                if let Some(tray) = app.tray_by_id("sahib") {
                    let _ = tray.set_tooltip(tooltip.as_deref());
                }
                last_tooltip = tooltip;
            }
            for event in due {
                if event.notify {
                    if let Err(e) = app
                        .notification()
                        .builder()
                        .title(&event.title)
                        .body(&event.body)
                        .show()
                    {
                        eprintln!("[notification] {e}");
                    }
                }
                if let Err(e) = play(&app, &event.sound, event.volume) {
                    eprintln!("[audio] {e}");
                    let _ = app.emit("sahib:desktop-error", e);
                }
                let _ = app.emit("sahib:desktop-alert", &event);
            }
            if now >= refresh_at {
                let _ = app.emit_to("main", "sahib:refresh-schedule", ());
                refresh_at = now + 6 * 60 * 60 * 1000;
            }
            let wait = {
                let d = state.disk.lock().unwrap();
                d.schedule
                    .alerts
                    .iter()
                    .filter(|e| e.at > now)
                    .map(|e| (e.at - now) as u64)
                    .min()
                    .unwrap_or(1000)
                    .clamp(100, 1000)
            };
            std::thread::sleep(Duration::from_millis(wait));
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            desktop_state,
            desktop_sync_schedule,
            desktop_set_preferences,
            desktop_show_main,
            desktop_hide_widget,
            desktop_stop_audio,
            desktop_test_notification,
            desktop_preview_audio,
            desktop_save_audio,
            desktop_remove_audio,
            desktop_open_url
            ,desktop_widget_action,desktop_widget_state,desktop_widget_size,desktop_widget_drag
        ])
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            #[cfg(debug_assertions)]
            let dir = std::env::var_os("SAHIB_TEST_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or(dir);
            fs::create_dir_all(&dir)?;
            let file = dir.join("desktop-state.json");
            let disk: DiskState = fs::read(&file)
                .ok()
                .and_then(|b| serde_json::from_slice(&b).ok())
                .unwrap_or_default();
            let prefs = disk.prefs.clone();
            let ar = disk.schedule.language == "ar";
            let audio_app=app.handle().clone();
            app.manage(DesktopState {
                disk: Mutex::new(disk),
                file,
                audio: NativeAudio::start(move || emit_state(&audio_app)),
                position_dirty: AtomicBool::new(false),
                widget_expanded: AtomicBool::new(false),
                widget_views: Mutex::new(HashMap::new()),
                creating_widgets: AtomicBool::new(false),
                widget_diagnostics: Mutex::new(widget_watch::Diagnostics::default()),
            });
            for config in &app.config().app.windows {
                let h = app.handle().clone();
                let builder = tauri::WebviewWindowBuilder::from_config(app, config)?;
                #[cfg(debug_assertions)]
                let builder = if let Some(test_dir) = std::env::var_os("SAHIB_TEST_DATA_DIR") {
                    let builder = builder.data_directory(PathBuf::from(test_dir).join("webview"));
                    // Elevated CI hosts ignore WebView2's environment overrides. Pass the
                    // isolated QA port through the API; this code is absent in release builds.
                    if let Some(port) = std::env::var("SAHIB_TEST_CDP_PORT")
                        .ok()
                        .and_then(|value| value.parse::<u16>().ok())
                        .filter(|port| *port > 0)
                    {
                        builder.additional_browser_args(&format!(
                            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port={port} --enable-logging=stderr"
                        ))
                    } else {
                        builder
                    }
                } else {
                    builder
                };
                builder
                    .on_navigation(move |url| {
                        if url.host_str() == Some("tauri.localhost") || url.scheme() == "tauri" {
                            true
                        } else {
                            if ["http", "https"].contains(&url.scheme()) {
                                let _ = h.opener().open_url(url.to_string(), None::<&str>);
                            }
                            false
                        }
                    })
                    .build()?;
            }
            let menu = make_menu(app.handle(), ar)?;
            TrayIconBuilder::with_id("sahib")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Sahib")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    "stop" => desktop_stop_audio(app.clone()),
                    "widget" | "unlock" => {
                        let state = app.state::<DesktopState>();
                        let mut d = state.disk.lock().unwrap();
                        if event.id.as_ref() == "unlock" {
                            d.prefs.widget_click_through = false;
                            d.prefs.widget_visible = true;
                        } else {
                            d.prefs.widget_visible = !d.prefs.widget_visible;
                        }
                        let p = d.prefs.clone();
                        let _ = state.save(&d);
                        drop(d);
                        apply_widget(app, &p);
                        emit_state(app);
                    }
                    _ => {}
                })
                .build(app)?;
            position_widget(app.handle(), &prefs);
            apply_widget(app.handle(), &prefs);
            if !prefs.start_minimized {
                show_main(app.handle());
            }
            start_scheduler(app.handle().clone());
            let handle=app.handle().clone();
            let widget_events=widget_watch::start();
            std::thread::spawn(move || loop {
                let _=widget_events.recv_timeout(Duration::from_secs(10));
                std::thread::sleep(Duration::from_millis(120));
                while widget_events.try_recv().is_ok() {}
                let prefs=handle.state::<DesktopState>().disk.lock().unwrap().prefs.clone();
                ensure_widget_windows(&handle,&prefs);
                let h=handle.clone();
                let _=handle.run_on_main_thread(move || {
                    let state=h.state::<DesktopState>();
                    let prefs=state.disk.lock().unwrap().prefs.clone();
                    if prefs.widget_visible {apply_widget(&h,&prefs);}
                });
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<DesktopState>();
                let mut d = state.disk.lock().unwrap();
                if is_widget(window.label()) {
                    api.prevent_close();
                    d.prefs.widget_visible = false;
                    let _ = state.save(&d);
                    let _ = window.hide();
                } else if d.prefs.close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    drop(d);
                    app.exit(0);
                }
            } else if let WindowEvent::Focused(false) = event {
                if is_widget(window.label()) {
                    let state=window.state::<DesktopState>();
                    let expanded={let mut views=state.widget_views.lock().unwrap();let view=views.entry(window.label().into()).or_default();let old=view.expanded;view.expanded=false;old};
                    if window.label()=="widget"{state.widget_expanded.store(false,Ordering::Relaxed);}
                    let prefs=state.disk.lock().unwrap().prefs.clone();
                    if prefs.widget_mode=="taskbar"&&expanded{apply_widget(window.app_handle(),&prefs);emit_state(window.app_handle());}
                }
            } else if let WindowEvent::Moved(position) = event {
                if is_widget(window.label()) {
                    let state = window.state::<DesktopState>();
                    let floating = {
                        let mut views=state.widget_views.lock().unwrap();
                        let view=views.entry(window.label().into()).or_default();
                        if view.effective_mode=="floating" {view.floating_position=Some((position.x,position.y));true} else {false}
                    };
                    if let Ok(mut d) = state.disk.lock() {
                        if window.label()=="widget" && (d.prefs.widget_mode=="floating" || floating) {
                            d.prefs.widget_position = Some((position.x, position.y));
                            state.position_dirty.store(true, Ordering::Relaxed);
                        }
                    };
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Could not start Sahib")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<DesktopState>();
                if let Ok(d) = state.disk.lock() {
                    let _ = state.save(&d);
                };
            }
        });
}
