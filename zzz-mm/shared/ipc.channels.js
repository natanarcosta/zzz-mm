const IpcHandler = {
  // =====================
  // CONFIG
  // =====================
  LOAD_CONFIG: "load-config",
  SAVE_CONFIG: "save-config",

  // =====================
  // FILE SYSTEM
  // =====================
  READ_FOLDER: "read-folder",
  READ_JSON_FILE: "read-json-file",
  WRITE_JSON_FILE: "write-json-file",

  // =====================
  // IMAGE / PREVIEW
  // =====================
  LOAD_IMAGE: "load-image",
  SAVE_MOD_PREVIEW: "save-mod-preview",
  DOWNLOAD_IMAGE: "download_image",

  // =====================
  // MODS
  // =====================
  SCAN_MOD_KEYS: "scan-mod-keys",
  INSTALL_MOD: "install-mod",
  EXTRACT_MOD_UPDATE: "extract-mod-update",
  SYNC_MOD_INI_FROM_D3DX: "sync-mod-ini-from-d3dx",

  // =====================
  // SYMLINK
  // =====================
  CREATE_SYMLINK: "create-symlink",
  REMOVE_SYMLINK: "remove-symlink",

  // =====================
  // SYSTEM
  // =====================
  OPEN_EXTERNAL_URL: "open-external-url",
  SELECT_DIRECTORY: "select-directory",
  OPEN_MOD_FOLDER: "open-mod-folder",
  APP_QUIT: "app-quit",
  GET_APP_VERSION: "get-app-version",
};

module.exports = { IpcHandler };
