//! DirectWrite shaping and bidi with a private, process-local font collection.
//! COM graphics objects stay on the painting thread; no global font installation.
use std::{cell::RefCell, collections::HashMap};
static DRAWN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static FAILED: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static FAMILY: std::sync::OnceLock<std::sync::Mutex<String>> = std::sync::OnceLock::new();
#[cfg(any(debug_assertions, feature = "desktop-qa"))]
pub fn diagnostics() -> serde_json::Value {
    serde_json::json!({"renderer":"DirectWrite","drawn":DRAWN.load(std::sync::atomic::Ordering::Relaxed),"failed":FAILED.load(std::sync::atomic::Ordering::Relaxed),"family":FAMILY.get().map(|m|m.lock().unwrap().clone())})
}
use windows::{
    core::{Interface, PCWSTR},
    Win32::{
        Foundation::RECT,
        Graphics::{
            Direct2D::{Common::*, *},
            DirectWrite::*,
            Dxgi::Common::DXGI_FORMAT_B8G8R8A8_UNORM,
            Gdi::HDC,
        },
    },
};
thread_local! {static ENGINE:RefCell<Option<Engine>>=const{RefCell::new(None)};}
struct Engine {
    factory: IDWriteFactory,
    target: ID2D1DCRenderTarget,
    fonts: IDWriteFontCollection,
    family: String,
    formats: HashMap<String, IDWriteTextFormat>,
}
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(Some(0)).collect()
}
fn rgba(c: u32) -> D2D1_COLOR_F {
    D2D1_COLOR_F {
        r: (c & 255) as f32 / 255.,
        g: ((c >> 8) & 255) as f32 / 255.,
        b: ((c >> 16) & 255) as f32 / 255.,
        a: 1.,
    }
}
impl Engine {
    unsafe fn new(app: &tauri::AppHandle) -> windows::core::Result<Self> {
        let factory: IDWriteFactory = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED)?;
        let f5: IDWriteFactory5 = factory.cast()?;
        let builder = f5.CreateFontSetBuilder()?;
        use tauri::Manager;
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|_| windows::core::Error::from_thread())?
            .join("native-fonts");
        std::fs::create_dir_all(&dir).map_err(|_| windows::core::Error::from_thread())?;
        let file = dir.join("Tajawal-Medium-024.ttf");

        let bytes = include_bytes!("../../native-resources/fonts/Tajawal-Medium.ttf");
        if std::fs::read(&file).ok().as_deref() != Some(bytes.as_slice()) {
            std::fs::write(&file, bytes).map_err(|_| windows::core::Error::from_thread())?;
        }
        // QA-only font comparison. A release cannot load an arbitrary override font.
        #[cfg(any(debug_assertions, feature = "desktop-qa"))]
        let file = if app.config().identifier == "com.sahib.companion.qa"
            && std::env::var_os("SAHIB_TEST_DATA_DIR").is_some()
        {
            std::env::var("SAHIB_QA_FONT_PATH")
                .map(std::path::PathBuf::from)
                .unwrap_or(file)
        } else {
            file
        };
        let path = wide(&file.to_string_lossy());
        let font = factory.CreateFontFileReference(PCWSTR(path.as_ptr()), None)?;
        builder.AddFontFile(&font)?;
        let set = builder.CreateFontSet()?;
        let f3: IDWriteFactory3 = factory.cast()?;
        let fonts: IDWriteFontCollection = f3.CreateFontCollectionFromFontSet(&set)?.cast()?;
        let names = fonts.GetFontFamily(0)?.GetFamilyNames()?;
        let len = names.GetStringLength(0)?;
        let mut chars = vec![0u16; len as usize + 1];
        names.GetString(0, &mut chars)?;
        let family = String::from_utf16_lossy(&chars[..len as usize]);
        *FAMILY
            .get_or_init(|| std::sync::Mutex::new(String::new()))
            .lock()
            .unwrap() = family.clone();
        let d2d: ID2D1Factory = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, None)?;
        let target = d2d.CreateDCRenderTarget(&D2D1_RENDER_TARGET_PROPERTIES {
            r#type: D2D1_RENDER_TARGET_TYPE_DEFAULT,
            pixelFormat: D2D1_PIXEL_FORMAT {
                format: DXGI_FORMAT_B8G8R8A8_UNORM,
                alphaMode: D2D1_ALPHA_MODE_IGNORE,
            },
            dpiX: 96.,
            dpiY: 96.,
            usage: D2D1_RENDER_TARGET_USAGE_NONE,
            minLevel: D2D1_FEATURE_LEVEL_DEFAULT,
        })?;
        target.SetTextAntialiasMode(D2D1_TEXT_ANTIALIAS_MODE_CLEARTYPE);
        Ok(Self {
            factory,
            target,
            fonts,
            family,
            formats: HashMap::new(),
        })
    }
    unsafe fn draw(
        &mut self,
        dc: HDC,
        value: &str,
        rect: RECT,
        size: f32,
        weight: i32,
        rtl: bool,
        right: bool,
        ink: u32,
        surface: u32,
    ) -> windows::core::Result<()> {
        let arabic = value
            .chars()
            .any(|c| ('\u{0600}'..='\u{08ff}').contains(&c));
        let family = if arabic {
            self.family.as_str()
        } else {
            "Segoe UI"
        };
        let key = format!("{family}:{size}:{weight}:{rtl}:{right}");
        if !self.formats.contains_key(&key) {
            let name = wide(family);
            let locale = wide(if arabic { "ar" } else { "en" });
            let f = self.factory.CreateTextFormat(
                PCWSTR(name.as_ptr()),
                if arabic { Some(&self.fonts) } else { None },
                DWRITE_FONT_WEIGHT(weight),
                DWRITE_FONT_STYLE_NORMAL,
                DWRITE_FONT_STRETCH_NORMAL,
                size,
                PCWSTR(locale.as_ptr()),
            )?;
            f.SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP)?;
            f.SetReadingDirection(if rtl {
                DWRITE_READING_DIRECTION_RIGHT_TO_LEFT
            } else {
                DWRITE_READING_DIRECTION_LEFT_TO_RIGHT
            })?;
            f.SetTextAlignment(if right != rtl {
                DWRITE_TEXT_ALIGNMENT_TRAILING
            } else {
                DWRITE_TEXT_ALIGNMENT_LEADING
            })?;
            f.SetParagraphAlignment(DWRITE_PARAGRAPH_ALIGNMENT_CENTER)?;
            self.formats.insert(key.clone(), f);
        }
        let text: Vec<u16> = value.encode_utf16().collect();
        let width = (rect.right - rect.left).max(1) as f32;
        let height = (rect.bottom - rect.top).max(1) as f32;
        let layout = self
            .factory
            .CreateTextLayout(&text, &self.formats[&key], width, height)?;
        let mut metrics = DWRITE_TEXT_METRICS::default();
        layout.GetMetrics(&mut metrics)?;
        // Long localized labels shrink only as far as a readable 90%, then trim.
        if metrics.width > width {
            layout.SetFontSize(
                size * (width / metrics.width).max(0.9),
                DWRITE_TEXT_RANGE {
                    startPosition: 0,
                    length: text.len() as u32,
                },
            )?;
        }
        self.target.BindDC(dc, &rect)?;
        self.target.BeginDraw();
        let bg = rgba(surface);
        self.target.Clear(Some(&bg));
        let brush = self.target.CreateSolidColorBrush(&rgba(ink), None)?;
        self.target.DrawTextLayout(
            Default::default(),
            &layout,
            &brush,
            D2D1_DRAW_TEXT_OPTIONS_CLIP,
        );
        self.target.EndDraw(None, None)?;
        Ok(())
    }
}
pub unsafe fn draw(
    app: &tauri::AppHandle,
    dc: windows_sys::Win32::Graphics::Gdi::HDC,
    value: &str,
    r: windows_sys::Win32::Foundation::RECT,
    font: windows_sys::Win32::Graphics::Gdi::HFONT,
    ink: u32,
    surface: u32,
    flags: u32,
) -> bool {
    let mut log = windows_sys::Win32::Graphics::Gdi::LOGFONTW::default();
    windows_sys::Win32::Graphics::Gdi::GetObjectW(
        font,
        std::mem::size_of_val(&log) as i32,
        &mut log as *mut _ as _,
    );
    ENGINE.with(|cell| {
        let mut e = cell.borrow_mut();
        if e.is_none() {
            match Engine::new(app) {
                Ok(engine) => *e = Some(engine),
                Err(err) => {
                    FAILED.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    eprintln!("[native-text] DirectWrite initialization: {err}");
                    return false;
                }
            }
        }
        let rtl = flags & windows_sys::Win32::Graphics::Gdi::DT_RTLREADING != 0;
        let right = flags & windows_sys::Win32::Graphics::Gdi::DT_RIGHT != 0;
        let result = e.as_mut().unwrap().draw(
            HDC(dc),
            value,
            RECT {
                left: r.left,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
            },
            log.lfHeight.unsigned_abs() as f32,
            log.lfWeight,
            rtl,
            right,
            ink,
            surface,
        );
        if result.is_ok() {
            DRAWN.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        } else {
            FAILED.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        result
            .map_err(|err| {
                eprintln!("[native-text] Render: {err}");
            })
            .is_ok()
    })
}

/// QA rendering sample: native shaping at explicit pixel scales. This is not
/// a claim that the physical Windows monitor has changed its display scaling.
#[cfg(any(debug_assertions, feature = "desktop-qa"))]
pub unsafe fn sample(
    app: &tauri::AppHandle,
    scale: f64,
    output: &std::path::Path,
) -> Result<(), String> {
    use windows_sys::Win32::{Foundation::RECT, Graphics::Gdi::*};
    if !(1.0..=2.0).contains(&scale) {
        return Err("Invalid sample scale".into());
    }
    let w = (600. * scale) as i32;
    let h = (300. * scale) as i32;
    let screen = GetDC(std::ptr::null_mut());
    let dc = CreateCompatibleDC(screen);
    let bitmap = CreateCompatibleBitmap(screen, w, h);
    let old = SelectObject(dc, bitmap);
    let bg = CreateSolidBrush(0x203c20);
    let r = RECT {
        left: 0,
        top: 0,
        right: w,
        bottom: h,
    };
    FillRect(dc, &r, bg);
    DeleteObject(bg);
    let family: Vec<u16> = "Segoe UI\0".encode_utf16().collect();
    let font = CreateFontW(
        -(14. * scale) as i32,
        0,
        0,
        0,
        500,
        0,
        0,
        0,
        DEFAULT_CHARSET as u32,
        0,
        0,
        CLEARTYPE_QUALITY as u32,
        0,
        family.as_ptr(),
    );
    let values = [
        "الفَجْر · الظُّهْر · العَصْر · المَغْرِب · العِشاء",
        "المُتَبَقّي  \u{2066}01:23:45\u{2069}",
        "جُمَادَى الأُولَى ١٤٤٨ هـ",
        "صاحب · Sion, Switzerland · \u{2066}23/10/2026\u{2069}",
        "اللَّهُمَّ زِدْنِي عِلْمًا",
    ];
    let mut ok = true;
    for (i, value) in values.iter().enumerate() {
        let r = RECT {
            left: (16. * scale) as i32,
            top: ((12. + i as f64 * 55.) * scale) as i32,
            right: w - (16. * scale) as i32,
            bottom: ((64. + i as f64 * 55.) * scale) as i32,
        };
        ok &= draw(
            app,
            dc,
            value,
            r,
            font,
            0xd2e4ec,
            0x203c20,
            DT_RIGHT | DT_RTLREADING,
        );
    }
    DeleteObject(font);
    SelectObject(dc, old);
    let mut info = BITMAPINFO::default();
    info.bmiHeader = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: w,
        biHeight: -h,
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB,
        ..Default::default()
    };
    let mut pixels = vec![0u8; (w * h * 4) as usize];
    let read = GetDIBits(
        dc,
        bitmap,
        0,
        h as u32,
        pixels.as_mut_ptr() as _,
        &mut info,
        DIB_RGB_COLORS,
    );
    DeleteObject(bitmap);
    DeleteDC(dc);
    ReleaseDC(std::ptr::null_mut(), screen);
    if !ok || read == 0 {
        return Err("Native text sample failed".into());
    }
    let mut bytes = vec![];
    bytes.extend_from_slice(b"BM");
    bytes.extend_from_slice(&(54u32 + pixels.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&0u32.to_le_bytes());
    bytes.extend_from_slice(&54u32.to_le_bytes());
    let header = std::slice::from_raw_parts(&info.bmiHeader as *const _ as *const u8, 40);
    bytes.extend_from_slice(header);
    bytes.extend(pixels);
    std::fs::write(output, bytes).map_err(|e| e.to_string())
}
