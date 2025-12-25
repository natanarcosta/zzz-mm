const path = require("path");
const fs = require("fs");
const { IpcHandler } = require("../../shared/ipc.channels");

function registerSystemHandlers(ipcMain, { app, shell, dialog }) {
  ipcMain.handle(IpcHandler.OPEN_EXTERNAL_URL, async (_, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(IpcHandler.SELECT_DIRECTORY, async (_, options) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      ...options,
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    IpcHandler.OPEN_MOD_FOLDER,
    async (_, { modsRoot, folderName }) => {
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
    }
  );

  ipcMain.handle(IpcHandler.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.handle(IpcHandler.GET_APP_VERSION, () => {
    return app.getVersion();
  });
}

module.exports = { registerSystemHandlers };
