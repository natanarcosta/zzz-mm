const { registerModHandlers } = require("./mod.handlers");
const { registerFsIpc } = require("./fs.ipc");
const { registerImageIpc } = require("./image.ipc");

function registerIpcHandlers(ipcMain, services) {
  registerModHandlers(ipcMain, services);
  registerFsIpc(ipcMain);
  registerImageIpc(ipcMain, services);
}

module.exports = { registerIpcHandlers };
