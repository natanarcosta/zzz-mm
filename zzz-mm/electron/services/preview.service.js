const fs = require("fs");
const path = require("path");

async function saveModPreview({ sourcePath, modFolderPath }) {
  if (!sourcePath || !modFolderPath) {
    throw new Error("Invalid payload");
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error("Source file not found");
  }

  const ext = path.extname(sourcePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) {
    throw new Error("Invalid image format");
  }

  const targetPath = path.join(modFolderPath, "preview.jpg");

  fs.copyFileSync(sourcePath, targetPath);

  return { success: true, previewPath: targetPath };
}

module.exports = { saveModPreview };
