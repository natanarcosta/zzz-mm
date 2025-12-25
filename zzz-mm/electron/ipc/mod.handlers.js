function registerModHandlers(ipcMain, services) {
  const { scanKeysForMod, extractModUpdate, installMod, saveModPreview } =
    services;

  ipcMain.handle("scan-mod-keys", async (_, payload) => {
    try {
      const hotkeys = scanKeysForMod(payload.modsRoot, payload.folderName);
      return { success: true, hotkeys };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("install-mod", (_, payload) => installMod(payload));
  ipcMain.handle("extract-mod-update", async (_, payload) => {
    extractModUpdate(payload);
  });
  ipcMain.handle("save-mod-preview", (_, payload) => saveModPreview(payload));
}

module.exports = { registerModHandlers };
