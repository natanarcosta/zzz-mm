const { app, BrowserWindow, ipcMain } = require("electron");
const url = require("url");
const path = require("path");
const { registerIpcHandlers } = require("./electron/ipc");
const Services = require("./electron/services");

const { sanitizeFileName, sanitizeFolderName } =
  require("./utils/sanitize").default;

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
      preload: path.join(__dirname, "dist/preload.bundle.js"),
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

  const installer = Services.createModInstaller({
    isDev,
    sanitizeFolderName,
    scanKeysForMod: Services.scanKeysForMod,
  });

  registerIpcHandlers(
    ipcMain,
    {
      scanKeysForMod: Services.scanKeysForMod,
      installMod: installer.installMod,
      extractModUpdate: installer.extractModUpdate,
      sanitizeFileName,
      syncIniFromD3dx: Services.syncIniFromD3dx,
      saveModPreview: Services.saveModPreview,
    },
    app
  );
}
app.on("ready", createWindow);
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
