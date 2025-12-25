// webpack.config.js
const path = require("path");

const isProd = process.env.NODE_ENV === "production";

module.exports = [
  // ===============================
  // PRELOAD (OBRIGATÓRIO bundle)
  // ===============================
  {
    entry: "./preload.js",
    target: "electron-preload",
    mode: isProd ? "production" : "development",
    output: {
      filename: "preload.bundle.js",
      path: path.resolve(__dirname, "dist"),
    },
    externals: {
      electron: "commonjs2 electron",
    },
  },
];
