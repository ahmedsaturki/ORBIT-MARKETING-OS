
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();

    // Windows WebView2 Runtime 150+ ignores user-level debugging flags for
    // elevated hosts. Keep the CDP override behind a build-only E2E feature so
    // production binaries never gain a debug port from runtime environment input.
    #[cfg(all(windows, feature = "e2e-cdp"))]
    let context = {
        let mut context = context;
        if let Ok(raw_port) = std::env::var("ORBIT_E2E_CDP_PORT") {
            if let Ok(port) = raw_port.trim().parse::<u16>() {
                if port != 0 {
                    if let Some(window) = context.config_mut().app.windows.get_mut(0) {
                        window.additional_browser_args = Some(format!(
                            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port={port}"
                        ));
                    }
                }
            }
        }
        context
    };

    let result = tauri::Builder::default()
        .setup(|app| {
            let connection = open_db(app.handle()).map_err(Box::<dyn std::error::Error>::from)?;
            recover_interrupted_tasks(&connection).map_err(Box::<dyn std::error::Error>::from)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_health,
            workspace_list,
            workspace_current,
            workspace_create,
            workspace_select,
            telegram_execute_task,
            vault_put,