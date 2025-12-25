function registerModHandlers(ipcMain, services) {
  const { scanKeysForMod, extractModUpdate, installMod } = services;

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
}

module.exports = { registerModHandlers };
