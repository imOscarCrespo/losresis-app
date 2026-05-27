import { Platform } from "react-native";
import Constants from "expo-constants";

let Purchases = null;
let initialized = false;
let initFailed = false;

// Lazy-require so the dev client without the native module installed yet
// doesn't crash at import time.
function loadPurchases() {
  if (Purchases || initFailed) return Purchases;
  try {
    Purchases = require("react-native-purchases").default;
  } catch (err) {
    initFailed = true;
    console.warn(
      "[revenuecat] react-native-purchases not available. Build a dev client with the SDK to enable payments.",
      err?.message
    );
  }
  return Purchases;
}

function getApiKey() {
  const cfg = Constants.expoConfig?.extra?.revenuecat;
  if (!cfg) return null;
  return Platform.OS === "ios" ? cfg.iosKey : cfg.androidKey;
}

export async function initRevenueCat() {
  if (initialized || initFailed) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[revenuecat] missing API key; skipping init.");
    initFailed = true;
    return;
  }
  const P = loadPurchases();
  if (!P) return;
  try {
    if (typeof P.setLogLevel === "function") {
      P.setLogLevel(__DEV__ ? "DEBUG" : "WARN");
    }
    P.configure({ apiKey });
    initialized = true;
  } catch (err) {
    console.warn("[revenuecat] configure failed:", err?.message);
    initFailed = true;
  }
}

export async function identifyRcUser(supabaseUserId) {
  if (!supabaseUserId) return null;
  const P = loadPurchases();
  if (!P || !initialized) return null;
  try {
    const { customerInfo } = await P.logIn(supabaseUserId);
    return customerInfo ?? null;
  } catch (err) {
    console.warn("[revenuecat] logIn failed:", err?.message);
    return null;
  }
}

export async function logoutRcUser() {
  const P = loadPurchases();
  if (!P || !initialized) return;
  try {
    await P.logOut();
  } catch (err) {
    // Ignored: logOut throws if anonymous, harmless.
  }
}

export function getPurchases() {
  return loadPurchases();
}

export function isRevenueCatReady() {
  return initialized;
}
