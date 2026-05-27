const { expo } = require("./app.json");

const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON || expo.android?.googleServicesFile;

module.exports = {
  ...expo,
  android: {
    ...expo.android,
    googleServicesFile,
  },
  extra: {
    ...expo.extra,
    revenuecat: {
      iosKey: process.env.EXPO_PUBLIC_RC_API_KEY_IOS || null,
      androidKey: process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID || null,
    },
  },
};
