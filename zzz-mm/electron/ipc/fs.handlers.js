const fs = require("fs");
const path = require("path");
const { IpcHandler } = require("../../shared/ipc.channels");

function registerFsIpc(ipcMain) {
  ipcMain.handle(IpcHandler.READ_FOLDER, async (_, folderPath) => {
    try {
      const files = await fs.promises.readdir(folderPath);
      return files;
    } catch (err) {
      console.error("read-folder FAILED: ", err);
      throw err;
    }
  });

  ipcMain.handle(IpcHandler.READ_JSON_FILE, async (_, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      console.error("READ_JSON_FILE_ERROR: ", err);
      throw err;
    }
  });

  ipcMain.handle(IpcHandler.WRITE_JSON_FILE, async (_, { filePath, data }) => {
    try {
      const finalPath = filePath.endsWith(".json")
        ? filePath
        : `${filePath}.json`;

      fs.mkdirSync(path.dirname(finalPath), { recursive: true });

      //  escreve JSON formatado
      fs.writeFileSync(finalPath, JSON.stringify(data, null, 2), "utf-8");

      return { success: true, path: finalPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IpcHandler.FOLDER_SIZE, async (_, folderPath) => {
    function getSize(p) {
      try {
        const stat = fs.statSync(p);
        if (stat.isFile()) return stat.size;
        if (stat.isDirectory()) {
          let total = 0;
          const entries = fs.readdirSync(p, { withFileTypes: true });
          for (const e of entries) {
            const child = path.join(p, e.name);
            total += getSize(child);
          }
          return total;
        }
        return 0;
      } catch {
        return 0;
      }
    }

    try {
      const size = getSize(folderPath);
      return { success: true, size };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IpcHandler.DELETE_FOLDER, async (_, folderPath) => {
    try {
      if (!folderPath || typeof folderPath !== "string") {
        return { success: false, error: "Invalid folder path" };
      }
      if (!fs.existsSync(folderPath)) {
        return { success: true };
      }
      fs.rmSync(folderPath, { recursive: true, force: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerFsIpc };
