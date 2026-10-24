// Lets the app carry the Bible text files (.txt) inside the APK.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("txt");

module.exports = config;
