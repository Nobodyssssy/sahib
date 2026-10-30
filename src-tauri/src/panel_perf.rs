use serde_json::{json, Value};
use std::{sync::Mutex, time::Instant};
struct Run {
    start: Instant,
    value: Value,
}
static RUN: Mutex<Option<Run>> = Mutex::new(None);
static COUNT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
pub fn begin(warm: bool) -> u64 {
    let id = COUNT.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
    *RUN.lock().unwrap() = Some(Run {
        start: Instant::now(),
        value: json!({"id":id,"kind":if warm{"warm"}else{"cold"},"firstAfterStartup":id==1}),
    });
    id
}
pub fn id() -> u64 {
    RUN.lock()
        .unwrap()
        .as_ref()
        .and_then(|r| r.value["id"].as_u64())
        .unwrap_or(0)
}
pub fn mark(id: u64, stage: &str) {
    if let Some(run) = RUN.lock().unwrap().as_mut() {
        if run.value["id"].as_u64() == Some(id) && run.value[stage].is_null() {
            run.value[stage] = json!(run.start.elapsed().as_secs_f64() * 1000.);
        }
    }
}
pub fn frontend(id: u64, phase: &str, metrics: Value) {
    if let Some(run) = RUN.lock().unwrap().as_mut() {
        if run.value["id"].as_u64() == Some(id) && run.value[phase].is_null() {
            run.value[phase] = json!(run.start.elapsed().as_secs_f64() * 1000.);
            if phase == "paintedMs" || run.value["frontend"].is_null() {
                run.value["frontend"] = metrics;
            }
        }
    }
}
pub fn snapshot() -> Value {
    RUN.lock()
        .unwrap()
        .as_ref()
        .map(|r| r.value.clone())
        .unwrap_or(json!({}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn timing_ignores_stale_and_repeat_updates() {
        let first = begin(false);
        frontend(first, "paintedMs", json!({"renderMs":12}));
        let saved = snapshot();
        frontend(first, "paintedMs", json!({"renderMs":200}));
        assert_eq!(snapshot(), saved);
        let second = begin(true);
        assert_eq!(second, first + 1);
        frontend(first, "paintedMs", json!({}));
        assert!(snapshot()["paintedMs"].is_null());
        mark(second, "shownMs");
        let saved = snapshot();
        mark(second, "shownMs");
        assert_eq!(snapshot(), saved);
    }
}
