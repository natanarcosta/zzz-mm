const { app, BrowserWindow, ipcMain } = require("electron");
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
const { syncIniFromD3dx } = require("./electron/services/sync-ini.service");

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
      syncIniFromD3dx,
    },
    app
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
}
app.on("ready", createWindow);
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
