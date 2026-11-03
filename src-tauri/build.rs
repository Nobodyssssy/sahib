fn main() {
    println!("cargo:rerun-if-changed=windows.manifest");
    let windows =
        tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows.manifest"));
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("Could not prepare Windows resources");
}
