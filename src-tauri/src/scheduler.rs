use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub alerts: Vec<Alert>,
    pub prayers: Vec<Moment>,
    pub location: String,
    pub language: String,
    pub theme: HashMap<String, String>,
    pub valid_until: i64,
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
    let last = due.len().saturating_sub(1);
    for (i, event) in due.iter_mut().enumerate() {
        if i != last {
            event.sound = "off".into();
        }
    }
    due
}

pub fn validate(schedule: &Schedule, now: i64) -> Result<(), String> {
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
