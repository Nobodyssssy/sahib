use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[repr(C)]
struct WindowsZone {
    bias: i32,
    standard: [u16; 32],
    standard_date: [u16; 8],
    standard_bias: i32,
    daylight: [u16; 32],
    daylight_date: [u16; 8],
    daylight_bias: i32,
}
#[link(name = "kernel32")]
extern "system" {
    fn GetTimeZoneInformation(info: *mut WindowsZone) -> u32;
}
pub fn zone_signature() -> String {
    let mut info: WindowsZone = unsafe { std::mem::zeroed() };
    let status = unsafe { GetTimeZoneInformation(&mut info) };
    format!(
        "{status}:{}:{}:{}:{:?}:{:?}",
        info.bias, info.standard_bias, info.daylight_bias, info.standard, info.daylight
    )
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub at: i64,
    pub title: String,
    pub body: String,
    pub sound: String,
    pub volume: f32,
    pub notify: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Moment {
    pub name: String,
    pub name_ar: String,
    pub at: i64,
    pub clock: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WidgetReminder {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub kind: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WidgetDay {
    pub start: i64,
    pub end: i64,
    pub label: String,
    pub hijri: String,
    pub prayers: Vec<Moment>,
    pub reminders: Vec<WidgetReminder>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub alerts: Vec<Alert>,
    pub prayers: Vec<Moment>,
    pub location: String,
    pub language: String,
    pub theme: HashMap<String, String>,
    pub valid_until: i64,
    #[serde(default)]
    pub widget_days: Vec<WidgetDay>,
}

// A persisted ledger prevents replay after refresh/restart. Old alerts are never burst-played.
pub fn take_due(schedule: &Schedule, fired: &mut HashMap<String, i64>, now: i64) -> Vec<Alert> {
    fired.retain(|_, at| *at > now - 7 * 86_400_000);
    let mut due: Vec<_> = schedule
        .alerts
        .iter()
        .filter(|event| {
            event.at <= now && now - event.at <= 120_000 && !fired.contains_key(&event.id)
        })
        .cloned()
        .collect();
    due.sort_by_key(|event| event.at);
    // If more than one alert is due on resume, show only the most recent sound.
    for event in &due {
        fired.insert(event.id.clone(), event.at);
    }
    // A silent practice notice must not suppress a prayer's adhan at the same deadline.
    let last = due.iter().rposition(|event| event.sound != "off");
    for (i, event) in due.iter_mut().enumerate() {
        if Some(i) != last {
            event.sound = "off".into();
        }
    }
    due
}

pub fn validate(schedule: &Schedule, now: i64) -> Result<(), String> {
    if schedule.widget_days.len() > 36 {
        return Err("Too many widget days".into());
    }
    for day in &schedule.widget_days {
        if day.end <= day.start
            || day.end - day.start > 26 * 3600000
            || day.label.len() > 300
            || day.hijri.len() > 300
            || day.prayers.len() > 7
            || day.reminders.len() > 30
        {
            return Err("Invalid widget day".into());
        }
        if day.reminders.iter().any(|r| {
            r.id.len() > 180 || r.title.len() > 300 || r.detail.len() > 1000 || r.kind.len() > 30
        }) {
            return Err("Invalid widget reminder".into());
        }
    }
    if schedule.alerts.len() > 2500 || schedule.prayers.len() > 500 {
        return Err("Schedule too large".into());
    }
    let mut ids = std::collections::HashSet::new();
    for e in &schedule.alerts {
        if e.id.len() > 180
            || e.id.is_empty()
            || !ids.insert(&e.id)
            || e.title.len() > 300
            || e.body.len() > 1500
        {
            return Err("Invalid alert identity or text".into());
        }
        if e.at < now - 86_400_000
            || e.at > now + 45 * 86_400_000
            || !e.volume.is_finite()
            || !(0.0..=1.0).contains(&e.volume)
        {
            return Err("Invalid alert time or volume".into());
        }
    }
    for p in &schedule.prayers {
        if p.name.len() > 50
            || p.name_ar.len() > 100
            || p.clock.len() > 30
            || p.at > now + 45 * 86_400_000
        {
            return Err("Invalid prayer moment".into());
        }
    }
    if schedule.location.len() > 300 || schedule.theme.len() > 30 {
        return Err("Invalid presentation data".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn clock_rollback_does_not_repeat_fired_alerts() {
        let s = Schedule {
            alerts: vec![event("once", 1000)],
            ..Default::default()
        };
        let mut fired = HashMap::new();
        assert_eq!(take_due(&s, &mut fired, 1000).len(), 1);
        assert!(take_due(&s, &mut fired, 500).is_empty());
        assert!(take_due(&s, &mut fired, 1000).is_empty());
    }
    #[test]
    fn large_clock_jump_discards_old_sounds() {
        let s = Schedule {
            alerts: vec![event("old", 1000), event("next", 500000)],
            ..Default::default()
        };
        let mut fired = HashMap::new();
        assert!(take_due(&s, &mut fired, 250000).is_empty());
        assert_eq!(take_due(&s, &mut fired, 500000).len(), 1);
    }
    #[test]
    fn notifications_keep_their_suppression_flag() {
        let s = Schedule {
            alerts: vec![event("suppressed", 1000)],
            ..Default::default()
        };
        let due = take_due(&s, &mut HashMap::new(), 1000);
        assert!(!due[0].notify);
    }
    #[test]
    fn silent_practice_does_not_suppress_adhan() {
        let mut prayer = event("prayer", 1000);
        prayer.sound = "qatami".into();
        let mut practice = event("practice", 1000);
        practice.sound = "off".into();
        let schedule = Schedule {
            alerts: vec![prayer, practice],
            ..Default::default()
        };
        let due = take_due(&schedule, &mut HashMap::new(), 1000);
        assert_eq!(due.len(), 2);
        assert_eq!(due[0].sound, "qatami");
        assert_eq!(due[1].sound, "off");
    }
    #[test]
    fn old_schedule_without_widget_days_is_compatible() {
        let value = serde_json::to_value(Schedule::default()).unwrap();
        let mut value = value.as_object().unwrap().clone();
        value.remove("widgetDays");
        let restored: Schedule = serde_json::from_value(value.into()).unwrap();
        assert!(restored.widget_days.is_empty());
        assert!(validate(&restored, 1000).is_ok());
    }
    fn event(id: &str, at: i64) -> Alert {
        Alert {
            id: id.into(),
            at,
            sound: "chime".into(),
            volume: 0.5,
            ..Default::default()
        }
    }
    #[test]
    fn exact_time_and_persistent_dedup() {
        let s = Schedule {
            alerts: vec![event("a", 1000)],
            ..Default::default()
        };
        let mut fired = HashMap::new();
        assert!(take_due(&s, &mut fired, 999).is_empty());
        assert_eq!(take_due(&s, &mut fired, 1000).len(), 1);
        let saved = serde_json::to_string(&fired).unwrap();
        let mut restored = serde_json::from_str(&saved).unwrap();
        assert!(take_due(&s, &mut restored, 1001).is_empty());
    }
    #[test]
    fn missed_alerts_do_not_replay_after_sleep() {
        let s = Schedule {
            alerts: vec![event("old", 1000)],
            ..Default::default()
        };
        assert!(take_due(&s, &mut HashMap::new(), 121001).is_empty());
    }
    #[test]
    fn replacing_schedule_cancels_old_alerts() {
        assert!(take_due(&Schedule::default(), &mut HashMap::new(), 1000).is_empty());
    }
    #[test]
    fn only_one_sound_on_resume() {
        let s = Schedule {
            alerts: vec![event("lead", 900), event("time", 1000)],
            ..Default::default()
        };
        let d = take_due(&s, &mut HashMap::new(), 1000);
        assert_eq!(d[0].sound, "off");
        assert_eq!(d[1].sound, "chime");
    }
    #[test]
    fn duplicate_and_invalid_events_rejected() {
        let s = Schedule {
            alerts: vec![event("same", 1000), event("same", 2000)],
            ..Default::default()
        };
        assert!(validate(&s, 0).is_err());
        let s = Schedule {
            alerts: vec![event("far", 46 * 86_400_000)],
            ..Default::default()
        };
        assert!(validate(&s, 0).is_err());
    }
}
