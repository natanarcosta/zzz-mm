function registerModHandlers(ipcMain, services) {
  const { scanKeysForMod } = services;

  ipcMain.handle("scan-mod-keys", async (_, payload) => {
    try {
      const hotkeys = scanKeysForMod(payload.modsRoot, payload.folderName);
      return { success: true, hotkeys };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerModHandlers };
