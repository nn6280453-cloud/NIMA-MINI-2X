// settingsdb.js
import axios from 'axios';

const BASE_URL = 'https://shriiy-default-rtdb.asia-southeast1.firebasedatabase.app';

export async function updateUserEnv(key, value, userId) {
  if (!userId) throw new Error("User ID missing");
  const res = await axios.put(`${BASE_URL}/${userId}/${key}.json`, JSON.stringify(value));
  return res.data;
}

export async function getUserEnv(key, userId) {
  if (!userId) throw new Error("User ID missing");
  const res = await axios.get(`${BASE_URL}/${userId}/${key}.json`);
  return res.data;
}

export async function getAllUserEnv(userId) {
  if (!userId) throw new Error("User ID missing");
  const res = await axios.get(`${BASE_URL}/${userId}.json`);
  return res.data || {};
}

// ✅ Default settings
export const DEFAULTS = {
  AUTO_REACT: "off",
  PRESENCE_TYPE: "on",
  PRESENCE_FAKE: "both",
  ANTI_CALL: "on",             // auto reject incoming calls (.settings → ANTI CALL)
  AUTO_ANSWER: "off",           // auto answer calls with the welcome audio, then hang up (.settings → AUTO ANSWER)
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
  // ===== Channel Status =====
  STATUS_CHANNEL: ""            // <channelJid>@newsletter — .setchannel එකෙන් save වෙනවා
};

export async function initUserEnvIfMissing(userId) {
  if (!userId) {
    console.error("❌ User ID is missing");
    return;
  }

  for (const key in DEFAULTS) {
    let defVal = DEFAULTS[key];
    if (key === 'CREATE_NB') defVal = userId;

    try {
      const current = await getUserEnv(key, userId);
      if (current === null || current === undefined) {
        await updateUserEnv(key, defVal, userId);
        console.log(`✅ Initialized [${userId}] ${key} = ${defVal}`);
      }
    } catch (e) {
      console.error(`❌ Failed to init ${key}:`, e.message);
    }
  }
}
