const { IpcHandler } = require("../../shared/ipc.channels");

function registerModHandlers(ipcMain, services) {
  const { scanKeysForMod, extractModUpdate, installMod, saveModPreview } =
    services;

  ipcMain.handle(IpcHandler.SCAN_MOD_KEYS, async (_, payload) => {
    try {
      const hotkeys = scanKeysForMod(payload.modsRoot, payload.folderName);
      return { success: true, hotkeys };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle(IpcHandler.INSTALL_MOD, (_, payload) => installMod(payload));
  ipcMain.handle(IpcHandler.EXTRACT_MOD_UPDATE, async (_, payload) => {
    extractModUpdate(payload);
  });
  ipcMain.handle(IpcHandler.SAVE_MOD_PREVIEW, (_, payload) =>
    saveModPreview(payload)
  );
}

module.exports = { registerModHandlers };
