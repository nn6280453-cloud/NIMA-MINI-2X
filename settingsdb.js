// settingsdb.js
const axios = require('axios');

const BASE_URL = 'https://shriiy-default-rtdb.asia-southeast1.firebasedatabase.app';

async function updateUserEnv(key, value, userId) {
  if (!userId) throw new Error("User ID missing");
  const res = await axios.put(`${BASE_URL}/${userId}/${key}.json`, JSON.stringify(value));
  return res.data;
}

async function getUserEnv(key, userId) {
  if (!userId) throw new Error("User ID missing");
  const res = await axios.get(`${BASE_URL}/${userId}/${key}.json`);
  return res.data;
}

async function getAllUserEnv(userId) {
  if (!userId) throw new Error("User ID missing");
  const res = await axios.get(`${BASE_URL}/${userId}.json`);
  return res.data || {};
}

// ✅ Default settings
const DEFAULTS = {
  AUTO_REACT: "off",
  PRESENCE_TYPE: "on",
  PRESENCE_FAKE: "both",
  ANTI_CALL: "on",             // auto reject incoming calls (.settings → ANTI CALL)
  ANTI_DELETE: "on",
  CONNECT_MSG: "on",            // connect message ON/OFF (.settings → CONNECT MSG)
  CREATE_NB: null,
  // ===== New settings =====
  BOT_MODE: "public",           // public | private | groups
  AUTO_STATUS_VIEW: "on",
  AUTO_STATUS_REACT: "on",
  AUTO_RECORDING: "on",
  AI_MODE: "off",
  AUTO_MSG_REACT: "off",        // auto react (random emoji) to every incoming message (.settings → MSG REACT)
  AUTO_SAVE_CONTACT: "off",     // save unsaved numbers (msg/call) with their WhatsApp name (.settings → AUTO SAVE CONTACT)
  // ===== Channel Status =====
  STATUS_CHANNEL: ""            // <channelJid>@newsletter — .setchannel එකෙන් save වෙනවා
};

// ⚡ faster: ONE read for all keys, then missing keys are written in parallel
async function initUserEnvIfMissing(userId) {
  if (!userId) {
    console.error("❌ User ID is missing");
    return;
  }

  let existing = {};
  try {
    existing = await getAllUserEnv(userId);
  } catch (e) {
    console.error("❌ Failed to read settings:", e.message);
    return;
  }

  const missing = Object.keys(DEFAULTS).filter(
    (key) => existing[key] === null || existing[key] === undefined
  );

  await Promise.all(missing.map(async (key) => {
    let defVal = DEFAULTS[key];
    if (key === 'CREATE_NB') defVal = userId;
    try {
      await updateUserEnv(key, defVal, userId);
      console.log(`✅ Initialized [${userId}] ${key} = ${defVal}`);
    } catch (e) {
      console.error(`❌ Failed to init ${key}:`, e.message);
    }
  }));
}

module.exports = {
  updateUserEnv,
  getUserEnv,
  getAllUserEnv,
  initUserEnvIfMissing,
  DEFAULTS
};
