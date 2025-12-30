const fs = require("fs");
const path = require("path");
const { IpcHandler } = require("../../shared/ipc.channels");

function registerConfigIpc(ipcMain, app) {
  const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

  ipcMain.handle(IpcHandler.LOAD_CONFIG, async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        source_mods_folder: "",
        mod_links_folder: "",
        blur: false,
        navbar_type: "list",
        auto_fetch: false,
        disable_others: true,
        user_ini_path: "",
        show_all_active_when_empty: true,
        delete_archive_after_install: true,
      };

      fs.writeFileSync(
        CONFIG_PATH,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8"
      );

      return defaultConfig;
    }

    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    let mutated = false;
    if (cfg.show_all_active_when_empty === undefined) {
      cfg.show_all_active_when_empty = true;
      mutated = true;
    }
    if (cfg.delete_archive_after_install === undefined) {
      cfg.delete_archive_after_install = true;
      mutated = true;
    }
    if (mutated) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
    }
    return cfg;
  });

  ipcMain.handle(IpcHandler.SAVE_CONFIG, async (_, data) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  });
}

module.exports = { registerConfigIpc };
