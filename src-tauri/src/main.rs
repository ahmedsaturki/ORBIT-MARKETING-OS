#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Renderer capability isolation: the webview gets no commands beyond the
    // explicit capability list in capabilities/default.json (deny by default).
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Orbit Marketing OS");
}
