const fs = require("fs");
const path = require("path");
const https = require("https");

function registerImageIpc(ipcMain, { sanitizeFileName }) {
  ipcMain.handle("load-image", async (_, filePath) => {
    try {
      const buffer = fs.readFileSync(filePath);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch (err) {
      console.error("LOAD_IMAGE_ERROR: ", err);
      throw err;
    }
  });

  ipcMain.handle(
    "download-image",
    async (_, { url, fileName, downloadPath }) => {
      const safeFileName = sanitizeFileName(fileName);
      const localDiskPath = path.join(downloadPath, safeFileName);

      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(localDiskPath);

        https
          .get(url, (response) => {
            if (response.statusCode !== 200) {
              reject(`Erro HTTP: ${response.statusCode}`);
              return;
            }

            response.pipe(file);

            file.on("finish", () => {
              file.close();
              resolve(localDiskPath);
            });
          })
          .on("error", (err) => {
            fs.unlink(localDiskPath, () => {});
            reject(err.message);
          });
      });
    }
  );
}

module.exports = { registerImageIpc };
