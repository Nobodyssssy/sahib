use serde::{Deserialize, Serialize};

pub fn allows_alert(focus: bool, id: &str, sound: &str) -> bool {
    !focus
        || (id.starts_with("prayer:")
            && id.ends_with(":time")
            && sound != "off"
            && sound != "chime")
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SessionTimer {
    pub seconds: u32,
    pub deadline: i64,
    pub repeat: bool,
    pub focus: bool,
    pub finished: bool,
}
impl SessionTimer {
    pub fn start(
        &mut self,
        seconds: u32,
        repeat: bool,
        focus: bool,
        now: i64,
    ) -> Result<(), String> {
        if !(10..=86400).contains(&seconds) {
            return Err("Choose 10 seconds to 24 hours".into());
        }
        *self = Self {
            seconds,
            deadline: now + i64::from(seconds) * 1000,
            repeat,
            focus,
            finished: false,
        };
        Ok(())
    }
    pub fn tick(&mut self, now: i64) -> bool {
        if self.deadline == 0 || now < self.deadline {
            return false;
        }
        self.finished = true;
        self.deadline = if self.repeat {
            now + i64::from(self.seconds.max(10)) * 1000
        } else {
            0
        };
        true
    }
    pub fn quiet(&self, now: i64) -> bool {
        self.focus && self.deadline > now
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn focus_allows_adhan_but_consumes_other_reminders() {
        assert!(allows_alert(true, "prayer:today:Dhuhr:time", "qatami"));
        assert!(allows_alert(true, "prayer:today:Fajr:time", "custom-123"));
        assert!(!allows_alert(true, "prayer:today:Dhuhr:lead", "chime"));
        assert!(!allows_alert(true, "practice:reading", "off"));
        assert!(!allows_alert(true, "prayer:today:Dhuhr:time", "chime"));
        assert!(allows_alert(false, "practice:reading", "off"));
    }
    #[test]
    fn finish_once_and_release_focus() {
        let mut t = SessionTimer::default();
        t.start(300, false, true, 1000).unwrap();
        assert!(t.quiet(2000));
        assert!(!t.tick(300999));
        assert!(t.tick(301000));
        assert!(!t.tick(301001));
        assert!(!t.quiet(301001));
        assert!(t.finished);
    }
    #[test]
    fn repeat_skips_missed_bursts_and_persists() {
        let mut t = SessionTimer::default();
        t.start(60, true, true, 0).unwrap();
        let mut t: SessionTimer =
            serde_json::from_str(&serde_json::to_string(&t).unwrap()).unwrap();
        assert!(t.tick(600000));
        assert_eq!(t.deadline, 660000);
        assert!(!t.tick(600001));
        assert!(t.quiet(600001));
        assert!(t.start(0, false, false, 0).is_err());
    }
}
