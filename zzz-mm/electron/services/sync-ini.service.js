const fs = require("fs");
const path = require("path");

async function syncIniFromD3dx({ modFolderName, d3dxUserIniPath, modsRoot }) {
  // =========================
  // VALIDATIONS
  // =========================
  if (!modFolderName || !d3dxUserIniPath || !modsRoot) {
    throw new Error("Invalid payload");
  }

  if (!fs.existsSync(d3dxUserIniPath)) {
    throw new Error("d3dx_user.ini not found");
  }

  if (!fs.existsSync(modsRoot)) {
    throw new Error("Mods root folder not found");
  }

  // =========================
  // READ d3dx_user.ini
  // =========================
  const d3dxContent = fs.readFileSync(d3dxUserIniPath, "utf-8");
  const lines = d3dxContent.split(/\r?\n/);

  const iniMap = {};

  const regex = /^\$\\mods\\([^\\]+)\\(.+?\.ini)\\([a-zA-Z0-9_]+)\s*=\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(regex);
    if (!match) continue;

    const folder = match[1].trim();
    const relativeIniPath = match[2];
    const variable = match[3];
    const value = match[4];

    if (folder.toLowerCase() !== modFolderName.toLowerCase()) continue;

    if (!iniMap[relativeIniPath]) {
      iniMap[relativeIniPath] = {};
    }

    iniMap[relativeIniPath][variable] = value;
  }

  const iniFiles = Object.keys(iniMap);
  if (iniFiles.length === 0) {
    throw new Error("No matching entries found in d3dx_user.ini");
  }

  // =========================
  // APPLY TO EACH mod.ini
  // =========================
  for (const relativeIniPath of iniFiles) {
    const absoluteIniPath = path.join(modsRoot, modFolderName, relativeIniPath);

    if (!fs.existsSync(absoluteIniPath)) continue;

    const backupPath = `${absoluteIniPath}.bak-${Date.now()}`;
    fs.copyFileSync(absoluteIniPath, backupPath);

    const originalContent = fs.readFileSync(absoluteIniPath, "utf-8");
    const iniLines = originalContent.split(/\r?\n/);

    const valuesToApply = iniMap[relativeIniPath];
    let modified = false;
    let inConstantsSection = false;

    const updatedLines = iniLines.map((line) => {
      const trimmed = line.trim();

      const sectionMatch = trimmed.match(/^\[(.+?)\]$/);
      if (sectionMatch) {
        inConstantsSection = sectionMatch[1].toLowerCase() === "constants";
        return line;
      }

      if (!inConstantsSection) return line;

      const varMatch = line.match(
        /^\s*(global\s+persist\s+|global\s+)?\$(\w+)\s*=\s*(.+)$/
      );

      if (!varMatch) return line;

      const varName = varMatch[2];
      const lookupKey = varName.toLowerCase();

      if (Object.prototype.hasOwnProperty.call(valuesToApply, lookupKey)) {
        modified = true;
        const prefix = varMatch[1] ?? "";
        return `${prefix}$${varName} = ${valuesToApply[lookupKey]}`;
      }

      return line;
    });

    if (modified) {
      fs.writeFileSync(absoluteIniPath, updatedLines.join("\n"), "utf-8");
    }
  }

  return { success: true };
}

module.exports = { syncIniFromD3dx };
