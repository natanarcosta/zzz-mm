const { registerModHandlers } = require("./mod.handlers");
const { registerFsIpc } = require("./fs.ipc");

function registerIpcHandlers(ipcMain, services) {
  registerModHandlers(ipcMain, services);
  registerFsIpc(ipcMain);
}

module.exports = { registerIpcHandlers };
