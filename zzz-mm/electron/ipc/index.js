const { registerModHandlers } = require("./mod.handlers");
const { registerFsIpc } = require("./fs.ipc");
const { registerImageIpc } = require("./image.ipc");
const { registerConfigIpc } = require("./config.ipc");

function registerIpcHandlers(ipcMain, services, app) {
  registerModHandlers(ipcMain, services);
  registerFsIpc(ipcMain);
  registerImageIpc(ipcMain, services);
  registerConfigIpc(ipcMain, app);
}

module.exports = { registerIpcHandlers };
