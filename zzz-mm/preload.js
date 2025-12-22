const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  readFolder: (folderPath) => ipcRenderer.invoke("read-folder", folderPath),
  readJsonfile: (path) => ipcRenderer.invoke("read-json-file", path),
  loadImage: (path) => ipcRenderer.invoke("load-image", path),
  openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),
  downloadImage: (url, fileName, downloadPath) =>
    ipcRenderer.invoke("download-image", { url, fileName, downloadPath }),
  writeJsonFile: (filePath, data) =>
    ipcRenderer.invoke("write-json-file", { filePath, data }),
  loadConfig: () => ipcRenderer.invoke("load-config"),
  saveConfig: (data) => ipcRenderer.invoke("save-config", data),
  createSymlink: (target, linkPath) =>
    ipcRenderer.invoke("create-symlink", { target, linkPath }),
  removeSymlink: (linkPath) => ipcRenderer.invoke("remove-symlink", linkPath),
  installMod: (data) => ipcRenderer.invoke("install-mod", data),
  getFilePath: (file) => webUtils.getPathForFile(file),
});

contextBridge.exposeInMainWorld("isElectron", true);

window.addEventListener("DOMContentLoaded", () => {
  window.dispatchEvent(new Event("electron-ready"));
});
