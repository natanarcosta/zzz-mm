const { registerModHandlers } = require("./mod.handlers");
const { registerFsIpc } = require("./fs.handlers");
const { registerImageIpc } = require("./image.handlers");
const { registerConfigIpc } = require("./config.handlers");
const { registerSystemHandlers } = require("./system.handlers");
const { registerSymlinkIpc } = require("./symlink.handlers");
const { registerSyncIniHandlers } = require("./sync-ini.handlers");
const { registerPresetHandlers } = require("./preset.handlers");

function registerIpcHandlers(ipcMain, services, app) {
  registerModHandlers(ipcMain, services);
  registerFsIpc(ipcMain);
  registerImageIpc(ipcMain, services);
  registerConfigIpc(ipcMain, app);
  registerSystemHandlers(ipcMain, {
    app,
    shell: require("electron").shell,
    dialog: require("electron").dialog,
  });
  registerSymlinkIpc(ipcMain);
  registerSyncIniHandlers(ipcMain, services);
  registerPresetHandlers(ipcMain, app);
}

module.exports = { registerIpcHandlers };
