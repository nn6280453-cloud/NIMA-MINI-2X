// settings.js
import { getAllUserEnv, updateUserEnv, DEFAULTS } from './settingsdb.js';

// ✅ Per-user cache (multi-user safe)
const userCache = new Map();

export async function initEnvsettings(userId) {
  try {
    const data = await getAllUserEnv(userId);
    const merged = { ...DEFAULTS, ...data };
    if (!merged.CREATE_NB) merged.CREATE_NB = userId;
    userCache.set(userId, merged);
    console.log("⚙️ Settings loaded for user:", userId);
    return merged;
  } catch (err) {
    console.error("❌ initEnvsettings error:", err.message);
    const fallback = { ...DEFAULTS, CREATE_NB: userId };
    userCache.set(userId, fallback);
    return fallback;
  }
}

export function getSetting(userId, key) {
  if (!userId) return null;
  let s = userCache.get(userId);
  if (!s) {
    s = { ...DEFAULTS, CREATE_NB: userId };
    userCache.set(userId, s);
  }
  return s[key] ?? DEFAULTS[key] ?? null;
}

export async function setSetting(userId, key, value) {
  if (!userId) return;
  let s = userCache.get(userId) || { ...DEFAULTS, CREATE_NB: userId };
  s[key] = value;
  userCache.set(userId, s);
  try {
    await updateUserEnv(key, value, userId);
  } catch (err) {
    console.error("❌ setSetting save error:", err.message);
  }
}

export function getFullSettings(userId) {
  if (!userId) return { ...DEFAULTS };
  return userCache.get(userId) || { ...DEFAULTS, CREATE_NB: userId };
}

export function updateSetting(userId, key, value) {
  return setSetting(userId, key, value);
}
