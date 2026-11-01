//! On-demand WebView lifecycle with native compact rendering by default.
use super::*;
use std::sync::OnceLock;
static MODE: OnceLock<String> = OnceLock::new();
pub fn mode() -> &'static str {
    MODE.get_or_init(
        || match std::env::var("SAHIB_MEMORY_EXPERIMENT").as_deref() {
            Ok("keep") => "keep".into(),
            Ok("unload") => "unload".into(),
            Ok("native") => "native".into(),
            _ => {
                if cfg!(feature = "native-widget-rc") {
                    "native".into()
                } else {
                    "keep".into()
                }
            }
        },
    )
}
#[derive(Default)]
pub struct State {
    pub ready: AtomicBool,
    pub close_pending: AtomicBool,
    pub creating: AtomicBool,
    pub refreshing: AtomicBool,
    pub retiring: AtomicBool,
    pub pending_action: Mutex<Option<String>>,
}
pub fn build_window(app: &tauri::AppHandle, label: &str) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|c| c.label == label)
        .unwrap();
    let h = app.clone();
    let builder = tauri::WebviewWindowBuilder::from_config(app, config)?;
    #[cfg(any(debug_assertions, feature = "desktop-qa"))]
    let builder = if let Some(dir) = std::env::var_os("SAHIB_TEST_DATA_DIR")
        .filter(|_| app.config().identifier == "com.sahib.companion.qa")
    {
        let builder = builder.data_directory(PathBuf::from(dir).join("webview"));
        if let Some(port) = std::env::var("SAHIB_TEST_CDP_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .filter(|v| *v > 0)
        {
            builder.additional_browser_args(&format!("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port={port} --enable-logging=stderr"))
        } else {
            builder
        }
    } else {
        builder
    };
    let builder = if label == "widget" {
        let mut snapshot = widget_payload(app, "widget").unwrap_or(serde_json::json!({}));
        if native_widget::active(app) {
            snapshot["widgetExpanded"] = true.into();
        }
        let document_open_id = panel_perf::id();
        builder
            .initialization_script(format!(
                "window.__SAHIB_PANEL_OPEN_ID__={};window.__SAHIB_WIDGET_BOOTSTRAP__={};",
                panel_perf::id(),
                snapshot
            ))
            .on_page_load(move |_, payload| {
                panel_perf::mark(
                    document_open_id,
                    match payload.event() {
                        tauri::webview::PageLoadEvent::Started => "navigationStartedMs",
                        tauri::webview::PageLoadEvent::Finished => "navigationFinishedMs",
                    },
                );
            })
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
    Ok(())
}
pub fn open_main(app: &tauri::AppHandle, visible: bool, action: Option<&str>) {
    if widget_watch::quiescing() {
        return;
    }
    let state = app.state::<State>();
    if visible {
        state.refreshing.store(false, Ordering::Relaxed);
        state.retiring.store(false, Ordering::Relaxed);
        state.close_pending.store(false, Ordering::Relaxed);
    }
    if let Some(action) = action {
        *state.pending_action.lock().unwrap() = Some(action.into());
    }
    if let Some(w) = app.get_webview_window("main") {
        if visible {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
        if let Some(action) = action.filter(|_| state.ready.load(Ordering::Acquire)) {
            let _ = app.emit_to("main", "sahib:widget-open", action);
            state.pending_action.lock().unwrap().take();
        }
        return;
    }
    if state.creating.swap(true, Ordering::AcqRel) {
        return;
    }
    state.ready.store(false, Ordering::Release);
    let h = app.clone();
    std::thread::spawn(move || {
        if widget_watch::quiescing() {
            h.state::<State>().creating.store(false, Ordering::Release);
            return;
        }
        let result = build_window(&h, "main");
        h.state::<State>().creating.store(false, Ordering::Release);
        if let Err(e) = result {
            eprintln!("[experiment] Recreate main: {e}");
        } else if !widget_watch::STOPPING.load(Ordering::Acquire)
            && !h.state::<State>().refreshing.load(Ordering::Relaxed)
            && !h.state::<State>().close_pending.load(Ordering::Relaxed)
        {
            if let Some(w) = h.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    });
}
pub fn request_refresh(app: &tauri::AppHandle) {
    if mode() == "keep" || app.get_webview_window("main").is_some() {
        return;
    }
    if !app.state::<State>().refreshing.swap(true, Ordering::AcqRel) {
        open_main(app, false, None);
        let h = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(120));
            if h.state::<State>().refreshing.swap(false, Ordering::AcqRel) {
                eprintln!(
                    "[experiment] Background timetable refresh timed out; cached schedule retained"
                );
                if let Some(w) = h.get_webview_window("main") {
                    if !w.is_visible().unwrap_or(true) {
                        let _ = retire_webview(&w);
                    }
                }
            }
        });
    }
}
pub fn remember_environment(app: &tauri::AppHandle) {
    if mode() == "keep" {
        return;
    }
    let file = app
        .state::<DesktopState>()
        .file
        .parent()
        .unwrap()
        .join("schedule-environment.json");
    let _ = fs::write(
        file,
        serde_json::json!({"zone":scheduler::zone_signature(),"refreshed":now_ms()}).to_string(),
    );
}
pub fn environment_current(app: &tauri::AppHandle) -> bool {
    let file = app
        .state::<DesktopState>()
        .file
        .parent()
        .unwrap()
        .join("schedule-environment.json");
    fs::read(file)
        .ok()
        .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
        .map(|v| {
            v["zone"].as_str() == Some(&scheduler::zone_signature())
                && v["refreshed"]
                    .as_i64()
                    .is_some_and(|at| now_ms() >= at && now_ms() - at < 6 * 3600000)
        })
        .unwrap_or(false)
}
// Test control disappears from release builds. Only enabled with an explicit,
// isolated QA data directory; no network listener or ordinary profile access.
pub fn start_qa_control(app: &tauri::AppHandle) {
    #[cfg(any(debug_assertions, feature = "desktop-qa"))]
    {
        if app.config().identifier != "com.sahib.companion.qa"
            || std::env::var_os("SAHIB_TEST_DATA_DIR").is_none()
        {
            return;
        }
        let app = app.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_millis(500));
            let file = app
                .state::<DesktopState>()
                .file
                .parent()
                .unwrap()
                .join("qa-control.json");
            if !file.exists() {
                continue;
            }
            let bytes = fs::read(&file).unwrap_or_default();
            let _ = fs::remove_file(&file);
            if bytes.len() > 65536 {
                continue;
            }
            let Ok(request) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
                continue;
            };
            let action = request["action"].as_str().unwrap_or("");
            let result: Result<serde_json::Value, String> = (|| {
                match action {
                    "quit" => app.exit(0),
                    "reveal" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "open" => {
                        open_main(&app, true, request["route"].as_str());
                    }
                    "refresh" => request_refresh(&app),
                    "typography" => {
                        let scale = request["scale"].as_f64().unwrap_or(1.0);
                        if ![1.0, 1.25, 1.5, 2.0].contains(&scale) {
                            return Err("Invalid scale".into());
                        }
                        let path = app
                            .state::<DesktopState>()
                            .file
                            .parent()
                            .unwrap()
                            .join(format!("typography-{}.bmp", (scale * 100.) as i32));
                        let h = app.clone();
                        let (tx, rx) = std::sync::mpsc::channel();
                        app.run_on_main_thread(move || {
                            let _ = tx.send(unsafe { native_text::sample(&h, scale, &path) });
                        })
                        .map_err(|e| e.to_string())?;
                        rx.recv_timeout(Duration::from_secs(15))
                            .map_err(|e| e.to_string())??;
                    }
                    "panel-timing" => {
                        let mut v = panel_perf::snapshot();
                        v["suspended"] = app
                            .state::<native_widget::State>()
                            .panel_suspended
                            .load(Ordering::Acquire)
                            .into();
                        return Ok(v);
                    }
                    "panel" => {
                        native_widget::panel(&app, request["monitor"].as_str().unwrap_or("").into())
                    }
                    "collapse" => {
                        app.state::<DesktopState>()
                            .widget_expanded
                            .store(false, Ordering::Relaxed);
                        let h = app.clone();
                        app.run_on_main_thread(move || {
                            let p = h.state::<DesktopState>().disk.lock().unwrap().prefs.clone();
                            apply_widget(&h, &p);
                        })
                        .map_err(|e| e.to_string())?;
                    }
                    "stop" => desktop_stop_audio(app.clone()),
                    "alert" => {
                        let state = app.state::<DesktopState>();
                        let mut d = state.disk.lock().unwrap();
                        let sound = match request["sound"].as_str().unwrap_or("off") {
                            "qatami" => "qatami",
                            "qatami-fajr" => "qatami-fajr",
                            "chime" => "chime",
                            _ => "off",
                        };
                        d.schedule.alerts.push(scheduler::Alert {
                            id: if request["prayer"].as_bool().unwrap_or(false) {
                                format!("prayer:qa:{}:time", request["id"])
                            } else {
                                format!("qa-memory:{}", request["id"])
                            },
                            at: now_ms() + 1500,
                            title: "Sahib QA memory test".into(),
                            body: "Experimental background reminder".into(),
                            sound: sound.into(),
                            volume: 0.,
                            notify: request["notify"].as_bool().unwrap_or(false),
                        });
                        state.save(&d)?;
                    }
                    "preferences" => {
                        let state = app.state::<DesktopState>();
                        let p = {
                            let mut d = state.disk.lock().unwrap();
                            if let Some(m) = request["monitor"].as_str() {
                                d.prefs.widget_monitor = m.chars().take(200).collect();
                            }
                            if let Some(t) = request["theme"].as_str() {
                                if [
                                    "app",
                                    "windows",
                                    "sahib",
                                    "aura",
                                    "dracula",
                                    "catppuccin",
                                    "rose-pine",
                                    "tokyo-night",
                                ]
                                .contains(&t)
                                {
                                    d.prefs.widget_theme = t.into();
                                }
                            }
                            if let Some(lang) = request["language"].as_str() {
                                d.schedule.language = if lang == "ar" { "ar" } else { "en" }.into();
                            }
                            if let Some(mode) = request["mode"].as_str() {
                                if ["dark", "light"].contains(&mode) {
                                    d.schedule.theme.insert("mode".into(), mode.into());
                                }
                            }
                            state.save(&d)?;
                            d.prefs.clone()
                        };
                        ensure_widget_windows(&app, &p);
                        let h = app.clone();
                        app.run_on_main_thread(move || {
                            apply_widget(&h, &p);
                            emit_state(&h);
                        })
                        .map_err(|e| e.to_string())?;
                    }
                    "menu" => {
                        let id = request["command"].as_str().unwrap_or("");
                        if !["show", "widget", "focus-widget", "unlock", "stop"].contains(&id) {
                            return Err("Unknown menu command".into());
                        }
                        let h = app.clone();
                        let id = id.to_string();
                        app.run_on_main_thread(move || handle_menu(&h, &id))
                            .map_err(|e| e.to_string())?;
                    }
                    "widget-time" => {
                        WIDGET_TEST_TIME.store(request["at"].as_i64().unwrap_or(0), Ordering::Relaxed);
                        let h = app.clone();
                        app.run_on_main_thread(move || {
                            let p = h.state::<DesktopState>().disk.lock().unwrap().prefs.clone();
                            apply_widget(&h, &p);
                            emit_state(&h);
                        }).map_err(|e| e.to_string())?;
                    }
                    "status" => {}
                    _ => return Err("Unknown QA action".into()),
                }
                let d = app.state::<DesktopState>().disk.lock().unwrap().clone();
                let native = app
                    .state::<native_widget::State>()
                    .views
                    .lock()
                    .unwrap()
                    .clone();
                Ok(
                    serde_json::json!({"nativeText":native_text::diagnostics(),"mode":mode(),"mainExists":app.get_webview_window("main").is_some(),"mainVisible":app.get_webview_window("main").is_some_and(|w|w.is_visible().unwrap_or(false)),"webviews":app.webview_windows().keys().cloned().collect::<Vec<_>>(),"native":native,"prefs":d.prefs,"validUntil":d.schedule.valid_until,"fired":d.fired,"audioPlaying":app.state::<DesktopState>().audio.active.load(Ordering::Relaxed),"audioError":*app.state::<DesktopState>().audio.error.lock().unwrap()}),
                )
            })();
            let response = serde_json::json!({"id":request["id"],"result":result.as_ref().ok(),"error":result.as_ref().err()});
            let _ = fs::write(
                file.with_file_name("qa-response.json"),
                response.to_string(),
            );
        });
    }
    #[cfg(not(any(debug_assertions, feature = "desktop-qa")))]
    let _ = app;
}
pub fn command(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    action: &str,
    snapshot: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    if mode() == "keep" {
        return Ok(serde_json::json!({"enabled":false}));
    }
    require_main(&window)?;
    let state = app.state::<State>();
    let file = app
        .state::<DesktopState>()
        .file
        .parent()
        .unwrap()
        .join("window-session.json");
    match action {
        "attached" => {
            state.ready.store(true, Ordering::Release);
            if let Some(action) = state.pending_action.lock().unwrap().take() {
                let _ = window.emit("sahib:widget-open", action);
            }
            if state.close_pending.swap(false, Ordering::AcqRel)
                && state.retiring.load(Ordering::Relaxed)
                && !window.is_visible().unwrap_or(true)
            {
                let _ = window.emit("sahib:prepare-unload", ());
            }
            Ok(serde_json::json!(true))
        }
        "ready" => Ok(
            serde_json::json!({"enabled":true,"mode":mode(),"refreshing":state.refreshing.load(Ordering::Relaxed),"snapshot":fs::read(&file).ok().and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok()),"action":state.pending_action.lock().unwrap().take()}),
        ),
        "retire" | "refresh-done" => {
            if action == "retire" && !state.retiring.load(Ordering::Relaxed) {
                return Ok(serde_json::json!(false));
            }
            if action == "refresh-done" && !state.refreshing.load(Ordering::Relaxed) {
                return Ok(serde_json::json!(false));
            }
            if let Some(value) = snapshot {
                let bytes = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
                if bytes.len() > 32768 {
                    return Err("Session checkpoint too large".into());
                }
                fs::write(file, bytes).map_err(|e| e.to_string())?;
            }
            state.retiring.store(true, Ordering::Relaxed);
            state.ready.store(false, Ordering::Release);
            state.close_pending.store(false, Ordering::Relaxed);
            retire_webview(&window).map_err(|e| e.to_string())?;
            state.retiring.store(false, Ordering::Relaxed);
            state.refreshing.store(false, Ordering::Relaxed);
            Ok(serde_json::json!(true))
        }
        _ => Err("Unknown experiment action".into()),
    }
}
