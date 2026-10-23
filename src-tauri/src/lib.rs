mod audio;
mod scheduler;
mod taskbar;
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
    time::{Duration, SystemTime, UNIX_EPOCH},
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
    widget_edge: String,
    widget_reminders: bool,
    widget_warning_minutes: i32,
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
            widget_edge: "left".into(),
            widget_reminders: true,
            widget_warning_minutes: 10,
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
fn apply_widget(app: &tauri::AppHandle, p: &DesktopPrefs) {
    if let Some(w) = app.get_webview_window("widget") {
        let docked = p.widget_mode == "taskbar";
        let expanded = app
            .state::<DesktopState>()
            .widget_expanded
            .load(Ordering::Relaxed);
        let _ = w.set_always_on_top(docked || p.widget_always_on_top);
        let _ = w.set_ignore_cursor_events(!docked && p.widget_click_through);
        if docked {
            let monitors = w.available_monitors().unwrap_or_default();
            let chosen = monitors
                .iter()
                .find(|m| m.name().map(|n| n == &p.widget_monitor).unwrap_or(false))
                .cloned()
                .or_else(|| w.primary_monitor().ok().flatten());
            if let Some(m) = chosen {
                let pos = m.position();
                let size = m.size();
                let scale = m.scale_factor();
                if taskbar::fullscreen(
                    (
                        pos.x,
                        pos.y,
                        pos.x + size.width as i32,
                        pos.y + size.height as i32,
                    ),
                    w.hwnd().map(|h| h.0 as isize).unwrap_or(0),
                ) {
                    let _ = w.hide();
                    return;
                }
                if let Some((left, top, right, bottom)) = taskbar::bounds((
                    pos.x,
                    pos.y,
                    pos.x + size.width as i32,
                    pos.y + size.height as i32,
                )) {
                    // Auto-hidden taskbars stay hidden. The overlay returns when the bar opens.
                    if !expanded
                        && bottom.min(pos.y + size.height as i32) - top.max(pos.y)
                            < (12.0 * scale) as i32
                    {
                        let _ = w.hide();
                        return;
                    }
                    let width = ((if expanded { 380.0 } else { 260.0 }) * scale) as i32;
                    let height = if expanded {
                        (550.0 * scale) as i32
                    } else {
                        bottom - top
                    };
                    let offset = (p.widget_offset as f64 * scale) as i32;
                    let x = (if p.widget_edge == "right" {
                        right - width - offset
                    } else {
                        left + offset
                    })
                    .clamp(left, (right - width).max(left));
                    let y = if expanded {
                        (top - height - 8).max(pos.y)
                    } else {
                        top
                    };
                    let target_size =
                        tauri::PhysicalSize::new(width.max(1) as u32, height.max(1) as u32);
                    if w.inner_size().ok() != Some(target_size) {
                        let _ = w.set_size(target_size);
                    }
                    let target = tauri::PhysicalPosition::new(x, y);
                    if w.outer_position().ok() != Some(target) {
                        let _ = w.set_position(target);
                    }
                }
            }
        } else {
            let _ = w.set_size(tauri::LogicalSize::new(
                380.0,
                if expanded { 550.0 } else { 350.0 },
            ));
        }
        if p.widget_visible {
            if !w.is_visible().unwrap_or(false) {
                let _ = w.show();
            }
        } else {
            let _ = w.hide();
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
    Ok(
        serde_json::json!({"widgetBounds":widget_bounds,"taskbarBounds":taskbar_bounds,"prefs":d.prefs,"schedule":d.schedule,"now":now_ms(),"autostart":app.autolaunch().is_enabled().unwrap_or(false),"audioPlaying":state.audio.active.load(Ordering::Relaxed),"audioError":*state.audio.error.lock().unwrap(),"notificationPermission":app.notification().permission_state().ok(),"widgetExpanded":state.widget_expanded.load(Ordering::Relaxed),"systemLight":taskbar::system_light(),"monitors":app.get_webview_window("widget").and_then(|w| w.available_monitors().ok()).unwrap_or_default().iter().filter_map(|m|m.name().cloned()).collect::<Vec<_>>()}),
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
fn desktop_set_preferences(
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
        || !["left", "right"].contains(&prefs.widget_edge.as_str())
        || prefs.widget_monitor.len() > 200
    {
        return Err("Invalid widget preferences".into());
    }
    prefs.widget_offset = prefs.widget_offset.clamp(0, 4000);
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
    apply_widget(&app, &prefs);
    emit_state(&app);
    Ok(())
}
#[tauri::command]
fn desktop_widget_action(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    action: String,
) -> Result<(), String> {
    if window.label() != "widget" && window.label() != "main" {
        return Err("Local widget only".into());
    }
    let state = app.state::<DesktopState>();
    match action.as_str() {
        "toggle" => {
            state.widget_expanded.fetch_xor(true, Ordering::Relaxed);
        }
        "collapse" => {
            state.widget_expanded.store(false, Ordering::Relaxed);
        }
        "settings" | "practice" => {
            state.widget_expanded.store(false, Ordering::Relaxed);
            show_main(&app);
            let _ = app.emit_to("main", "sahib:widget-open", &action);
        }
        "refresh" => {
            let _ = app.emit_to("main", "sahib:refresh-schedule", ());
        }
        _ => return Err("Unknown widget action".into()),
    }
    let prefs = state.disk.lock().map_err(|e| e.to_string())?.prefs.clone();
    apply_widget(&app, &prefs);
    if action == "toggle" && state.widget_expanded.load(Ordering::Relaxed) {
        if let Some(w) = app.get_webview_window("widget") {
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
        loop {
            let now = now_ms();
            let state = app.state::<DesktopState>();
            let (due, tooltip) = {
                let Ok(mut d) = state.disk.lock() else { break };
                let schedule = d.schedule.clone();
                let due = scheduler::take_due(&schedule, &mut d.fired, now);
                if !due.is_empty() || state.position_dirty.swap(false, Ordering::Relaxed) {
                    if let Err(e) = state.save(&d) {
                        eprintln!("[desktop] State save failed: {e}");
                    }
                }
                let tooltip = schedule
                    .prayers
                    .iter()
                    .filter(|p| p.at > now)
                    .min_by_key(|p| p.at)
                    .map(|next| {
                        let name = if schedule.language == "ar" {
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
            if let (Some(tray), Some(tooltip)) = (app.tray_by_id("sahib"), tooltip) {
                let _ = tray.set_tooltip(Some(tooltip));
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
            ,desktop_widget_action
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
            app.manage(DesktopState {
                disk: Mutex::new(disk),
                file,
                audio: NativeAudio::start(),
                position_dirty: AtomicBool::new(false),
                widget_expanded: AtomicBool::new(false),
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
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(2));
                let h=handle.clone();
                let _=handle.run_on_main_thread(move || {
                    let state=h.state::<DesktopState>();
                    let prefs=state.disk.lock().unwrap().prefs.clone();
                    if prefs.widget_mode=="taskbar" && prefs.widget_visible {apply_widget(&h,&prefs);}
                });
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<DesktopState>();
                let mut d = state.disk.lock().unwrap();
                if window.label() == "widget" {
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
                if window.label()=="widget" {
                    let state=window.state::<DesktopState>();
                    let prefs=state.disk.lock().unwrap().prefs.clone();
                    if prefs.widget_mode=="taskbar" && state.widget_expanded.swap(false,Ordering::Relaxed) {apply_widget(window.app_handle(),&prefs);emit_state(window.app_handle());}
                }
            } else if let WindowEvent::Moved(position) = event {
                if window.label() == "widget" {
                    let state = window.state::<DesktopState>();
                    if let Ok(mut d) = state.disk.lock() {
                        if d.prefs.widget_mode=="floating" {
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
