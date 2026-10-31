//! A single accessible button represents the compact prayer companion.
//! Current values are queried on demand, avoiding screen-reader chatter each second.
use super::*;
use windows::{
    core::{implement, IUnknown, IUnknownImpl, Interface},
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        System::Variant::VARIANT,
        UI::Accessibility::*,
    },
};
#[implement(IRawElementProviderSimple, IInvokeProvider)]
struct Provider {
    hwnd: isize,
    label: String,
    app: tauri::AppHandle,
}
impl Provider {
    fn name(&self) -> String {
        let s = self.app.state::<DesktopState>();
        let d = s.disk.lock().unwrap();
        let ar = d.schedule.language == "ar";
        let now = now_ms();
        if let Some(p) = d
            .schedule
            .prayers
            .iter()
            .filter(|p| p.at > now && d.schedule.valid_until > now)
            .min_by_key(|p| p.at)
        {
            let sec = ((p.at - now) / 1000).max(0);
            let countdown = if d.prefs.widget_show_seconds {
                format!("{:02}:{:02}:{:02}", sec / 3600, sec / 60 % 60, sec % 60)
            } else {
                format!("{:02}:{:02}", sec / 3600, sec / 60 % 60)
            };
            format!(
                "{} {}. {} \u{2066}{}\u{2069}. {} \u{2066}{}\u{2069}",
                if ar {
                    "الصلاة القادمة"
                } else {
                    "Next prayer"
                },
                if ar { &p.name_ar } else { &p.name },
                if ar { "الوقت" } else { "Time" },
                p.clock,
                if ar { "المتبقي" } else { "Remaining" },
                countdown
            )
        } else {
            if ar {
                "صاحب. افتح التطبيق لتحديث أوقات الصلاة"
            } else {
                "Sahib. Open the app to refresh prayer times"
            }
            .into()
        }
    }
}
impl IRawElementProviderSimple_Impl for Provider_Impl {
    fn ProviderOptions(&self) -> windows::core::Result<ProviderOptions> {
        Ok(ProviderOptions_ServerSideProvider | ProviderOptions_UseComThreading)
    }
    fn GetPatternProvider(&self, id: UIA_PATTERN_ID) -> windows::core::Result<IUnknown> {
        if id == UIA_InvokePatternId {
            self.to_interface::<IInvokeProvider>().cast()
        } else {
            Err(windows::core::Error::from_hresult(windows::core::HRESULT(
                0x80004002u32 as i32,
            )))
        }
    }
    fn GetPropertyValue(&self, id: UIA_PROPERTY_ID) -> windows::core::Result<VARIANT> {
        let ar = self
            .app
            .state::<DesktopState>()
            .disk
            .lock()
            .unwrap()
            .schedule
            .language
            == "ar";
        Ok(if id == UIA_NamePropertyId {
            VARIANT::from(self.name().as_str())
        } else if id == UIA_ControlTypePropertyId {
            VARIANT::from(UIA_ButtonControlTypeId.0)
        } else if id == UIA_AutomationIdPropertyId {
            VARIANT::from(self.label.as_str())
        } else if id == UIA_IsKeyboardFocusablePropertyId
            || id == UIA_IsControlElementPropertyId
            || id == UIA_IsContentElementPropertyId
            || id == UIA_IsEnabledPropertyId
        {
            VARIANT::from(true)
        } else if id == UIA_HelpTextPropertyId {
            VARIANT::from(if ar {
                "اضغط إدخال لفتح مواقيت الصلاة. اضغط F10 لفتح الإعدادات."
            } else {
                "Press Enter or Space for prayer times. Press F10 for Settings. Focus from the Sahib tray menu."
            })
        } else {
            VARIANT::default()
        })
    }
    fn HostRawElementProvider(&self) -> windows::core::Result<IRawElementProviderSimple> {
        unsafe { UiaHostProviderFromHwnd(HWND(self.hwnd as _)) }
    }
}
impl IInvokeProvider_Impl for Provider_Impl {
    fn Invoke(&self) -> windows::core::Result<()> {
        let monitor = self
            .app
            .state::<native_widget::State>()
            .views
            .lock()
            .unwrap()
            .get(&self.label)
            .map(|v| v.monitor.clone());
        if let Some(m) = monitor {
            native_widget::toggle_panel(&self.app, m);
            Ok(())
        } else {
            Err(windows::core::Error::from_hresult(windows::core::HRESULT(
                0x80040201u32 as i32,
            )))
        }
    }
}
thread_local! {static PROVIDERS:std::cell::RefCell<HashMap<isize,IRawElementProviderSimple>>=std::cell::RefCell::new(HashMap::new());}
pub unsafe fn get(app: &tauri::AppHandle, label: &str, hwnd: isize, wp: usize, lp: isize) -> isize {
    PROVIDERS.with(|cell| {
        let mut p = cell.borrow_mut();
        let provider = p.entry(hwnd).or_insert_with(|| {
            Provider {
                hwnd,
                label: label.into(),
                app: app.clone(),
            }
            .into()
        });
        UiaReturnRawElementProvider(HWND(hwnd as _), WPARAM(wp), LPARAM(lp), &*provider).0
    })
}
pub fn disconnect(hwnd: isize) {
    PROVIDERS.with(|p| {
        if let Some(provider) = p.borrow_mut().remove(&hwnd) {
            unsafe {
                let _ = UiaDisconnectProvider(&provider);
            }
        }
    });
}
