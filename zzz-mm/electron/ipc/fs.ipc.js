const fs = require("fs");
const path = require("path");

function registerFsIpc(ipcMain) {
  ipcMain.handle("read-folder", async (_, folderPath) => {
    try {
      const files = await fs.promises.readdir(folderPath);
      return files;
    } catch (err) {
      console.error("read-folder FAILED: ", err);
      throw err;
    }
  });

  ipcMain.handle("read-json-file", async (_, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      console.error("READ_JSON_FILE_ERROR: ", err);
      throw err;
    }
  });

  ipcMain.handle("write-json-file", async (_, { filePath, data }) => {
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
}

module.exports = { registerFsIpc };
