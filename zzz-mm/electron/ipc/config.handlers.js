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
      };

      fs.writeFileSync(
        CONFIG_PATH,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8"
      );

      return defaultConfig;
    }

    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  });

  ipcMain.handle(IpcHandler.SAVE_CONFIG, async (_, data) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  });
}

module.exports = { registerConfigIpc };
