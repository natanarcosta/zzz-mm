const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { unrar } = require("unrar-promise");

async function extractZip(zipPath, dest) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
}

async function extractRar(rarPath, dest, unrarPath) {
  if (unrarPath) {
    await unrar(rarPath, dest, { unrarPath });
  } else {
    await unrar(rarPath, dest); // DEV → usa unrar do sistema
  }
}

function unwrapSingleFolder(dir) {
  let current = dir;

  while (true) {
    const entries = fs.readdirSync(current);
    if (entries.length !== 1) break;

    const next = path.join(current, entries[0]);
    if (!fs.statSync(next).isDirectory()) break;

    current = next;
  }

  return current;
}

module.exports = {
  extractZip,
  extractRar,
  unwrapSingleFolder,
};
