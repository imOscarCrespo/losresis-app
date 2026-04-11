const { expo } = require("./app.json");

const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON || expo.android?.googleServicesFile;

module.exports = {
  ...expo,
  android: {
    ...expo.android,
    googleServicesFile,
  },
};
