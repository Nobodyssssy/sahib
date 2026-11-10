use tauri::{AppHandle, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

/// Centre a window of `outer` size in `work`. A window larger than the work area is clamped to it.
/// All values are physical pixels; `work` may start at negative coordinates (monitors left of / above the primary).
pub fn centered(work: Rect, outer: (u32, u32)) -> Rect {
    let w = outer.0.min(work.w);
    let h = outer.1.min(work.h);
    Rect {
        x: work.x + ((work.w - w) / 2) as i32,
        y: work.y + ((work.h - h) / 2) as i32,
        w,
        h,
    }
}

/// The monitor the user is working on: under the cursor (tray / widget click), else the window's, else primary.
fn target_monitor(app: &AppHandle, window: &WebviewWindow) -> Option<Monitor> {
    app.cursor_position()
        .ok()
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten())
}

/// Centre the main window in the usable work area (taskbar excluded) of the target monitor.
/// Maximised or fullscreen windows keep their placement. With `force == false`, a window that is
/// already visible and not minimised is left where the user put it.
pub fn place_main(app: &AppHandle, window: &WebviewWindow, force: bool) {
    if !force && window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) {
        return;
    }
    if window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
        return;
    }
    let Some(monitor) = target_monitor(app, window) else {
        return;
    };
    let Ok(outer) = window.outer_size() else {
        return;
    };
    let area = monitor.work_area();
    let target = centered(
        Rect {
            x: area.position.x,
            y: area.position.y,
            w: area.size.width,
            h: area.size.height,
        },
        (outer.width, outer.height),
    );
    if (target.w, target.h) != (outer.width, outer.height) {
        let _ = window.set_size(PhysicalSize::new(target.w, target.h));
    }
    let _ = window.set_position(PhysicalPosition::new(target.x, target.y));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centres_in_the_work_area_not_the_full_screen() {
        // 1920x1080 monitor with a 48px taskbar at the bottom.
        let work = Rect { x: 0, y: 0, w: 1920, h: 1032 };
        assert_eq!(
            centered(work, (1440, 940)),
            Rect { x: 240, y: 46, w: 1440, h: 940 }
        );
    }

    #[test]
    fn works_on_monitors_at_negative_coordinates() {
        let left = Rect { x: -2560, y: -120, w: 2560, h: 1392 };
        let c = centered(left, (1440, 940));
        assert_eq!((c.x, c.y), (-2560 + 560, -120 + 226));
        let above = Rect { x: 0, y: -1080, w: 1920, h: 1032 };
        assert_eq!(centered(above, (1000, 800)).y, -1080 + 116);
    }

    #[test]
    fn taskbar_on_the_left_or_top_shifts_the_centre() {
        let work = Rect { x: 64, y: 0, w: 1856, h: 1080 };
        assert_eq!(centered(work, (1440, 940)).x, 64 + 208);
        let top = Rect { x: 0, y: 48, w: 1920, h: 1032 };
        assert_eq!(centered(top, (1440, 940)).y, 48 + 46);
    }

    #[test]
    fn oversized_windows_are_clamped_to_the_work_area() {
        let work = Rect { x: 0, y: 0, w: 1280, h: 672 };
        let c = centered(work, (1440, 940));
        assert_eq!(c, Rect { x: 0, y: 0, w: 1280, h: 672 });
    }

    #[test]
    fn exact_fit_stays_at_the_origin() {
        let work = Rect { x: 100, y: 50, w: 800, h: 600 };
        assert_eq!(centered(work, (800, 600)), work);
    }
}
