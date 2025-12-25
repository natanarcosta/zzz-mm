function registerSyncIniHandlers(ipcMain, { syncIniFromD3dx }) {
  ipcMain.handle("sync-mod-ini-from-d3dx", async (_, payload) => {
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
