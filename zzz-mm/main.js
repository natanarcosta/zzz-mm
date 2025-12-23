const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");
const https = require("https");
const AdmZip = require("adm-zip");
const { unrar } = require("unrar-promise");

try {
  require("electron-reloader")(module);
} catch {}

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:4200/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, `/dist/zzz-mm/browser/index.html`),
        protocol: "file:",
        slashes: true,
      })
    );

    mainWindow.webContents.openDevTools();
    // mainWindow.setMenu(null);
  }

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  ipcMain.handle("read-folder", async (event, folderPath) => {
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

  ipcMain.handle("load-image", async (_, filePath) => {
    try {
      const buffer = fs.readFileSync(filePath);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch (err) {
      console.error("LOAD_IMAGE_ERROR: ", err);
      throw err;
    }
  });

  ipcMain.handle("open-external-url", async (_, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(
    "download-image",
    async (_, { url, fileName, downloadPath }) => {
      const localDiskPath = path.join(downloadPath, fileName);

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

  ipcMain.handle("write-json-file", async (_, { filePath, data }) => {
    try {
      const finalPath = filePath.endsWith(".json")
        ? filePath
        : `${filePath}.json`;

      fs.mkdirSync(path.dirname(finalPath), { recursive: true });

      // 🧾 escreve JSON formatado
      fs.writeFileSync(finalPath, JSON.stringify(data, null, 2), "utf-8");

      return { success: true, path: finalPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

  ipcMain.handle("load-config", async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        source_mods_folder: "",
        mod_links_folder: "",
        blur: false,
        navbar_type: "list",
      };

      fs.writeFileSync(
        CONFIG_PATH,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8"
      );

      return defaultConfig;
    }

    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  });

  ipcMain.handle("save-config", async (_, data) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  });

  ipcMain.handle("create-symlink", async (_, { target, linkPath }) => {
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

  ipcMain.handle("remove-symlink", async (_, linkPath) => {
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

  async function extractZip(zipPath, dest) {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dest, true);
  }

  const unrarPath = isDev
    ? undefined // usa sistema
    : path.join(process.resourcesPath, "unrar", "unrar.exe");

  async function extractRar(rarPath, dest) {
    await unrar(rarPath, dest, { unrarPath });
  }

  function getRootFolder(tempDir) {
    const entries = fs.readdirSync(tempDir);

    if (entries.length === 1) {
      const fullPath = path.join(tempDir, entries[0]);
      if (fs.statSync(fullPath).isDirectory()) {
        return {
          path: fullPath,
          name: entries[0],
          isWrapped: true,
        };
      }
    }

    return {
      path: tempDir,
      name: null,
      isWrapped: false,
    };
  }

  function moveFolderContents(src, dest) {
    for (const entry of fs.readdirSync(src)) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      fs.cpSync(srcPath, destPath, { recursive: true });
    }
  }

  ipcMain.handle("install-mod", async (_, data) => {
    const { archivePath, destinationPath, modData } = data;

    if (!archivePath || !destinationPath || !modData?.modName) {
      throw new Error("Payload inválido");
    }

    const ext = path.extname(archivePath).toLowerCase();
    const tempDir = path.join(destinationPath, "__temp__");

    fs.mkdirSync(tempDir, { recursive: true });

    try {
      if (ext === ".zip") {
        await extractZip(archivePath, tempDir);
      } else if (ext === ".rar") {
        await extractRar(archivePath, tempDir);
      } else {
        throw new Error("Formato não suportado");
      }

      const root = getRootFolder(tempDir);
      const finalPath = path.join(destinationPath, modData.modName);

      if (fs.existsSync(finalPath)) {
        throw new Error("Já existe um mod com esse nome");
      }

      fs.mkdirSync(finalPath, { recursive: true });

      // Preserva pasta raiz do mod
      if (root.isWrapped) {
        const targetFolder = path.join(finalPath, root.name);
        fs.cpSync(root.path, targetFolder, { recursive: true });
      } else {
        // Edge case: arquivos soltos
        moveFolderContents(root.path, finalPath);
      }

      const modJsonPath = path.join(finalPath, "mod.json");
      fs.writeFileSync(modJsonPath, JSON.stringify(modData, null, 2), "utf-8");

      return { success: true };
    } catch (err) {
      console.error("INSTALL MOD ERROR:", err);
      throw err;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  ipcMain.handle("select-directory", async (event, options) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.getFocusedWindow(),
      {
        properties: ["openDirectory"], // This property enables folder selection
        ...options,
      }
    );

    if (result.canceled) {
      return null; // or handle cancellation as needed
    } else {
      // result.filePaths is an array of selected paths
      return result.filePaths[0]; // Return the first selected path
    }
  });
}
app.on("ready", createWindow);
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
