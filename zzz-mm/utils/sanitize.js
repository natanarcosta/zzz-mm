import { extname } from "path";

function sanitizeFileName(name) {
  if (!name || typeof name !== "string") return "file";

  let sanitized = name
    .replace(/[\\/?%*:|"<>]/g, "_")
    .replace(/\p{Cc}/gu, "")
    .trim();

  if (!sanitized || sanitized === "." || sanitized === "..") {
    sanitized = "file";
  }

  sanitized = sanitized.replace(/[. ]+$/, "");

  if (sanitized.length > 120) {
    const ext = extname(sanitized);
    sanitized = sanitized.slice(0, 120 - ext.length) + ext;
  }

  return sanitized;
}

function sanitizeFolderName(name) {
  if (!name || typeof name !== "string") return "mod";

  let sanitized = name
    .replace(/[\\/?%*:|"<>]/g, "-")
    .replace(/\p{Cc}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "mod";
  if (sanitized.length > 80) sanitized = sanitized.slice(0, 80);

  return sanitized;
}

export default {
  sanitizeFileName,
  sanitizeFolderName,
};
