const { registerModHandlers } = require("./mod.handlers");
const { registerFsIpc } = require("./fs.ipc");
const { registerImageIpc } = require("./image.ipc");
const { registerConfigIpc } = require("./config.ipc");
const { registerSystemHandlers } = require("./system.handlers");
const { registerSymlinkIpc } = require("./symlink.ipc");

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
}

module.exports = { registerIpcHandlers };
