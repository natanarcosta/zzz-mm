const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");

const { sanitizeFileName, sanitizeFolderName } =
  require("./utils/sanitize").default;
const { scanKeysForMod } = require("./electron/services/key-scan.service");
const {
  createModInstaller,
} = require("./electron/services/mod-install.service");

const { registerIpcHandlers } = require("./electron/ipc");

var nodeConsole = require("console");
// eslint-disable-next-line no-unused-vars
var myConsole = new nodeConsole.Console(process.stdout, process.stderr);

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED PROMISE:", reason);
});

try {
  require("electron-reloader")(module);
} catch {
  /* empty */
}

let mainWindow;
const isDev = !app.isPackaged;
app.commandLine.appendSwitch("lang", "en-US");

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

  if (isDev) {
    mainWindow.loadURL("http://localhost:4200/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, "dist/browser/index.html"),
        protocol: "file:",
        slashes: true,
      })
    );

    // mainWindow.webContents.openDevTools();
    mainWindow.setMenu(null);
  }

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  const installer = createModInstaller({
    isDev,
    sanitizeFolderName,
    scanKeysForMod,
  });

  registerIpcHandlers(
    ipcMain,
    {
      scanKeysForMod,
      installMod: installer.installMod,
      extractModUpdate: installer.extractModUpdate,
      sanitizeFileName,
    },
    app
  );

  ipcMain.handle("open-external-url", async (_, url) => {
    await shell.openExternal(url);
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

  ipcMain.handle(
    "sync-mod-ini-from-d3dx",
    async (_, { modFolderName, d3dxUserIniPath, modsRoot }) => {
      try {
        // =========================
        // VALIDATIONS
        // =========================
        if (!modFolderName || !d3dxUserIniPath || !modsRoot) {
          return { success: false, error: "Invalid payload" };
        }

        if (!fs.existsSync(d3dxUserIniPath)) {
          return { success: false, error: "d3dx_user.ini not found" };
        }

        if (!fs.existsSync(modsRoot)) {
          return { success: false, error: "Mods root folder not found" };
        }

        // =========================
        // READ d3dx_user.ini
        // =========================
        const d3dxContent = fs.readFileSync(d3dxUserIniPath, "utf-8");
        const lines = d3dxContent.split(/\r?\n/);

        /**
         * Structure:
         * {
         *   "relative/path/to/file.ini": {
         *     variable: value
         *   }
         * }
         */
        const iniMap = {};

        // Regex:
        // $\mods\<modFolder>\<path>\<file>.ini\<variable> = <value>
        const regex =
          /^\$\\mods\\([^\\]+)\\(.+?\.ini)\\([a-zA-Z0-9_]+)\s*=\s*(.+)$/;

        for (const line of lines) {
          const match = line.match(regex);
          if (!match) continue;

          const folder = match[1].trim();
          const relativeIniPath = match[2];
          const variable = match[3];
          const value = match[4];

          // Only target the selected mod folder
          if (folder.toLowerCase() !== modFolderName.toLowerCase()) continue;

          if (!iniMap[relativeIniPath]) {
            iniMap[relativeIniPath] = {};
          }

          iniMap[relativeIniPath][variable] = value;
        }

        const iniFiles = Object.keys(iniMap);
        if (iniFiles.length === 0) {
          return {
            success: false,
            error: "No matching entries found in d3dx_user.ini",
          };
        }

        // =========================
        // APPLY TO EACH mod.ini
        // =========================
        for (const relativeIniPath of iniFiles) {
          const absoluteIniPath = path.join(
            modsRoot,
            modFolderName,
            relativeIniPath
          );

          if (!fs.existsSync(absoluteIniPath)) {
            // Skip silently — mod might have optional ini
            continue;
          }

          // Backup
          const backupPath = absoluteIniPath + `.bak-${Date.now().toString()}`;
          fs.copyFileSync(absoluteIniPath, backupPath);

          const originalContent = fs.readFileSync(absoluteIniPath, "utf-8");
          const iniLines = originalContent.split(/\r?\n/);

          const valuesToApply = iniMap[relativeIniPath];
          let modified = false;

          let inConstantsSection = false;

          const updatedLines = iniLines.map((line) => {
            const trimmed = line.trim();

            // Detect section headers
            const sectionMatch = trimmed.match(/^\[(.+?)\]$/);
            if (sectionMatch) {
              inConstantsSection =
                sectionMatch[1].toLowerCase() === "constants";
              return line;
            }

            if (!inConstantsSection) {
              return line;
            }

            // Match ONLY constant declarations
            const varMatch = line.match(
              /^\s*(global\s+persist\s+|global\s+)?\$(\w+)\s*=\s*(.+)$/
            );

            if (!varMatch) return line;

            const varName = varMatch[2];

            if (Object.prototype.hasOwnProperty.call(valuesToApply, varName)) {
              modified = true;

              const prefix = varMatch[1] ?? "";
              return `${prefix}$${varName} = ${valuesToApply[varName]}`;
            }

            return line;
          });

          if (modified) {
            fs.writeFileSync(absoluteIniPath, updatedLines.join("\n"), "utf-8");
          }
        }

        return { success: true };
      } catch (err) {
        console.error("SYNC MOD INI ERROR:", err);
        return {
          success: false,
          error: err.message || "Unknown error",
        };
      }
    }
  );

  ipcMain.handle(
    "save-mod-preview",
    async (_, { sourcePath, modFolderPath }) => {
      try {
        if (!sourcePath || !modFolderPath) {
          return { success: false, error: "Invalid payload" };
        }

        if (!fs.existsSync(sourcePath)) {
          return { success: false, error: "Source file not found" };
        }

        const ext = path.extname(sourcePath).toLowerCase();
        if (![".png", ".jpg", ".jpeg"].includes(ext)) {
          return { success: false, error: "Invalid image format" };
        }

        const targetPath = path.join(modFolderPath, "preview.jpg");

        fs.copyFileSync(sourcePath, targetPath);

        return { success: true, previewPath: targetPath };
      } catch (err) {
        console.error("SAVE MOD PREVIEW ERROR:", err);
        return { success: false, error: err.message };
      }
    }
  );

  ipcMain.handle("app-quit", () => {
    app.quit();
  });

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });
}
app.on("ready", createWindow);
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
