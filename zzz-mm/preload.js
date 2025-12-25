/* eslint-disable no-undef */
const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { IpcHandler } = require("./shared/ipc.channels");

contextBridge.exposeInMainWorld("electronAPI", {
  readFolder: (folderPath) =>
    ipcRenderer.invoke(IpcHandler.READ_FOLDER, folderPath),
  readJsonfile: (path) => ipcRenderer.invoke(IpcHandler.READ_JSON_FILE, path),
  loadImage: (path) => ipcRenderer.invoke(IpcHandler.LOAD_IMAGE, path),
  openExternalUrl: (url) =>
    ipcRenderer.invoke(IpcHandler.OPEN_EXTERNAL_URL, url),
  downloadImage: (url, fileName, downloadPath) =>
    ipcRenderer.invoke(IpcHandler.DOWNLOAD_IMAGE, {
      url,
      fileName,
      downloadPath,
    }),
  writeJsonFile: (filePath, data) =>
    ipcRenderer.invoke(IpcHandler.WRITE_JSON_FILE, { filePath, data }),
  loadConfig: () => ipcRenderer.invoke(IpcHandler.LOAD_CONFIG),
  saveConfig: (data) => ipcRenderer.invoke(IpcHandler.SAVE_CONFIG, data),
  createSymlink: (target, linkPath) =>
    ipcRenderer.invoke(IpcHandler.CREATE_SYMLINK, { target, linkPath }),
  removeSymlink: (linkPath) =>
    ipcRenderer.invoke(IpcHandler.REMOVE_SYMLINK, linkPath),
  installMod: (data) => ipcRenderer.invoke(IpcHandler.INSTALL_MOD, data),
  getFilePath: (file) => webUtils.getPathForFile(file),
  selectDirectory: (options) =>
    ipcRenderer.invoke(IpcHandler.SELECT_DIRECTORY, options),
  extractModForUpdate: (zipPath, targetFolder, baseModsDir) =>
    ipcRenderer.invoke(IpcHandler.EXTRACT_MOD_UPDATE, {
      zipPath,
      targetFolder,
      baseModsDir,
    }),
  scanModKeys: (modsRoot, folderName) =>
    ipcRenderer.invoke(IpcHandler.SCAN_MOD_KEYS, { modsRoot, folderName }),
  openModFolder: (payload) =>
    ipcRenderer.invoke(IpcHandler.OPEN_MOD_FOLDER, payload),
  syncModIniFromUser: (modFolderName, d3dxUserIniPath, modsRoot) =>
    ipcRenderer.invoke(
      IpcHandler.SYNC_MOD_INI_FROM_D3DX,
      modFolderName,
      d3dxUserIniPath,
      modsRoot
    ),
  quitApp: () => ipcRenderer.invoke(IpcHandler.APP_QUIT),
  getAppVersion: () => ipcRenderer.invoke(IpcHandler.GET_APP_VERSION),
  saveModPreview: (payload) =>
    ipcRenderer.invoke(IpcHandler.SAVE_MOD_PREVIEW, payload),
});

contextBridge.exposeInMainWorld("isElectron", true);

window.addEventListener("DOMContentLoaded", () => {
  window.dispatchEvent(new Event("electron-ready"));
});
