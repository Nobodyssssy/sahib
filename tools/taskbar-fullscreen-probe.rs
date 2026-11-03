//! Standalone Win32 regression fixture using the application's actual classifier.
#![allow(dead_code)]
#[path = "../src-tauri/src/taskbar.rs"]
mod taskbar;

use std::{
    ffi::c_void,
    io::{self, Write},
    ptr,
};
type Hwnd = *mut c_void;
#[repr(C)]
struct Class {
    style: u32,
    procedure: unsafe extern "system" fn(Hwnd, u32, usize, isize) -> isize,
    class_extra: i32,
    window_extra: i32,
    instance: Hwnd,
    icon: Hwnd,
    cursor: Hwnd,
    background: Hwnd,
    menu: *const u16,
    name: *const u16,
}
#[repr(C)]
#[derive(Default)]
struct Message {
    window: Hwnd,
    code: u32,
    wp: usize,
    lp: isize,
    time: u32,
    x: i32,
    y: i32,
    private: u32,
}
#[link(name = "user32")]
extern "system" {
    fn SetThreadDpiAwarenessContext(context: isize) -> isize;
    fn RegisterClassW(class: *const Class) -> u16;
    fn CreateWindowExW(
        ex: u32,
        class: *const u16,
        title: *const u16,
        style: u32,
        x: i32,
        y: i32,
        w: i32,
        h: i32,
        parent: Hwnd,
        menu: Hwnd,
        instance: Hwnd,
        data: *const c_void,
    ) -> Hwnd;
    fn DefWindowProcW(window: Hwnd, code: u32, wp: usize, lp: isize) -> isize;
    fn GetMessageW(message: *mut Message, window: Hwnd, min: u32, max: u32) -> i32;
    fn TranslateMessage(message: *const Message) -> i32;
    fn DispatchMessageW(message: *const Message) -> isize;
    fn PostMessageW(window: Hwnd, code: u32, wp: usize, lp: isize) -> i32;
    fn PostQuitMessage(code: i32);
}
unsafe extern "system" fn procedure(window: Hwnd, code: u32, wp: usize, lp: isize) -> isize {
    if code == 2 {
        PostQuitMessage(0);
    }
    DefWindowProcW(window, code, wp, lp)
}
fn main() {
    unsafe {
        SetThreadDpiAwarenessContext(-4);
    }
    let args: Vec<_> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("check") => {
            let rect: Vec<i32> = args[1..].iter().map(|s| s.parse().unwrap()).collect();
            assert_eq!(rect.len(), 4);
            println!(
                "{}",
                taskbar::fullscreen((rect[0], rect[1], rect[2], rect[3]), 0)
            );
        }
        Some("fixture") => unsafe {
            let name: Vec<u16> = args[1].encode_utf16().chain(Some(0)).collect();
            let rect: Vec<i32> = args[2..6].iter().map(|s| s.parse().unwrap()).collect();
            let class = Class {
                style: 0,
                procedure,
                class_extra: 0,
                window_extra: 0,
                instance: ptr::null_mut(),
                icon: ptr::null_mut(),
                cursor: ptr::null_mut(),
                background: ptr::null_mut(),
                menu: ptr::null(),
                name: name.as_ptr(),
            };
            assert_ne!(RegisterClassW(&class), 0);
            let ex = if args.get(6).is_some_and(|s| s == "overlay") {
                0x08000020
            } else {
                0
            };
            let window = CreateWindowExW(
                ex,
                name.as_ptr(),
                name.as_ptr(),
                0x90000000,
                rect[0],
                rect[1],
                rect[2] - rect[0],
                rect[3] - rect[1],
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null(),
            );
            assert!(!window.is_null());
            println!("ready");
            io::stdout().flush().unwrap();
            let handle = window as isize;
            std::thread::spawn(move || {
                let mut line = String::new();
                let _ = io::stdin().read_line(&mut line);
                PostMessageW(handle as Hwnd, 0x10, 0, 0);
            });
            let mut message = Message::default();
            while GetMessageW(&mut message, ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        },
        _ => panic!("Expected check RECT or fixture CLASS RECT [overlay]"),
    }
}
