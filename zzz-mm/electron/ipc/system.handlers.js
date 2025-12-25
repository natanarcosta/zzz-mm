const path = require("path");
const fs = require("fs");

function registerSystemHandlers(ipcMain, { app, shell, dialog }) {
  ipcMain.handle("open-external-url", async (_, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle("select-directory", async (_, options) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      ...options,
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("open-mod-folder", async (_, { modsRoot, folderName }) => {
    try {
      const fullPath = path.join(modsRoot, folderName);

      if (!fs.existsSync(fullPath)) {
        return { success: false, error: "Mod folder not found" };
      }

      await shell.openPath(fullPath);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("app-quit", () => {
    app.quit();
  });

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });
}

module.exports = { registerSystemHandlers };
