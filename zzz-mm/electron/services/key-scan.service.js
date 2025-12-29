const fs = require("fs");
const path = require("path");
const { VK_MAP, SYMBOL_MAP } = require("../../constants/keymaps").default;

function scanKeysForMod(modsRoot, folderName) {
  const seen = new Set();
  const modPath = path.join(modsRoot, folderName);

  if (!fs.existsSync(modPath)) {
    throw new Error("Mod folder not found");
  }

  const iniFiles = findIniFiles(modPath);
  const hotkeys = [];

  for (const ini of iniFiles) {
    const content = fs.readFileSync(ini, "utf-8");
    const blocks = splitIniBlocks(content);

    for (const block of blocks) {
      if (!isKeySwapBlock(block.lines)) continue;

      const parsed = parseKeySwapBlock(block.lines, block.name);
      if (!parsed) continue;

      const sig = `${parsed.block}|${parsed.key}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        hotkeys.push(parsed);
      }
    }
  }

  return hotkeys;
}

/* helpers aqui */

function findIniFiles(dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findIniFiles(fullPath, result);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".ini") &&
      !["d3dx.ini", "dxgi.ini"].includes(entry.name.toLowerCase())
    ) {
      result.push(fullPath);
    }
  }

  return result;
}

function splitIniBlocks(content) {
  const blocks = [];
  let current = null;

  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const headerMatch = line.match(/^\[(.+?)\]$/);

    if (headerMatch) {
      if (current) blocks.push(current);

      current = {
        name: headerMatch[1],
        lines: [],
      };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith(";")) {
        current.lines.push(trimmed);
      }
    }
  }

  if (current) blocks.push(current);

  return blocks;
}

function isKeySwapBlock(lines) {
  return (
    lines.some((l) => l.trim().toLowerCase().startsWith("key")) &&
    lines.some((l) => l.trim().startsWith("$"))
  );
}

function extractLabel(lines) {
  for (const line of lines) {
    const match = line.match(/^\$(\w+)\s*=/);
    if (!match) continue;

    const label = match[1];

    if (label.toLowerCase() === "active") continue;

    // tratar swapkey genérico
    if (/^swapkey\d+$/i.test(label)) {
      const index = label.match(/\d+/)?.[0];
      return `KeySwap${index ? ` #${index}` : ""}`;
    }

    return label;
  }

  return "KeySwap";
}

function parseKeySwapBlock(blockLines, blockName) {
  const keyLine = blockLines.find((l) => l.toLowerCase().startsWith("key"));
  if (!keyLine) return null;

  const rawKey = keyLine.split("=")[1].trim();
  const label = extractLabel(blockLines);

  return {
    description: label,
    key: normalizeKey(rawKey),
    source: "ini",
    block: blockName,
  };
}

function normalizeKey(raw) {
  if (!raw || typeof raw !== "string") return "";

  // separa por + ou espaço
  const tokens = raw
    .split(/[\s+]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const parts = [];

  // MODIFIERS
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (low === "ctrl" || low === "control") parts.push("CTRL");
    if (low === "shift") parts.push("SHIFT");
    if (low === "alt") parts.push("ALT");
  }

  // VK_*
  const vkToken = tokens.find((t) => t.toLowerCase().startsWith("vk_"));
  if (vkToken) {
    const vkKey = vkToken.toUpperCase();
    parts.push(VK_MAP[vkKey] ?? vkKey.replace("VK_", ""));
    return parts.join(" + ");
  }

  // TECLA LITERAL (1 char)
  const literal = tokens.find((t) => t.length === 1);
  if (literal) {
    parts.push(SYMBOL_MAP[literal] ?? literal.toUpperCase());
    return parts.join(" + ");
  }

  // NÚMEROS (ex: "8")
  const number = tokens.find((t) => /^[0-9]$/.test(t));
  if (number) {
    parts.push(number);
    return parts.join(" + ");
  }

  return parts.join(" + ");
}

module.exports = {
  scanKeysForMod,
};
