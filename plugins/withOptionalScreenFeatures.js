// Play Console infiere android.hardware.screen.portrait como obligatoria a partir de
// screenOrientation="portrait" y bloquea el envío a revisión porque excluye tablets,
// Chromebooks y Android XR. La declaramos opcional: la app sigue bloqueada en vertical.
const { withAndroidManifest } = require("@expo/config-plugins");

const FEATURES = ["android.hardware.screen.portrait", "android.hardware.screen.landscape"];

module.exports = function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest["uses-feature"] = manifest["uses-feature"] || [];
    for (const name of FEATURES) {
      const existing = manifest["uses-feature"].find((f) => f.$["android:name"] === name);
      if (existing) existing.$["android:required"] = "false";
      else manifest["uses-feature"].push({ $: { "android:name": name, "android:required": "false" } });
    }
    return cfg;
  });
};
