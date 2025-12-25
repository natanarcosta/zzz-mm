const { IpcHandler } = require("../../shared/ipc.channels");

function registerSyncIniHandlers(ipcMain, { syncIniFromD3dx }) {
  ipcMain.handle(IpcHandler.SYNC_MOD_INI_FROM_D3DX, async (_, payload) => {
    try {
      return await syncIniFromD3dx(payload);
    } catch (err) {
      return {
        success: false,
        error: err.message || "Unknown error",
      };
    }
  });
}

module.exports = { registerSyncIniHandlers };
