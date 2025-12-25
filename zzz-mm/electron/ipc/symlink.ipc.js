// electron/ipc/symlink.ipc.js
const fs = require("fs");
const path = require("path");
const { IpcHandler } = require("../../shared/ipc.channels");

function registerSymlinkIpc(ipcMain) {
  ipcMain.handle(IpcHandler.CREATE_SYMLINK, async (_, { target, linkPath }) => {
    try {
      // Garante que a pasta pai do link exista
      fs.mkdirSync(path.dirname(linkPath), { recursive: true });

      // Remove link existente (se houver)
      if (fs.existsSync(linkPath)) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }

      // Windows → junction é o mais seguro
      const type = process.platform === "win32" ? "junction" : "dir";

      fs.symlinkSync(target, linkPath, type);

      return { success: true };
    } catch (err) {
      console.error("CREATE_SYMLINK_ERROR:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IpcHandler.REMOVE_SYMLINK, async (_, linkPath) => {
    try {
      if (!fs.existsSync(linkPath)) {
        return { success: true }; // já não existe
      }

      const stat = fs.lstatSync(linkPath);

      if (stat.isSymbolicLink()) {
        // Symlink normal
        fs.unlinkSync(linkPath);
      } else if (stat.isDirectory()) {
        // Junction no Windows aparece como diretório
        fs.rmSync(linkPath, { recursive: true, force: true });
      } else {
        return {
          success: false,
          error: "O caminho não é um symlink",
        };
      }

      return { success: true };
    } catch (err) {
      console.error("REMOVE_SYMLINK_ERROR:", err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSymlinkIpc };
