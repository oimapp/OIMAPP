// Adds Firebase (for notifications from the church office) only when
// google-services.json has been put in this folder. Without it the app still builds.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, "google-services.json"))) {
    config.android = { ...config.android, googleServicesFile: "./google-services.json" };
  }
  return config;
};
