const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const axios = require('axios');
const yts = require('yt-search');
const fetch = require('node-fetch');
const os = require('os');
const FileType = require('file-type');
const ytdl = require('@distube/ytdl-core');
const playdl = require('@iamtraction/play-dl');
const { AUTO_REPLY_RULES, AUTO_VOICE_REPLY_RULES } = require('./autoreply');

const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting, setSetting, getFullSettings } = require('./settings');

// ============================================
// NIMA YT API CONFIG
// ============================================
const NIMA_YT_API = process.env.NIMA_YT_API_URL || 'https://nima-song-api-nocache.up.railway.app';

// ============================================
// IMAGE LINK
// ============================================
const IMAGE_LINK = 'https://i.postimg.cc/D0Lrrt70/file-00000000f3d08211929e8eec527f8aa9.png';

// ============================================
// OWNER NUMBERS
// ============================================
const OWNER_NUMBERS = ['94760743488', '94741914169'];

// ============================================
// BAILEYS IMPORT
// ============================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    downloadContentFromMessage
} = require('@zanta/baileys');

// ============================================
// CONFIG
// ============================================
const config = {
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/BQWRYxmmMRp9JJMSb5Ifoy?mode=ems_copy_t',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: IMAGE_LINK,
    NEWSLETTER_JID: '120363409660898486@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    BOT_NAME: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '> © ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥',
    // Used for BOTH channel-message auto-react and status auto-react
    AUTO_LIKE_EMOJI: ['💗', '💝', '🤍', '🧡', '💛', '💚', '💙'],
    BUTTON_IMAGES: {
        ALIVE: IMAGE_LINK,
        MENU: IMAGE_LINK,
        OWNER: IMAGE_LINK
    },
    YT_API_KEY: 'key_17c099de46c6006f594c19ac6835397f'
};

// ============================================
// SETTINGS UI
// ============================================
async function showSettingsMenu(socket, sender, number, msg) {
    const s = getFullSettings(number);
    const modeLabel = s.BOT_MODE === 'public' ? '🌍 ᴘᴜʙʟɪᴄ'
                    : s.BOT_MODE === 'private' ? '🔒 ᴘʀɪᴠᴀᴛᴇ'
                    : '👥 ɢʀᴏᴜᴘꜱ ᴏɴʟʏ';

    const text = `*⚙️ ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ*

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*

━━━━━━━━━━━━━━━━━━━━

*🌐 ʙᴏᴛ ᴍᴏᴅᴇ ⁚* ${modeLabel}
*👁 ꜱᴛᴀᴛᴜꜱ ᴠɪᴇᴡ ⁚* ${s.AUTO_STATUS_VIEW === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}
*❤️ ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ ⁚* ${s.AUTO_STATUS_REACT === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}
*🎙 ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ ⁚* ${s.AUTO_RECORDING === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}
*🧠 ɴɪᴍᴀ ᴀɪ ⁚* ${s.AI_MODE === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}
*💬 ᴀᴜᴛᴏ ʀᴇᴘʟʏ ⁚* ${s.AUTO_REPLY === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}
*🎤 ᴀᴜᴛᴏ ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ ⁚* ${s.AUTO_VOICE_REPLY === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}
*👁 ꜱᴛᴀᴛᴜꜱ ᴀᴜᴛᴏ ʀᴇᴘʟʏ ⁚* ${s.STATUS_AUTO_REPLY === 'on' ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}

━━━━━━━━━━━━━━━━━━━━

_ᴛᴀᴘ ᴀ ʙᴜᴛᴛᴏɴ ᴛᴏ ᴄʜᴀɴɢᴇ ꜱᴇᴛᴛɪɴɢ._

${config.BOT_FOOTER}`;

    await socket.sendMessage(sender, {
        image: { url: IMAGE_LINK },
        caption: text,
        footer: config.BOT_FOOTER,
        buttons: [
            { buttonId: 'setting:mode', buttonText: { displayText: '🌐 ᴍᴏᴅᴇ' }, type: 1 },
            { buttonId: 'setting:toggle:AUTO_STATUS_VIEW', buttonText: { displayText: '👁 ꜱᴛᴀᴛᴜꜱ ᴠɪᴇᴡ' }, type: 1 },
            { buttonId: 'setting:toggle:AUTO_STATUS_REACT', buttonText: { displayText: '❤️ ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ' }, type: 1 },
            { buttonId: 'setting:toggle:AUTO_RECORDING', buttonText: { displayText: '🎙 ʀᴇᴄᴏʀᴅɪɴɢ' }, type: 1 },
            { buttonId: 'setting:toggle:AI_MODE', buttonText: { displayText: '🧠 ɴɪᴍᴀ ᴀɪ' }, type: 1 },
            { buttonId: 'setting:toggle:AUTO_REPLY', buttonText: { displayText: '💬 ᴀᴜᴛᴏ ʀᴇᴘʟʏ' }, type: 1 },
            { buttonId: 'setting:toggle:AUTO_VOICE_REPLY', buttonText: { displayText: '🎤 ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ' }, type: 1 },
            { buttonId: 'setting:toggle:STATUS_AUTO_REPLY', buttonText: { displayText: '👁 ꜱᴛᴀᴛᴜꜱ ʀᴇᴘʟʏ' }, type: 1 }
        ],
        headerType: 4
    }, { quoted: msg });
}

async function handleSettingButton(socket, sender, number, msg, buttonId) {
    try {
        if (buttonId === 'setting:mode') {
            const s = getFullSettings(number);
            const current = s.BOT_MODE || 'public';
            await socket.sendMessage(sender, {
                text: `*🌐 ꜱᴇʟᴇᴄᴛ ʙᴏᴛ ᴍᴏᴅᴇ*

*ᴄᴜʀʀᴇɴᴛ ⁚* ${current.toUpperCase()}

• 🌍 *ᴘᴜʙʟɪᴄ* — ᴀᴠᴀɪʟᴀʙʟᴇ ꜰᴏʀ ᴇᴠᴇʀʏᴏɴᴇ
• 🔒 *ᴘʀɪᴠᴀᴛᴇ* — ᴏᴡɴᴇʀ ᴏɴʟʏ
• 👥 *ɢʀᴏᴜᴘꜱ* — ɢʀᴏᴜᴘ ᴄʜᴀᴛꜱ ᴏɴʟʏ

${config.BOT_FOOTER}`,
                buttons: [
                    { buttonId: 'setting:setmode:public', buttonText: { displayText: '🌍 ᴘᴜʙʟɪᴄ' }, type: 1 },
                    { buttonId: 'setting:setmode:private', buttonText: { displayText: '🔒 ᴘʀɪᴠᴀᴛᴇ' }, type: 1 },
                    { buttonId: 'setting:setmode:groups', buttonText: { displayText: '👥 ɢʀᴏᴜᴘꜱ' }, type: 1 }
                ],
                headerType: 4
            }, { quoted: msg });
            return;
        }

        if (buttonId.startsWith('setting:setmode:')) {
            const mode = buttonId.split(':')[2];
            await setSetting(number, 'BOT_MODE', mode);
            await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*ʙᴏᴛ ᴍᴏᴅᴇ ⁚* ${mode.toUpperCase()}

${config.BOT_FOOTER}`
            }, { quoted: msg });
            await showSettingsMenu(socket, sender, number, msg);
            return;
        }

        if (buttonId.startsWith('setting:toggle:')) {
            const key = buttonId.split(':')[2];
            const cur = getSetting(number, key);
            const next = cur === 'on' ? 'off' : 'on';
            await setSetting(number, key, next);
            await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*${key} ⁚* ${next.toUpperCase()}

${config.BOT_FOOTER}`
            }, { quoted: msg });
            await showSettingsMenu(socket, sender, number, msg);
            return;
        }
    } catch (e) {
        console.error('Setting button error:', e);
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴇʀʀᴏʀ ⁚ ${e.message}_

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
}

// ============================================
// MONGODB
// ============================================
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const mongoUri = 'mongodb+srv://nimatest:nimatest@nimatest.bdf6c2a.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(mongoUri, {
    maxPoolSize: 10, minPoolSize: 2, maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000, connectTimeoutMS: 10000
});

let db = null, mongoConnected = false, mongoFailed = false;

async function initMongo() {
    if (mongoFailed) return null;
    if (mongoConnected && db) return db;
    try {
        await client.connect();
        db = client.db('Dinuz');
        await db.collection('sessions').createIndex({ number: 1 }, { background: true });
        mongoConnected = true;
        console.log('✅ MongoDB connected');
        return db;
    } catch (err) {
        mongoFailed = true;
        console.error('❌ MongoDB FAILED:', err.message);
        return null;
    }
}

// ============================================
// GLOBALS
// ============================================
const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';
const _reconnecting = new Set();

if (!fs.existsSync(SESSION_BASE_PATH)) fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });

// ============================================
// HELPERS
// ============================================
function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return (d > 0 ? d + "ᴅ " : "") + (h > 0 ? h + "ʜ " : "") + (m > 0 ? m + "ᴍ " : "") + (s > 0 ? s + "ꜱ" : "");
}

function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (e) { return []; }
}

function isOwnerJid(jid) {
    if (!jid) return false;
    try {
        const num = String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        return OWNER_NUMBERS.includes(num);
    } catch (e) { return false; }
}

function digitsOnly(jid) {
    if (!jid) return '';
    return String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isSessionOwner(msg, sender, number) {
    const botNumber = digitsOnly(number);
    if (!botNumber) return false;

    // Check every JID variant Baileys might hand us (normal + LID + remoteJid),
    // so the real bot-owner is recognized reliably in DMs, groups and self-chat.
    const candidates = [
        sender,
        msg.key?.remoteJid,
        msg.key?.remoteJidAlt,
        msg.key?.participant,
        msg.key?.participantAlt
    ];

    return candidates.some(jid => jid && digitsOnly(jid) === botNumber);
}

// NIMA AI helpers (shared by the .ai command and the auto-reply mode)
const NIMA_AI_API_URL = 'https://w-nima-ai-production.up.railway.app/chat';

async function getNimaAIReply(message, userId) {
    const response = await axios.post(
        NIMA_AI_API_URL,
        { message, user_id: userId },
        { headers: { "Content-Type": "application/json" }, timeout: 30000 }
    );
    return response?.data?.reply || null;
}

function boldify(text) {
    const clean = String(text || '').trim();
    if (!clean) return clean;
    return `*${clean}*`;
}

// Restart ONLY one bot's own session (used when a regular session-owner runs
// .restart) — closes just that socket and reconnects it with its saved
// creds, without touching any other running bot in this same process.
async function restartSingleSession(number) {
    const sanitizedNumber = digitsOnly(number);
    const sock = activeSockets.get(sanitizedNumber);
    if (sock) {
        try { sock.ev.removeAllListeners(); } catch (e) {}
        try { sock.ws?.close(); } catch (e) {}
        activeSockets.delete(sanitizedNumber);
        socketCreationTime.delete(sanitizedNumber);
    }
    const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
    await EmpirePair(sanitizedNumber, mockRes);
}

async function downloadQuotedMedia(quotedMsg) {
    try {
        const type = Object.keys(quotedMsg)[0];
        const stream = await downloadContentFromMessage(quotedMsg[type], type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return { buffer };
    } catch (err) {
        console.error('📥 Download error:', err);
        return null;
    }
}

// ============================================
// ELITEPROTECH YTMP3 API (primary downloader)
// ============================================
const ELITE_YT_API = 'https://eliteprotech-apis.zone.id/download/ytmp3';

function findDownloadUrlInJson(obj, depth = 0) {
    if (!obj || depth > 5) return null;
    if (typeof obj === 'string') {
        return /^https?:\/\//i.test(obj) ? obj : null;
    }
    if (typeof obj !== 'object') return null;

    const priorityKeys = ['download_url', 'downloadUrl', 'download', 'dl', 'dlink', 'link', 'url', 'audio', 'mp3', 'file'];
    for (const k of priorityKeys) {
        if (typeof obj[k] === 'string' && /^https?:\/\//i.test(obj[k]) && !/youtube\.com|youtu\.be|ytimg\.com/i.test(obj[k])) {
            return obj[k];
        }
    }
    for (const k of Object.keys(obj)) {
        if (/thumb|image|cover|poster|icon/i.test(k)) continue;
        const v = obj[k];
        if (typeof v === 'string' && /^https?:\/\//i.test(v) && /download|dl|mp3|audio|link|url|file/i.test(k) && !/youtube\.com|youtu\.be|ytimg\.com/i.test(v)) {
            return v;
        }
    }
    for (const k of Object.keys(obj)) {
        if (/thumb|image|cover|poster|icon/i.test(k)) continue;
        if (typeof obj[k] === 'object') {
            const found = findDownloadUrlInJson(obj[k], depth + 1);
            if (found) return found;
        }
    }
    return null;
}

async function getAudioFromEliteAPI(videoUrl, quality = 128) {
    const res = await axios.get(ELITE_YT_API, {
        params: { url: videoUrl, quality },
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 200 * 1024 * 1024,
        validateStatus: () => true
    });

    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

    const ct = String(res.headers['content-type'] || '').toLowerCase();
    const raw = Buffer.from(res.data);

    // API directly returned the audio file
    if (ct.startsWith('audio/') || ct.includes('octet-stream')) {
        if (raw.length < 10 * 1024) throw new Error('Audio too small');
        return raw;
    }

    // API returned JSON with a download link
    let json;
    try { json = JSON.parse(raw.toString('utf-8')); }
    catch (_) { throw new Error('Invalid API response'); }

    if (json && (json.status === false || json.success === false || json.status === 'error')) {
        throw new Error((json.message || json.error || 'API error').toString().slice(0, 100));
    }

    const dlUrl = findDownloadUrlInJson(json.result || json.data || json);
    if (!dlUrl) throw new Error('No download link in API response');

    const file = await axios.get(dlUrl, {
        responseType: 'arraybuffer',
        timeout: 180000,
        maxContentLength: 200 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        validateStatus: () => true
    });
    if (file.status !== 200) throw new Error(`Download HTTP ${file.status}`);
    const buf = Buffer.from(file.data);
    if (buf.length < 10 * 1024) throw new Error('Downloaded audio too small');
    return buf;
}

async function convertToOpusOgg(inputBuffer) {
    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const inPath = path.join(os.tmpdir(), `yt_${id}.mp3`);
    const outPath = path.join(os.tmpdir(), `yt_${id}.ogg`);
    try {
        await fs.writeFile(inPath, inputBuffer);
        await execAsync(`ffmpeg -y -i "${inPath}" -vn -c:a libopus -b:a 64k -f ogg "${outPath}"`, { timeout: 120000 });
        const out = await fs.readFile(outPath);
        if (!out || out.length === 0) throw new Error('ffmpeg empty output');
        return out;
    } finally {
        fs.remove(inPath).catch(() => {});
        fs.remove(outPath).catch(() => {});
    }
}

// ============================================
// YOUTUBE AUDIO DOWNLOADER
// Fallback chain: play-dl (multi-quality) → NIMA API → ytdl-core
// ============================================
async function getAudioBufferFromYT(videoUrl, format = 'mp3') {
    let videoId = null;
    const match = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) videoId = match[1];
    if (!videoId) throw new Error('Invalid YouTube URL');

    const errors = [];

    // ---- Method 0: EliteProTech API (primary) ----
    try {
        console.log(`⬇️ [0] EliteProTech API (${format})...`);
        const mp3Buffer = await getAudioFromEliteAPI(videoUrl, 128);
        if (format === 'ogg') {
            const oggBuffer = await convertToOpusOgg(mp3Buffer);
            console.log(`✅ EliteProTech API + ffmpeg OK (${(oggBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
            return oggBuffer;
        }
        console.log(`✅ EliteProTech API OK (${(mp3Buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        return mp3Buffer;
    } catch (e) {
        console.log('❌ EliteProTech API error:', e.message);
        errors.push('Elite:' + e.message);
    }

    // ---- Method 1: play-dl (bot's own IP) with multiple quality fallbacks ----
    try {
        console.log(`⬇️ [1/3] play-dl (${format})...`);

        // Validate URL
        const validation = await playdl.validate(videoUrl);
        console.log('  play-dl validation:', validation);

        if (!validation || validation !== 'yt_video') {
            throw new Error(`Invalid URL type: ${validation}`);
        }

        const info = await playdl.video_info(videoUrl);
        console.log('  play-dl info OK, formats:', info.format?.length || 0);

        // Try multiple stream options
        const streamOptions = [
            { quality: 2, discordPlayerCompatibility: true },
            { quality: 1, discordPlayerCompatibility: true },
            { quality: 0, discordPlayerCompatibility: true },
            { quality: 2, seek: 0, discordPlayerCompatibility: true },
            { quality: 1, seek: 0, discordPlayerCompatibility: true }
        ];

        let lastError = null;
        for (const opts of streamOptions) {
            try {
                console.log(`  trying quality:${opts.quality}...`);
                const source = await playdl.stream_from_info(info, opts);

                const buffer = await new Promise((resolve, reject) => {
                    const chunks = [];
                    const timer = setTimeout(() => {
                        try { source.stream.destroy(); } catch (_) {}
                        reject(new Error('timeout'));
                    }, 90000);
                    source.stream.on('data', chunk => chunks.push(chunk));
                    source.stream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
                    source.stream.on('error', err => { clearTimeout(timer); reject(err); });
                });

                if (buffer && buffer.length > 0) {
                    console.log(`✅ play-dl OK (quality:${opts.quality}, ${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
                    return buffer;
                }
            } catch (optErr) {
                console.log(`  ❌ quality ${opts.quality} failed:`, optErr.message);
                lastError = optErr;
            }
        }
        throw lastError || new Error('All quality options failed');
    } catch (e) {
        console.log('❌ play-dl error:', e.message);
        errors.push('play-dl:' + e.message);
    }

    // ---- Method 2: NIMA Railway API ----
    try {
        console.log(`⬇️ [2/3] NIMA API (${format})...`);
        const endpoint = format === 'ogg' ? 'audio-ogg' : 'audio';
        const apiUrl = `${NIMA_YT_API}/${endpoint}?id=${videoId}`;

        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 180000,
            maxContentLength: 200 * 1024 * 1024,
            validateStatus: () => true
        });

        if (response.status !== 200) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const errText = Buffer.from(response.data).toString('utf-8');
                const errJson = JSON.parse(errText);
                if (errJson.error) errMsg = errJson.error.substring(0, 100);
            } catch (_) {}
            throw new Error(errMsg);
        }

        if (response.data && response.data.byteLength > 0) {
            console.log(`✅ NIMA API OK (${(response.data.byteLength / 1024 / 1024).toFixed(2)} MB)`);
            return Buffer.from(response.data);
        }
        throw new Error('Empty response from NIMA');
    } catch (e) {
        console.log('❌ NIMA API error:', e.message);
        errors.push('NIMA:' + e.message);
    }

    // ---- Method 3: ytdl-core with fallback format selection ----
    try {
        console.log('⬇️ [3/3] ytdl-core...');
        const info = await ytdl.getInfo(videoUrl);

        let audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

        if (!audioFormat) {
            audioFormat = info.formats
                .filter(f => f.hasAudio && !f.hasVideo)
                .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
        }
        if (!audioFormat) {
            audioFormat = info.formats
                .filter(f => f.hasAudio)
                .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
        }
        if (!audioFormat) throw new Error('No audio format available');

        return await new Promise((resolve, reject) => {
            const chunks = [];
            const stream = ytdl.downloadFromInfo(info, { format: audioFormat });
            const timer = setTimeout(() => {
                stream.destroy();
                reject(new Error('ytdl-core timeout (120s)'));
            }, 120000);
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => {
                clearTimeout(timer);
                console.log(`✅ ytdl-core OK (${(Buffer.concat(chunks).length / 1024 / 1024).toFixed(2)} MB)`);
                resolve(Buffer.concat(chunks));
            });
            stream.on('error', err => { clearTimeout(timer); reject(err); });
        });
    } catch (e) {
        console.log('❌ ytdl-core error:', e.message);
        errors.push('ytdl:' + e.message);
    }

    throw new Error('All methods failed → ' + errors.join(' | '));
}

// ============================================
// GROUP JOIN
// ============================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const match = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!match) return { status: 'failed', error: 'Invalid link' };
    const inviteCode = match[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) return { status: 'success', gid: response.gid };
            throw new Error('No group ID');
        } catch (error) {
            retries--;
            let msg = error.message || 'Unknown';
            if (error.message.includes('conflict')) msg = 'Already a member';
            if (retries === 0) return { status: 'failed', error: msg };
            await delay(1000);
        }
    }
    return { status: 'failed', error: 'Max retries' };
}

async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult?.status === 'success' ? '✅ ᴊᴏɪɴᴇᴅ' : `⚠️ ${groupResult?.error || 'ᴜɴᴋɴᴏᴡɴ'}`;
    const caption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ* ✅

*ɴᴜᴍʙᴇʀ ⁚* ${number}
*ꜱᴛᴀᴛᴜꜱ ⁚* 🟢 ᴏɴʟɪɴᴇ
*ɢʀᴏᴜᴘ ⁚* ${groupStatus}

${config.BOT_FOOTER}`;

    for (const admin of admins) {
        try {
            await socket.sendMessage(`${admin}@s.whatsapp.net`, { image: { url: config.IMAGE_PATH }, caption });
        } catch (e) { console.error(`Admin msg fail: ${admin}`); }
    }
}

// ============================================
// NEWSLETTER (channel auto-react)
// ============================================
function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        try {
            for (const message of messages || []) {
                if (!message?.key) continue;

                const jid = message.key.remoteJid || '';
                if (!jid.endsWith('@newsletter')) continue;
                if (jid !== config.NEWSLETTER_JID) continue;
                if (message.key.fromMe) continue;

                const serverId = message.newsletterServerId
                    || message.key.server_id
                    || message.key.id;

                if (!serverId) {
                    console.log('⚠️ Newsletter: no server ID');
                    continue;
                }

                const emoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let reacted = false;

                if (typeof socket.newsletterReactMessage === 'function') {
                    try {
                        await socket.newsletterReactMessage(jid, String(serverId), emoji);
                        reacted = true;
                    } catch (err) {
                        console.log('newsletterReactMessage failed:', err.message);
                    }
                }

                if (!reacted) {
                    try {
                        await socket.sendMessage(jid, {
                            react: { text: emoji, key: message.key }
                        });
                        reacted = true;
                    } catch (err) {
                        console.log('sendMessage react failed:', err.message);
                    }
                }

                if (reacted) {
                    console.log(`✅ Newsletter auto-react: ${emoji}`);
                }
            }
        } catch (e) {
            console.error('Newsletter handler error:', e.message);
        }
    });
}

// ============================================
// STATUS HANDLER
// ============================================
async function setupStatusHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const myJid = jidNormalizedUser(socket.user?.id);
            const myNum = String(myJid || '').split('@')[0].split(':')[0];

            const statusMessages = (messages || []).filter(message => {
                if (!message?.key) return false;
                if (message.key.remoteJid !== 'status@broadcast') return false;
                if (!message.message) return false;
                if (message.key.fromMe) return false;
                const participant = message.key.participantAlt || message.key.participant;
                if (!participant) return false;
                const pNum = String(participant).split('@')[0].split(':')[0];
                if (pNum === myNum) return false;
                return true;
            });

            if (statusMessages.length === 0) return;

            for (const message of statusMessages) {
                // Prefer the phone-number JID (participantAlt) over LID, needed for status reactions
                const participant = message.key.participantAlt || message.key.participant;
                const rawParticipant = message.key.participant;

                if (getSetting(number, 'AUTO_STATUS_VIEW') === 'on') {
                    try { await socket.readMessages([message.key]); } catch (e) {}

                    if (getSetting(number, 'STATUS_AUTO_REPLY') === 'on') {
                        try {
                            const posterJid = jidNormalizedUser(rawParticipant || participant);
                            await socket.sendMessage(posterJid, {
                                text: boldify('ɴɪᴍᴀ ᴍɪɴɪ ꜱᴛᴀᴛᴜꜱ ꜱᴇᴇɴ ᴅᴏɴᴇ')
                            });
                        } catch (err) {
                            console.error('Status auto-reply error:', err?.message || err);
                        }
                    }
                }

                if (getSetting(number, 'AUTO_STATUS_REACT') === 'on') {
                    const emoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                    console.log('👀 Attempting status react for', participant, 'emoji:', emoji);

                    // make sure the status is marked as seen before reacting
                    try { await socket.readMessages([message.key]); } catch (e) {}
                    await delay(2000);

                    const reactKey = {
                        remoteJid: 'status@broadcast',
                        id: message.key.id,
                        participant: rawParticipant || participant,
                        fromMe: false
                    };

                    let reacted = false;
                    try {
                        await socket.sendMessage('status@broadcast', {
                            react: { text: emoji, key: reactKey }
                        }, {
                            statusJidList: [jidNormalizedUser(participant), myJid]
                        });
                        reacted = true;
                    } catch (err) {
                        console.error('Status react error (primary):', err);
                    }

                    // Fallback: retry with the raw (non-alt) participant JID as well,
                    // some accounts need this variant in statusJidList to accept the react.
                    if (!reacted && rawParticipant && rawParticipant !== participant) {
                        try {
                            await socket.sendMessage('status@broadcast', {
                                react: { text: emoji, key: reactKey }
                            }, {
                                statusJidList: [jidNormalizedUser(rawParticipant), jidNormalizedUser(participant), myJid]
                            });
                            reacted = true;
                        } catch (err) {
                            console.error('Status react error (fallback):', err);
                        }
                    }

                    if (reacted) {
                        console.log(`✅ Status auto-react sent: ${emoji}`);
                    } else {
                        console.log('❌ Status auto-react failed for', participant);
                    }
                }
            }
        } catch (e) {
            console.error('Status handler:', e);
        }
    });
}

// ============================================
// MESSAGE DELETE
// ============================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;
        if (!socket.user?.id) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);

        const message = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🗑️

*ᴅᴇʟᴇᴛᴇᴅ ᴍᴇꜱꜱᴀɢᴇ*

*ꜰʀᴏᴍ ⁚* ${messageKey.remoteJid}
*ᴛɪᴍᴇ ⁚* ${getSriLankaTimestamp()}

${config.BOT_FOOTER}`;

        try {
            await socket.sendMessage(userJid, { image: { url: config.IMAGE_PATH }, caption: message });
        } catch (e) { console.error('Delete notify fail:', e); }
    });
}

// ============================================
// COMMAND HANDLERS
// ============================================
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        const rawText = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const isStatusOrChannel = sender === 'status@broadcast' || sender.endsWith('@newsletter');
        const isGroupChat = sender.endsWith('@g.us');

        // ᴀᴜᴛᴏ ʀᴇᴘʟʏ / ᴀᴜᴛᴏ ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ — checked on the RAW text FIRST, dot-prefix
        // included, so a keyword can be typed either with or without "." and even
        // reuse a real command's name (e.g. ".menu") to override it with a custom reply.
        if (rawText && !msg.key.fromMe && !isStatusOrChannel && !isGroupChat) {
            const rawKeyword = rawText.toLowerCase().normalize('NFC');
            let handledByKeyword = false;

            if (getSetting(number, 'AUTO_REPLY') === 'on' && AUTO_REPLY_RULES[rawKeyword]) {
                try {
                    await socket.sendMessage(sender, { text: AUTO_REPLY_RULES[rawKeyword] }, { quoted: msg });
                    handledByKeyword = true;
                } catch (e) {
                    console.error('Auto reply error:', e.message);
                }
            }

            if (getSetting(number, 'AUTO_VOICE_REPLY') === 'on' && AUTO_VOICE_REPLY_RULES[rawKeyword]) {
                try {
                    await socket.sendMessage(sender, {
                        audio: { url: AUTO_VOICE_REPLY_RULES[rawKeyword] },
                        mimetype: 'audio/mpeg'
                    }, { quoted: msg });
                    handledByKeyword = true;
                } catch (e) {
                    console.error('Auto voice reply error:', e.message);
                }
            }

            if (handledByKeyword) return;
        }

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = rawText;
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }
        else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            } else if (buttonId && buttonId.startsWith('setting:')) {
                command = buttonId;
                args = [];
            }
        }
        else if (msg.message.templateButtonReplyMessage) {
            const buttonId = msg.message.templateButtonReplyMessage.selectedId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            } else if (buttonId && buttonId.startsWith('setting:')) {
                command = buttonId;
                args = [];
            }
        }
        else if (msg.message.listResponseMessage) {
            const buttonId = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            } else if (buttonId && buttonId.startsWith('setting:')) {
                command = buttonId;
                args = [];
            }
        }

        if (!command) {
            // ᴀᴜᴛᴏ ᴀɪ ʀᴇᴘʟʏ — a plain message (no . prefix, no keyword match above)
            // in a private chat gets an automatic AI reply when AI_MODE is on.
            try {
                if (!msg.key.fromMe && !isStatusOrChannel && !isGroupChat && getSetting(number, 'AI_MODE') === 'on') {
                    const plainText = rawText;
                    if (plainText) {
                        try {
                            const aiResponse = await getNimaAIReply(plainText, sender);
                            if (aiResponse) {
                                await socket.sendMessage(sender, { text: boldify(aiResponse) }, { quoted: msg });
                            }
                        } catch (e) {
                            console.error('Auto AI reply error:', e.message);
                        }
                    }
                }
            } catch (e) {}
            return;
        }

        const isCmdOwner =
            isSessionOwner(msg, sender, number) ||
            isOwnerJid(msg.key.participant) ||
            isOwnerJid(msg.key.remoteJid) ||
            isOwnerJid(msg.key.participantAlt) ||
            isOwnerJid(msg.key.remoteJidAlt) ||
            isOwnerJid(socket.user?.id);

        const currentMode = getSetting(number, 'BOT_MODE') || 'public';
        const isChannel = isStatusOrChannel;

        if (currentMode === 'private' && !isCmdOwner && !isChannel) return;
        if (currentMode === 'groups' && !isGroupChat && !isCmdOwner && !isChannel) return;

        try {
            switch (command) {

                case 'settings':
                case 'setting': {
                    if (!isCmdOwner) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    await showSettingsMenu(socket, sender, number, msg);
                    break;
                }

                case 'setting:mode':
                case 'setting:toggle:AUTO_STATUS_VIEW':
                case 'setting:toggle:AUTO_STATUS_REACT':
                case 'setting:toggle:AUTO_RECORDING':
                case 'setting:toggle:AI_MODE':
                case 'setting:toggle:AUTO_REPLY':
                case 'setting:toggle:AUTO_VOICE_REPLY':
                case 'setting:toggle:STATUS_AUTO_REPLY':
                case 'setting:setmode:public':
                case 'setting:setmode:private':
                case 'setting:setmode:groups': {
                    if (!isCmdOwner) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴄᴀɴɴᴏᴛ ᴄʜᴀɴɢᴇ ꜱᴇᴛᴛɪɴɢꜱ (ᴏᴡɴᴇʀ ᴏɴʟʏ)._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    await handleSettingButton(socket, sender, number, msg, command);
                    break;
                }

                case 'restart': {
                    if (!isCmdOwner) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    // Only the GLOBAL bot-owner (OWNER_NUMBERS) can restart every bot.
                    // A regular session-owner restarting their own bot only restarts theirs.
                    const isGlobalOwnerRestart =
                        isOwnerJid(msg.key.participant) ||
                        isOwnerJid(msg.key.remoteJid) ||
                        isOwnerJid(msg.key.participantAlt) ||
                        isOwnerJid(msg.key.remoteJidAlt) ||
                        isOwnerJid(socket.user?.id);

                    if (!isGlobalOwnerRestart) {
                        try {
                            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔄

_ʀᴇꜱᴛᴀʀᴛɪɴɢ ᴛʜɪꜱ ʙᴏᴛ ᴏɴʟʏ..._
*ᴏᴛʜᴇʀ ʙᴏᴛꜱ ᴀʀᴇ ɴᴏᴛ ᴀꜰꜰᴇᴄᴛᴇᴅ.*

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        } catch (e) {}
                        setTimeout(() => {
                            restartSingleSession(number).catch(e => console.error('Single restart failed:', e.message));
                        }, 1200);
                        break;
                    }

                    // Global owner: restart ALL bots running in this process.
                    try {
                        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔄

_ʀᴇꜱᴛᴀʀᴛɪɴɢ ᴀʟʟ ʙᴏᴛꜱ (ᴏᴡɴᴇʀ)..._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    } catch (e) {}
                    setTimeout(() => { console.log('🔄 Owner restart-all requested...'); process.exit(1); }, 2000);
                    break;
                }

                case 'update':
                case 'reload': {
                    if (!isCmdOwner) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    try {
                        await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔄

_ᴜᴘᴅᴀᴛɪɴɢ ʙᴏᴛ..._

*│* 📥 ᴘᴜʟʟɪɴɢ ᴜᴘᴅᴀᴛᴇꜱ
*│* 💾 ꜱᴇꜱꜱɪᴏɴ ꜱᴀᴠᴇᴅ
*│* 🔄 ʀᴇꜱᴛᴀʀᴛɪɴɢ ʙᴏᴛ

_ᴡᴀɪᴛ 30-60 ꜱᴇᴄᴏɴᴅꜱ..._

${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        exec('git pull', async (error, stdout) => {
                            if (error) {
                                await socket.sendMessage(sender, {
                                    text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ⚠️

_ɢɪᴛ ᴘᴜʟʟ ꜰᴀɪʟᴇᴅ — ʀᴇꜱᴛᴀʀᴛɪɴɢ ᴏɴʟʏ._

*ᴇʀʀᴏʀ ⁚* ${error.message.slice(0, 100)}

${config.BOT_FOOTER}`
                                }, { quoted: msg });
                            } else {
                                await socket.sendMessage(sender, {
                                    text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 📥 ɢɪᴛ ᴘᴜʟʟ ⁚ ꜱᴜᴄᴄᴇꜱꜱ
*│* 🔄 ʀᴇꜱᴛᴀʀᴛɪɴɢ...

_ʙᴏᴛ ᴡɪʟʟ ʙᴇ ᴏɴʟɪɴᴇ ɪɴ 30-60 ꜱᴇᴄᴏɴᴅꜱ._

${config.BOT_FOOTER}`
                                }, { quoted: msg });
                            }
                            setTimeout(() => { console.log('🔄 Restarting...'); process.exit(1); }, 3000);
                        });
                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_${err.message}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const aliveCaption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ 🔥*

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
*ʙᴏᴛ ᴏᴡɴᴇʀ ⁚- ʟᴏᴋᴜ ɴɪᴍᴀ*
*ᴏᴡɴᴇʀ ɴᴜᴍʙᴇʀ ⁚- 94760743488*

━━━━━━━━━━━━━━━━━━━━

*📊 ꜱʏꜱᴛᴇᴍ ꜱᴛᴀᴛᴜꜱ*

*│* 🟢 *ꜱᴛᴀᴛᴜꜱ ⁚* ᴏɴʟɪɴᴇ
*│* ⏱️ *ᴜᴘᴛɪᴍᴇ ⁚* ${hours}ʜ ${minutes}ᴍ ${seconds}ꜱ
*│* ⚡ *ᴘɪɴɢ ⁚* ꜰᴀꜱᴛ
*│* 🛡️ *ᴠᴇʀꜱɪᴏɴ ⁚* 2.0.0

━━━━━━━━━━━━━━━━━━━━

*ᴅᴇᴘʟᴏʏ ᴍɪɴɪ ꜱɪᴛᴇ 👇*
> https://www.nima-mini.zone.id/
> *© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
`;

                    await socket.sendMessage(sender, { react: { text: "🔥", key: msg.key } });
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: aliveCaption,
                        footer: config.BOT_FOOTER,
                        buttons: [
                            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 ᴍᴇɴᴜ' }, type: 1 },
                            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: '⚡ ᴘɪɴɢ' }, type: 1 },
                            { buttonId: `${config.PREFIX}system`, buttonText: { displayText: '⚙️ ꜱʏꜱᴛᴇᴍ' }, type: 1 },
                            { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: '👑 ᴏᴡɴᴇʀ' }, type: 1 }
                        ],
                        headerType: 4
                    }, { quoted: msg });
                    break;
                }

                case 'menu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const menuCaption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ 🔥*

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
*ʙᴏᴛ ᴏᴡɴᴇʀ ⁚- ʟᴏᴋᴜ ɴɪᴍᴀ*
*ᴏᴡɴᴇʀ ɴᴜᴍʙᴇʀ ⁚- 94760743488*

⏱️ *ᴜᴘᴛɪᴍᴇ ⁚* ${hours}ʜ ${minutes}ᴍ ${seconds}ꜱ

━━━━━━━━━━━━━━━━━━━━

*📌 ᴄᴏʀᴇ ᴄᴏᴍᴍᴀɴᴅꜱ*
*│* 🟢 .alive — ʙᴏᴛ ꜱᴛᴀᴛᴜꜱ
*│* 📶 .ping — ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ
*│* ⚙️ .system — ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ
*│* 👑 .owner — ʙᴏᴛ ᴏᴡɴᴇʀꜱ
*│* ⚙️ .settings — ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ

*🎵 ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ*
*│* 🎼 .song — ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢ
*│* 🎤 .csong — ꜱᴇɴᴅ ᴀꜱ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ
*│* 🎬 .video — ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ
*│* 📘 .fb — ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ
*│* 🎶 .tiktok — ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ
*│* 📲 .apk — ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴘᴋ

*🛠️ ᴛᴏᴏʟꜱ & ᴀɪ*
*│* 🤖 .ai — ᴄʜᴀᴛ ᴡɪᴛʜ ᴀɪ
*│* 🔍 .google — ꜱᴇᴀʀᴄʜ ᴡᴇʙ
*│* 📦 .npm — ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ
*│* 🖼️ .getdp — ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ
*│* 💥 .boom — ꜱᴇɴᴅ ʙᴏᴍʙ
*│* 📥 .vv — ꜱᴀᴠᴇ ꜱᴛᴀᴛᴜꜱ

*🌐 ᴡʜᴀᴛꜱᴀᴘᴘ*
*│* 🔗 .pair — ᴘᴀɪʀ ꜱᴇꜱꜱɪᴏɴ
*│* 🆔 .jid — ɢᴇᴛ ᴄʜᴀᴛ ᴊɪᴅ
*│* 📡 .cid — ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ
*│* 📢 .gcstatus — ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ ᴘᴏꜱᴛ
*│* 📢 .chstatus — ᴄʜᴀɴɴᴇʟ ᴘᴏꜱᴛ

━━━━━━━━━━━━━━━━━━━━

*ᴅᴇᴘʟᴏʏ ᴍɪɴɪ ꜱɪᴛᴇ 👇*
> https://www.nima-mini.zone.id/
> *© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
`;

                    await socket.sendMessage(sender, { react: { text: "🌟", key: msg.key } });
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.MENU },
                        caption: menuCaption,
                        footer: config.BOT_FOOTER,
                        buttons: [
                            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '🟢 ᴀʟɪᴠᴇ' }, type: 1 },
                            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: '⚡ ᴘɪɴɢ' }, type: 1 },
                            { buttonId: `${config.PREFIX}system`, buttonText: { displayText: '⚙️ ꜱʏꜱᴛᴇᴍ' }, type: 1 },
                            { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: '👑 ᴏᴡɴᴇʀ' }, type: 1 },
                            { buttonId: `${config.PREFIX}settings`, buttonText: { displayText: '⚙️ ꜱᴇᴛᴛɪɴɢꜱ' }, type: 1 }
                        ],
                        headerType: 4
                    }, { quoted: msg });
                    break;
                }

                case 'amenu': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    await socket.sendMessage(sender, { react: { text: "⚡", key: msg.key } });

                    const amenuCaption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ 🔥*

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
*ʙᴏᴛ ᴏᴡɴᴇʀ ⁚- ʟᴏᴋᴜ ɴɪᴍᴀ*
*ᴏᴡɴᴇʀ ɴᴜᴍʙᴇʀ ⁚- 94760743488*

━━━━━━━━━━━━━━━━━━━━

*⚙️ ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ*

*│* 🤖 *ʙᴏᴛ ɴᴀᴍᴇ ⁚* ɴɪᴍᴀ ꜰᴀᴍɪʟʏ
*│* 🚀 *ᴘʟᴀᴛꜰᴏʀᴍ ⁚* ʀᴇɴᴅᴇʀ ᴅᴇᴘʟᴏʏ
*│* ⏱️ *ᴜᴘᴛɪᴍᴇ ⁚* ${hours}ʜ ${minutes}ᴍ ${seconds}ꜱ
*│* 📦 *ᴠᴇʀꜱɪᴏɴ ⁚* 2.0.0

━━━━━━━━━━━━━━━━━━━━

*🛡️ ᴄᴏʀᴇ ᴄᴏᴍᴍᴀɴᴅꜱ*

*│* 🟢 .alive
*│* 📶 .ping
*│* ⚙️ .system
*│* 👑 .owner
*│* 📋 .menu
*│* 📋 .amenu
*│* ⚙️ .settings
*│* 🔄 .update (ᴏᴡɴᴇʀ)
*│* 🔄 .restart (ᴏᴡɴᴇʀ)

━━━━━━━━━━━━━━━━━━━━

*🎬 ᴍᴇᴅɪᴀ & ᴅᴏᴡɴʟᴏᴀᴅ*

*│* 🎼 .song <ɴᴀᴍᴇ>
*│* 🎤 .csong <ɴᴀᴍᴇ>
*│* 🎬 .video <ɴᴀᴍᴇ ᴏʀ ʟɪɴᴋ>
*│* 📘 .fb <ᴜʀʟ>
*│* 🎶 .tiktok <ᴜʀʟ>
*│* 🔍 .tiktoksearch <ɴᴀᴍᴇ>
*│* 📲 .apk <ɴᴀᴍᴇ>
*│* 🎨 .seaart <ᴘʀᴏᴍᴘᴛ>
*│* 🎨 .logo <ᴘʀᴏᴍᴘᴛ>

━━━━━━━━━━━━━━━━━━━━

*🔧 ᴛᴏᴏʟꜱ & ᴀɪ*

*│* 🤖 .ai <ᴘʀᴏᴍᴘᴛ>
*│* 🔍 .google <ǫᴜᴇʀʏ>
*│* 🔍 .pssearch <ǫᴜᴇʀʏ>
*│* 📦 .npm <ᴘᴀᴄᴋᴀɢᴇ>
*│* 🖼️ .getdp <ɴᴜᴍʙᴇʀ>
*│* 💥 .boom <ɴᴜᴍ,ᴍꜱɢ,ᴄᴏᴜɴᴛ>
*│* 📥 .vv (ʀᴇᴘʟʏ ᴛᴏ ꜱᴛᴀᴛᴜꜱ)
*│* 📥 .save (ʀᴇᴘʟʏ ᴛᴏ ᴍꜱɢ)

━━━━━━━━━━━━━━━━━━━━

*🌐 ᴡʜᴀᴛꜱᴀᴘᴘ*

*│* 🔗 .pair <ɴᴜᴍʙᴇʀ>
*│* 🆔 .jid
*│* 📡 .cid <ʟɪɴᴋ>
*│* 💬 .react <ʟɪɴᴋ,ᴇᴍᴏᴊɪ>
*│* 📢 .gcstatus <ᴛᴇxᴛ> (ɢʀᴏᴜᴘ, ᴀᴅᴍɪɴ)
*│* 📢 .chstatus <ᴛᴇxᴛ> (ᴏᴡɴᴇʀ)

━━━━━━━━━━━━━━━━━━━━

*ᴅᴇᴘʟᴏʏ ᴍɪɴɪ ꜱɪᴛᴇ 👇*
> https://www.nima-mini.zone.id/

> *© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
`;

                    await socket.sendMessage(sender, {
                        image: { url: IMAGE_LINK },
                        caption: amenuCaption,
                        contextInfo: {
                            mentionedJid: ['94760743488@s.whatsapp.net'],
                            groupMentions: [],
                            forwardingScore: 999,
                            isForwarded: false,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.NEWSLETTER_JID,
                                newsletterName: "ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ",
                                serverMessageId: 999
                            },
                            externalAdReply: {
                                title: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ᴍᴜʟᴛɪ ᴅᴇᴠɪᴄᴇ ꜰʀᴇᴇ ʙᴏᴛ',
                                body: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
                                mediaType: 1,
                                sourceUrl: "https://www.nima-mini.zone.id/",
                                thumbnailUrl: IMAGE_LINK,
                                renderLargerThumbnail: false,
                                showAdAttribution: false
                            }
                        }
                    });
                    break;
                }

                // ============================================
                // 🎵 SONG COMMAND
                // ============================================
                case 'mp3':
                case 'song':
                case 'music': {
                    try {
                        const q = args.join(" ").trim();
                        if (!q) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵\n\n_ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴏɴɢ ɴᴀᴍᴇ._\n\n*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}song Lelena\n\n${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch(e){}

                        let videoUrl = null, videoTitle = q, videoThumbnail = IMAGE_LINK;
                        if (q.includes('youtube.com') || q.includes('youtu.be')) {
                            videoUrl = q;
                        } else {
                            const search = await yts(q);
                            if (search && search.videos.length > 0) {
                                const v = search.videos[0];
                                videoUrl = v.url;
                                videoTitle = v.title;
                                videoThumbnail = v.thumbnail;
                            }
                        }

                        if (!videoUrl) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ꜱᴏɴɢ ɴᴏᴛ ꜰᴏᴜɴᴅ._\n\n${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, {
                            image: { url: videoThumbnail },
                            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵\n\n*ᴛɪᴛʟᴇ ⁚* ${videoTitle}\n\n_ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ꜱᴏɴɢ..._\n\n${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        const audioBuffer = await getAudioBufferFromYT(videoUrl, 'mp3');
                        const safeTitle = videoTitle.replace(/[^\w\s\u0D80-\u0DFF-]/g, '').slice(0, 60) || 'song';

                        await socket.sendMessage(sender, {
                            audio: audioBuffer,
                            mimetype: 'audio/mpeg',
                            fileName: `${safeTitle}.mp3`,
                            ptt: false
                        }, { quoted: msg });

                        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

                    } catch (error) {
                        console.error('❌ Song error:', error.message);
                        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_Unable to download song._\n\n_${error.message || 'Try again later.'}_\n\n${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                // ============================================
                // 🎤 CSONG COMMAND (Voice Note)
                // ============================================
                case 'csong':
case 'chsong':
case 'music': {
    try {
        const q = args.join(" ").trim();
        if (!q) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵\n\n_ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴏɴɢ ɴᴀᴍᴇ._\n\n*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}csong Lelena\n\n${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch(e){}

        let videoUrl = null, videoTitle = q, videoThumbnail = IMAGE_LINK;
        if (q.includes('youtube.com') || q.includes('youtu.be')) {
            videoUrl = q;
        } else {
            const search = await yts(q);
            if (search && search.videos.length > 0) {
                const v = search.videos[0];
                videoUrl = v.url;
                videoTitle = v.title;
                videoThumbnail = v.thumbnail;
            }
        }

        if (!videoUrl) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ꜱᴏɴɢ ɴᴏᴛ ꜰᴏᴜɴᴅ._\n\n${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, {
            image: { url: videoThumbnail },
            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵\n\n*ᴛɪᴛʟᴇ ⁚* ${videoTitle}\n\n_ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ꜱᴏɴɢ..._\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });

        // --- Try to get OGG (proper voice note) ---
        // 1) Elite mp3 → ffmpeg ogg  (best)
        // 2) Fallback: mp3 as PTT     (works without ffmpeg)
        let audioBuffer = null;
        let sendAsOgg = false;

        // 1) Try ogg pipeline
        try {
            const mp3Buf = await getAudioFromEliteAPI(videoUrl, 128);
            try {
                audioBuffer = await convertToOpusOgg(mp3Buf);
                sendAsOgg = true;
                console.log('✅ Voice note: Elite + ffmpeg (ogg/opus)');
            } catch (convErr) {
                // ffmpeg missing → send mp3 as PTT
                console.log('⚠️ ffmpeg not available, sending mp3 as PTT:', convErr.message);
                audioBuffer = mp3Buf;
                sendAsOgg = false;
            }
        } catch (eliteErr) {
            console.log('❌ Elite failed, trying full fallback chain:', eliteErr.message);
            // 2) Full fallback chain (play-dl / NIMA / ytdl)
            try {
                audioBuffer = await getAudioBufferFromYT(videoUrl, 'ogg');
                sendAsOgg = true;
            } catch (oggErr) {
                console.log('⚠️ ogg chain failed, trying mp3 chain:', oggErr.message);
                audioBuffer = await getAudioBufferFromYT(videoUrl, 'mp3');
                sendAsOgg = false;
            }
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('Empty audio buffer');
        }

        // --- Send as voice note ---
        if (sendAsOgg) {
            await socket.sendMessage(sender, {
                audio: audioBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: msg });
        } else {
            // mp3 with ptt:true → most clients show it as voice note
            await socket.sendMessage(sender, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: true
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

    } catch (error) {
        console.error('❌ CSong error:', error.message);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_Unable to download song._\n\n_${error.message || 'Try again later.'}_\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
                case 'video':
                case 'ytmp4':
                case 'ytvideo':
                case 'ytv': {
                    try {
                        const q = args.join(" ").trim();
                        if (!q) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎬

_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠɪᴅᴇᴏ ɴᴀᴍᴇ ᴏʀ ʟɪɴᴋ._

*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}video <ɴᴀᴍᴇ ᴏʀ ʟɪɴᴋ>

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        try { await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } }); } catch(e){}

                        let videoUrl = null, videoTitle = q, videoThumbnail = IMAGE_LINK;
                        if (q.includes('youtube.com') || q.includes('youtu.be')) {
                            videoUrl = q;
                        } else {
                            const search = await yts(q);
                            if (search && search.videos.length > 0) {
                                const v = search.videos[0];
                                videoUrl = v.url;
                                videoTitle = v.title;
                                videoThumbnail = v.thumbnail;
                            }
                        }

                        if (!videoUrl) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴠɪᴅᴇᴏ ɴᴏᴛ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, {
                            image: { url: videoThumbnail },
                            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎬

*ᴛɪᴛʟᴇ ⁚* ${videoTitle}

_ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ..._

${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp4v3?apiKey=${config.YT_API_KEY}&url=${encodeURIComponent(videoUrl)}`;
                        const res = await axios.get(apiUrl, { timeout: 60000 });
                        const data = res.data;

                        const links = data?.data?.download_links || {};
                        const downloadUrl = links.mp4_720p || links.mp4_1080p || links.mp4_360p || null;

                        if (!downloadUrl) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴜɴᴀʙʟᴇ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ._
_ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const videoRes = await axios.get(downloadUrl, {
                            responseType: 'arraybuffer',
                            timeout: 240000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Referer': 'https://save.tube/'
                            },
                            maxContentLength: 500 * 1024 * 1024,
                            maxBodyLength: 500 * 1024 * 1024
                        });
                        const videoBuffer = Buffer.from(videoRes.data);
                        const finalTitle = data?.data?.title || videoTitle;
                        const safeTitle = finalTitle.replace(/[^\w\s\u0D80-\u0DFF-]/g, '').slice(0, 60) || 'video';

                        await socket.sendMessage(sender, {
                            video: videoBuffer,
                            mimetype: 'video/mp4',
                            fileName: `${safeTitle}.mp4`,
                            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*ᴛɪᴛʟᴇ ⁚* ${finalTitle}

_ᴠɪᴅᴇᴏ ꜱᴇɴᴛ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ._ 🎬

${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

                    } catch (error) {
                        console.error('❌ Video error:', error);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴜɴᴀʙʟᴇ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ._
_ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'fb':
                case 'fbdl':
                case 'facebook': {
                    try {
                        const fbUrl = args.join(" ");
                        if (!fbUrl) {
                            return await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📘\n\n_FB link එකක් දෙන්න._\n\n*ᴜꜱᴀɢᴇ ⁚* .fb <url>\n\n${config.BOT_FOOTER}` }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📘\n\n_වීඩියෝව බාගත වෙමින් පවතී..._\n\n${config.BOT_FOOTER}` }, { quoted: msg });

                        const apiUrl = 'https://fb-video-api-hh93.onrender.com/download';
                        const response = await axios.post(apiUrl, { url: fbUrl }, { responseType: 'arraybuffer', timeout: 90000 });
                        const videoBuffer = Buffer.from(response.data);

                        await socket.sendMessage(sender, { video: videoBuffer, mimetype: 'video/mp4', caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📥\n\n_Facebook Video_\n\n${config.BOT_FOOTER}` }, { quoted: msg });
                    } catch (error) {
                        console.error('FB error:', error.message);
                        let errorMsg = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_Failed to download._\n\n${config.BOT_FOOTER}`;
                        if (error.response && error.response.data) {
                            try {
                                const decodedError = JSON.parse(Buffer.from(error.response.data).toString('utf-8'));
                                if (decodedError.detail) errorMsg = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_${decodedError.detail}_\n\n${config.BOT_FOOTER}`;
                            } catch (e) {}
                        }
                        await socket.sendMessage(sender, { text: errorMsg }, { quoted: msg });
                    }
                    break;
                }

                case 'ping': {
                    var inital = new Date().getTime();
                    let ping = await socket.sendMessage(sender, {
                        text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ⚡

_ᴘɪɴɢɪɴɢ..._

${config.BOT_FOOTER}`
                    });
                    var final = new Date().getTime();
                    await socket.sendMessage(sender, { text: '《 █▒▒▒▒▒▒▒▒▒▒▒》10%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ████▒▒▒▒▒▒▒▒》30%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ███████▒▒▒▒▒》50%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ██████████▒▒》80%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ████████████》100%', edit: ping.key });
                    return await socket.sendMessage(sender, {
                        text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ⚡

*ᴘᴏɴɢ ⁚* ${final - inital} ᴍꜱ

${config.BOT_FOOTER}`,
                        edit: ping.key
                    });
                }

                case 'owner': {
                    await socket.sendMessage(sender, { react: { text: "👤", key: msg.key } });

                    const ownerContact = {
                        contacts: {
                            displayName: 'My Contacts',
                            contacts: [
                                { vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN;CHARSET=UTF-8:ɴɪᴍᴀ\nTEL;TYPE=Coder,VOICE:94760743488\nEND:VCARD' },
                                { vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN;CHARSET=UTF-8:ᴅɪɴᴇꜱʜ\nTEL;TYPE=Coder,VOICE:94729119643\nEND:VCARD' },
                                { vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN;CHARSET=UTF-8:ᴏᴡɴᴇʀ\nTEL;TYPE=Coder,VOICE:94741914169\nEND:VCARD' }
                            ]
                        }
                    };

                    const ownerLocation = {
                        location: {
                            degreesLatitude: 6.9271,
                            degreesLongitude: 80.5550,
                            name: 'ɴɪᴍᴀ ᴀᴅᴅʀᴇꜱꜱ',
                            address: 'ᴀᴠɪꜱꜱᴀᴡᴇʟʟᴀ, ꜱʀɪ ʟᴀɴᴋᴀ'
                        }
                    };

                    await socket.sendMessage(sender, ownerContact);
                    await socket.sendMessage(sender, ownerLocation);
                    break;
                }

                case 'system': {
                    let totalRAM = Math.floor(os.totalmem() / 1024 / 1024) + 'ᴍʙ';
                    let cpuSpeed = os.cpus()[0].speed / 1000;
                    let cpuCount = os.cpus().length;

                    const systemCaption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ⚙️

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*

━━━━━━━━━━━━━━━━━━━━

*🖥️ ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ*

*│* ⏱️ *ʀᴜɴᴛɪᴍᴇ ⁚* ${runtime(process.uptime())}
*│* 💾 *ᴛᴏᴛᴀʟ ʀᴀᴍ ⁚* ${totalRAM}
*│* ⚡ *ᴄᴘᴜ ꜱᴘᴇᴇᴅ ⁚* ${cpuSpeed} ɢʜᴢ
*│* 🔧 *ᴄᴘᴜ ᴄᴏʀᴇꜱ ⁚* ${cpuCount}

━━━━━━━━━━━━━━━━━━━━

> *© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
`;

                    await socket.sendMessage(sender, {
                        image: { url: IMAGE_LINK },
                        caption: systemCaption
                    }, { quoted: msg });
                    break;
                }

                case 'vv':
                case 'viewstatus':
                case 'readstatus':
                case 'status': {
                    try {
                        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                        const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;

                        if (!quotedMsg || !participant) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📥

_ʀᴇᴘʟʏ ᴛᴏ ᴀ ꜱᴛᴀᴛᴜꜱ ᴡɪᴛʜ .vv_

*ᴜꜱᴀɢᴇ ⁚* ʀᴇᴘʟʏ → .vv

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        if (!socket.user?.id) return;
                        const myJid = jidNormalizedUser(socket.user.id);
                        const statusKey = { remoteJid: 'status@broadcast', fromMe: false, id: stanzaId, participant };

                        try { await socket.readMessages([statusKey]); } catch (e) {}

                        const statusType = Object.keys(quotedMsg)[0];
                        const mediaType = statusType.replace('Message', '');
                        let buffer = null;

                        if (['imageMessage', 'videoMessage', 'audioMessage'].includes(statusType)) {
                            const stream = await downloadContentFromMessage(quotedMsg[statusType], mediaType);
                            buffer = Buffer.from([]);
                            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                        }

                        if (statusType === 'imageMessage' && buffer) {
                            await socket.sendMessage(myJid, { image: buffer, caption: quotedMsg.imageMessage.caption || '' });
                        } else if (statusType === 'videoMessage' && buffer) {
                            await socket.sendMessage(myJid, { video: buffer, caption: quotedMsg.videoMessage.caption || '', mimetype: 'video/mp4' });
                        } else if (statusType === 'audioMessage' && buffer) {
                            await socket.sendMessage(myJid, { audio: buffer, mimetype: 'audio/mp4', ptt: quotedMsg.audioMessage.ptt || false });
                        } else if (statusType === 'conversation' || statusType === 'extendedTextMessage') {
                            const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';
                            await socket.sendMessage(myJid, { text: text });
                        } else if (statusType === 'stickerMessage') {
                            await socket.sendMessage(myJid, { sticker: quotedMsg.stickerMessage });
                        }

                        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                    } catch (error) {
                        console.error('Status view error:', error);
                        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    }
                    break;
                }

                case 'දාපන්':
                case 'send':
                case 'save': {
                    try {
                        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        if (!quotedMsg) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📥

_ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇꜱꜱᴀɢᴇ ᴡɪᴛʜ .save_

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch(e){}

                        const saveChat = sender;

                        if (quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.documentMessage || quotedMsg.stickerMessage) {
                            const media = await downloadQuotedMedia(quotedMsg);
                            if (!media || !media.buffer) {
                                return await socket.sendMessage(sender, {
                                    text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                                }, { quoted: msg });
                            }

                            if (quotedMsg.imageMessage) {
                                await socket.sendMessage(saveChat, { image: media.buffer, caption: quotedMsg.imageMessage.caption || '' });
                            } else if (quotedMsg.videoMessage) {
                                await socket.sendMessage(saveChat, { video: media.buffer, caption: quotedMsg.videoMessage.caption || '', mimetype: quotedMsg.videoMessage.mimetype || 'video/mp4' });
                            } else if (quotedMsg.audioMessage) {
                                await socket.sendMessage(saveChat, { audio: media.buffer, mimetype: quotedMsg.audioMessage.mimetype || 'audio/mp4', ptt: quotedMsg.audioMessage.ptt || false });
                            } else if (quotedMsg.documentMessage) {
                                const fname = quotedMsg.documentMessage.fileName || `saved_document.${(await FileType.fromBuffer(media.buffer))?.ext || 'bin'}`;
                                await socket.sendMessage(saveChat, { document: media.buffer, fileName: fname, mimetype: quotedMsg.documentMessage.mimetype || 'application/octet-stream' });
                            } else if (quotedMsg.stickerMessage) {
                                await socket.sendMessage(saveChat, { sticker: media.buffer });
                            }
                        } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage) {
                            const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
                            await socket.sendMessage(saveChat, { text: text });
                        } else {
                            if (typeof socket.copyNForward === 'function') {
                                try { await socket.copyNForward(saveChat, msg.key, true); } catch (e) {}
                            }
                        }
                    } catch (error) {
                        console.error('❌ Save error:', error);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜱᴀᴠᴇ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'npm': {
                    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
                    const packageName = q.replace(/^[.\/!]npm\s*/i, '').trim();

                    if (!packageName) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📦

_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘᴀᴄᴋᴀɢᴇ ɴᴀᴍᴇ._

*ᴜꜱᴀɢᴇ ⁚* .npm express

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔎

_ꜱᴇᴀʀᴄʜɪɴɢ ⁚ ${packageName}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                        const apiUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
                        const { data, status } = await axios.get(apiUrl);

                        if (status !== 200) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘᴀᴄᴋᴀɢᴇ ɴᴏᴛ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const latestVersion = data["dist-tags"]?.latest || 'N/A';
                        const description = data.description || 'ɴᴏ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ';
                        const npmUrl = `https://www.npmjs.com/package/${packageName}`;
                        const license = data.license || 'ᴜɴᴋɴᴏᴡɴ';

                        const caption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📦

*📄 ᴘᴀᴄᴋᴀɢᴇ ⁚* ${packageName}
*📝 ᴅᴇꜱᴄ ⁚* ${description}
*⏸️ ᴠᴇʀꜱɪᴏɴ ⁚* ${latestVersion}
*🪪 ʟɪᴄᴇɴꜱᴇ ⁚* ${license}
*🔗 ᴜʀʟ ⁚* ${npmUrl}

${config.BOT_FOOTER}`;

                        await socket.sendMessage(sender, { text: caption }, { quoted: msg });
                    } catch (err) {
                        console.error("NPM error:", err);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴘᴀᴄᴋᴀɢᴇ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'tiktoksearch': {
                    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
                    const query = q.replace(/^[.\/!]tiktoksearch|tiks\s*/i, '').trim();

                    if (!query) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎶

_ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴇᴀʀᴄʜ ᴛᴇʀᴍ._

*ᴜꜱᴀɢᴇ ⁚* .tiktoksearch dance

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔎

_ꜱᴇᴀʀᴄʜɪɴɢ ᴛɪᴋᴛᴏᴋ ⁚ ${query}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                        const apiUrl = `https://apis-starlights-team.koyeb.app/starlight/tiktoksearch?text=${encodeURIComponent(query)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data?.status || !data?.data || data.data.length === 0) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏ ʀᴇꜱᴜʟᴛꜱ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const results = data.data.slice(0, 5).sort(() => Math.random() - 0.5);
                        for (const video of results) {
                            const caption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎶

*📖 ᴛɪᴛʟᴇ ⁚* ${video.title || 'ᴜɴᴋɴᴏᴡɴ'}
*👤 ᴀᴜᴛʜᴏʀ ⁚* ${video.author?.nickname || 'ᴜɴᴋɴᴏᴡɴ'}
*⏱ ᴅᴜʀᴀᴛɪᴏɴ ⁚* ${video.duration || 'ᴜɴᴋɴᴏᴡɴ'}

${config.BOT_FOOTER}`;

                            if (video.nowm) {
                                await socket.sendMessage(sender, { video: { url: video.nowm }, caption: caption }, { quoted: msg });
                            }
                        }
                    } catch (err) {
                        console.error("TikTokSearch error:", err);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜱᴇᴀʀᴄʜ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'apk': {
                    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
                    const query = q.trim();

                    if (!query) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📲

_ᴘʀᴏᴠɪᴅᴇ ᴀɴ ᴀᴘᴘ ɴᴀᴍᴇ._

*ᴜꜱᴀɢᴇ ⁚* .apk Instagram

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, { react: { text: "⬇️", key: msg.key } });
                        const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(query)}/limit=1`;
                        const response = await axios.get(apiUrl);
                        const data = response.data;

                        if (!data.datalist || !data.datalist.list || !data.datalist.list.length) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏ ᴀᴘᴋ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        const app = data.datalist.list[0];
                        const sizeMB = (app.size / (1024 * 1024)).toFixed(2);

                        const caption = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📲

*🎮 ᴀᴘᴘ ⁚* ${app.name}
*📦 ᴘᴀᴄᴋᴀɢᴇ ⁚* ${app.package}
*📅 ᴜᴘᴅᴀᴛᴇᴅ ⁚* ${app.updated}
*📁 ꜱɪᴢᴇ ⁚* ${sizeMB} ᴍʙ

${config.BOT_FOOTER}`;

                        await socket.sendMessage(sender, { react: { text: "⬆️", key: msg.key } });
                        await socket.sendMessage(sender, {
                            document: { url: app.file.path_alt },
                            fileName: `${app.name}.apk`,
                            mimetype: 'application/vnd.android.package-archive',
                            caption,
                            contextInfo: {
                                externalAdReply: {
                                    title: app.name,
                                    body: "ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴘᴋ",
                                    mediaType: 1,
                                    sourceUrl: app.file.path_alt,
                                    thumbnailUrl: app.icon,
                                    renderLargerThumbnail: true,
                                    showAdAttribution: true
                                }
                            }
                        }, { quoted: msg });

                        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });
                    } catch (e) {
                        console.error(e);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_${e.message}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'boom': {
                    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                    const [target, text, countRaw] = q.split(',').map(x => x?.trim());
                    const count = parseInt(countRaw) || 5;

                    if (!target || !text || !count) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 💥

*ᴜꜱᴀɢᴇ ⁚* .boom <ɴᴜᴍ>,<ᴍꜱɢ>,<ᴄᴏᴜɴᴛ>

_ᴇxᴀᴍᴘʟᴇ ⁚_ .boom 94760743488,Hi,5

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    const jid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    if (count > 20) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ʟɪᴍɪᴛ ɪꜱ 20._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(jid, { text });
                        await delay(500);
                    }

                    await socket.sendMessage(sender, {
                        text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 💥

_ꜱᴇɴᴛ ${count}x ᴛᴏ ${target}_

${config.BOT_FOOTER}`
                    }, { quoted: msg });
                    break;
                }

                case 'pair': {
                    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
                    const pairNumber = q.replace(/^[.\/!]pair\s*/i, '').trim();

                    if (!pairNumber) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔗

_ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ._

*ᴜꜱᴀɢᴇ ⁚* .pair 9476066XXXX

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    try {
                        const url = `https://nima-mini-new-1v-1.onrender.com/code?number=${encodeURIComponent(pairNumber)}`;
                        const response = await fetch(url);
                        const bodyText = await response.text();

                        let result;
                        try { result = JSON.parse(bodyText); }
                        catch (e) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ʀᴇꜱᴘᴏɴꜱᴇ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        if (!result || !result.code) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴄᴏᴅᴇ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔗

*01* 📋 ᴄᴏᴘʏ ᴛʜɪꜱ ᴄᴏᴅᴇ
*02* 🔗 ɢᴏ ᴛᴏ ʟɪɴᴋ ᴅᴇᴠɪᴄᴇ
*03* ✂️ ᴘᴀꜱᴛᴇ ᴛʜᴇ ᴄᴏᴅᴇ

*🔑 ʏᴏᴜʀ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ ⁚*
*${result.code}*

${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        await sleep(1000);
                        await socket.sendMessage(sender, { text: `*${result.code}*` }, { quoted: msg });
                    } catch (err) {
                        console.error("❌ Pair Error:", err);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘᴀɪʀ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'jid': {
                    try {
                        const chatJid = sender;
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🆔

_${chatJid}_

${config.BOT_FOOTER}`
                        });
                        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                    } catch (e) {
                        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                    }
                    break;
                }

                case 'ai': {
    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';

    if (!q || q.trim() === '') {
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🤖

_ʜɪ! ɪ ᴀᴍ ɴɪᴍᴀ ᴀɪ._

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }

    try {
        const aiResponse = await getNimaAIReply(q, sender);

        if (!aiResponse) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴀɪ ᴇʀʀᴏʀ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, { text: boldify(aiResponse) }, { quoted: msg });

    } catch (err) {
        console.error("NIMA AI Error:", err.response?.data || err.message);
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴀɪ ᴇʀʀᴏʀ._

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}

                case 'cid': {
                    const q = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
                    const channelLink = q.replace(/^[.\/!]cid\s*/i, '').trim();

                    if (!channelLink) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📡

_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ._

*ᴜꜱᴀɢᴇ ⁚* .cid <ʟɪɴᴋ>

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    const match = channelLink.match(/whatsapp\.com\/channel\/([\w-]+)/);
                    if (!match) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    const inviteId = match[1];

                    try {
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔎

_ꜰᴇᴛᴄʜɪɴɢ ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ..._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                        const metadata = await socket.newsletterMetadata("invite", inviteId);

                        if (!metadata || !metadata.id) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏᴛ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const infoText = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📡

*🆔 ɪᴅ ⁚* ${metadata.id}
*📌 ɴᴀᴍᴇ ⁚* ${metadata.name}
*👥 ꜰᴏʟʟᴏᴡᴇʀꜱ ⁚* ${metadata.subscribers?.toLocaleString() || 'N/A'}
*📅 ᴄʀᴇᴀᴛᴇᴅ ⁚* ${metadata.creation_time ? new Date(metadata.creation_time * 1000).toLocaleString("en-GB") : 'ᴜɴᴋɴᴏᴡɴ'}

${config.BOT_FOOTER}`;

                        if (metadata.preview) {
                            await socket.sendMessage(sender, { image: { url: `https://pps.whatsapp.net${metadata.preview}` }, caption: infoText }, { quoted: msg });
                        } else {
                            await socket.sendMessage(sender, { text: infoText }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error("CID error:", err);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴇʀʀᴏʀ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'getdp':
                case 'getpp':
                case 'getprofile': {
                    try {
                        if (!args[0]) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🖼️

_ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ._

*ᴜꜱᴀɢᴇ ⁚* .getdp 947400xxxxx

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        let targetJid = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔍

_ꜰᴇᴛᴄʜɪɴɢ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ..._

${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        let ppUrl;
                        try { ppUrl = await socket.profilePictureUrl(targetJid, "image"); }
                        catch (e) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        let userName = targetJid.split("@")[0];
                        try {
                            const contact = await socket.getContact(targetJid);
                            userName = contact.notify || contact.vname || contact.name || userName;
                        } catch (e) {}

                        await socket.sendMessage(sender, {
                            image: { url: ppUrl },
                            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🖼️

*📞 ɴᴜᴍʙᴇʀ ⁚* +${args[0].replace(/[^0-9]/g, "")}
*👤 ɴᴀᴍᴇ ⁚* ${userName}

${config.BOT_FOOTER}`
                        }, { quoted: msg });

                        try { await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } }); } catch (e) {}
                    } catch (e) {
                        console.error('getdp error:', e);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴇʀʀᴏʀ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'channelreact':
                case 'creact':
                case 'chr':
                case 'react': {
                    try {
                        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                        const q = messageText.split(' ').slice(1).join(' ');

                        if (!q) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 💬

*ᴜꜱᴀɢᴇ ⁚* .react <ʟɪɴᴋ>,<ᴇᴍᴏᴊɪ>

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        let [linkPart, emoji] = q.split(",");
                        if (!linkPart || !emoji) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘʀᴏᴠɪᴅᴇ ʟɪɴᴋ ᴀɴᴅ ᴇᴍᴏᴊɪ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        linkPart = linkPart.trim();
                        emoji = emoji.trim();

                        if (!linkPart.includes('whatsapp.com/channel/')) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        const urlParts = linkPart.split("/");
                        const channelIndex = urlParts.findIndex(part => part === 'channel');

                        if (channelIndex === -1 || channelIndex + 2 >= urlParts.length) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ ꜰᴏʀᴍᴀᴛ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        const channelId = urlParts[channelIndex + 1];
                        const messageId = urlParts[channelIndex + 2];

                        let res;
                        try { res = await socket.newsletterMetadata("invite", channelId); }
                        catch (metadataError) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴄʜᴀɴɴᴇʟ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        if (!res || !res.id) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴄʜᴀɴɴᴇʟ ɴᴏᴛ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        try { await socket.newsletterReactMessage(res.id, messageId, emoji); }
                        catch (reactError) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_${reactError.message}_

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

_ʀᴇᴀᴄᴛᴇᴅ ᴡɪᴛʜ ${emoji}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                        try { await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } }); } catch (e) {}
                    } catch (error) {
                        console.error('channelreact error:', error.message);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_${error.message}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'google':
                case 'gsearch':
                case 'search': {
                    try {
                        if (!args || args.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔍

_ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴇᴀʀᴄʜ ǫᴜᴇʀʏ._

*ᴜꜱᴀɢᴇ ⁚* .google how to code

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        const query = args.join(" ");
                        const apiKey = "AIzaSyDMbI3nvmQUrfjoCJYLS69Lej1hSXQjnWI";
                        const cx = "baf9bdb0c631236e5";
                        const apiUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;

                        const response = await axios.get(apiUrl);
                        if (response.status !== 200 || !response.data.items || response.data.items.length === 0) {
                            await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏ ʀᴇꜱᴜʟᴛꜱ ꜰᴏʀ ⁚ ${query}_

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                            break;
                        }

                        let results = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔍

*ǫᴜᴇʀʏ ⁚* ${query}

`;
                        response.data.items.slice(0, 5).forEach((item, index) => {
                            results += `*${index + 1}. ${item.title}*\n*│* 🔗 ${item.link}\n*│* 📝 ${item.snippet}\n\n`;
                        });
                        results += `${config.BOT_FOOTER}`;

                        await socket.sendMessage(sender, { text: results }, { quoted: msg });
                    } catch (error) {
                        console.error('Google error:', error.message);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_${error.message}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'tt':
                case 'ttdl':
                case 'tiktok': {
                    try {
                        const ttUrl = args.join(" ").trim();
                        if (!ttUrl) {
                            return await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵\n\n_TikTok link එකක් දෙන්න._\n\n*ᴜꜱᴀɢᴇ ⁚* .tt <url>\n\n${config.BOT_FOOTER}` }, { quoted: msg });
                        }

                        if (!/^https?:\/\//i.test(ttUrl)) {
                            return await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_Valid TikTok link එකක් දෙන්න._\n\n${config.BOT_FOOTER}` }, { quoted: msg });
                        }

                        if (!/tiktok\.com/i.test(ttUrl)) {
                            return await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_TikTok link එකක් විතරයි support._\n\n${config.BOT_FOOTER}` }, { quoted: msg });
                        }

                        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch(e){}

                        await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵\n\n_වීඩියෝව බාගත වෙමින් පවතී..._\n\n${config.BOT_FOOTER}` }, { quoted: msg });

                        const tikwmUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(ttUrl)}&hd=1`;
                        const res = await axios.get(tikwmUrl, {
                            timeout: 60000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });

                        if (res.data?.code !== 0 || !res.data?.data) {
                            throw new Error('API returned invalid response');
                        }

                        const r = res.data.data;
                        const videoUrl = r.hdplay || r.play || r.wmplay || null;
                        const title = (r.title || 'TikTok Video').trim();
                        const author = r.author?.nickname || r.author?.unique_id || 'Unknown';
                        const photos = Array.isArray(r.images) && r.images.length > 0 ? r.images : [];

                        if (!videoUrl && photos.length === 0) {
                            throw new Error('No downloadable media found');
                        }

                        if (videoUrl) {
                            await socket.sendMessage(sender, {
                                video: { url: videoUrl },
                                mimetype: 'video/mp4',
                                fileName: `tiktok_${Date.now()}.mp4`,
                                caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📥\n\n*ᴛɪᴛʟᴇ ⁚* ${title}\n*ᴀᴜᴛʜᴏʀ ⁚* ${author}\n\n${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        } else if (photos.length > 0) {
                            const cap = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🖼️\n\n*ᴛɪᴛʟᴇ ⁚* ${title}\n*ᴀᴜᴛʜᴏʀ ⁚* ${author}\n*ᴘʜᴏᴛᴏꜱ ⁚* ${photos.length}\n\n${config.BOT_FOOTER}`;
                            for (let i = 0; i < photos.length; i++) {
                                await socket.sendMessage(sender, {
                                    image: { url: photos[i] },
                                    caption: i === 0 ? cap : ''
                                }, { quoted: msg });
                            }
                        }

                        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

                    } catch (error) {
                        console.error('TikTok error:', error.message);
                        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_${error.message || 'Download failed.'}_\n\n_පොඩ්ඩකින් ආයේ try කරන්න._\n\n${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'seaart': {
                    try {
                        if (!args[0]) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎨

_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʀᴏᴍᴘᴛ._

*ᴜꜱᴀɢᴇ ⁚* .seaart cute cat

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const prompt = args.join(" ");
                        const api = `https://text-to-img.apis-bj-devs.workers.dev/?prompt=${encodeURIComponent(prompt)}`;
                        const res = await axios.get(api);
                        const data = res.data;

                        if (!data || !data.result || data.result.length === 0) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪᴍᴀɢᴇ ɢᴇɴᴇʀᴀᴛɪᴏɴ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        for (let img of data.result) {
                            await socket.sendMessage(sender, {
                                image: { url: img },
                                caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🖼️

*ᴘʀᴏᴍᴘᴛ ⁚* ${prompt}

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error(err);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ⚠️

_ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ɪᴍᴀɢᴇ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'logo': {
                    try {
                        if (!args[0]) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎨

_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʀᴏᴍᴘᴛ._

*ᴜꜱᴀɢᴇ ⁚* .logo cute boy

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const prompt = args.join(" ");
                        const api = `https://seaart-ai.apis-bj-devs.workers.dev/?Prompt=${encodeURIComponent(prompt)}`;
                        const res = await axios.get(api);
                        const data = res.data;

                        if (!data || !data.result || data.result.length === 0) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪᴍᴀɢᴇ ɢᴇɴᴇʀᴀᴛɪᴏɴ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        for (let img of data.result) {
                            await socket.sendMessage(sender, {
                                image: { url: img.url },
                                caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎨

*ᴘʀᴏᴍᴘᴛ ⁚* ${data.prompt}

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error(err);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ⚠️

_ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ɪᴍᴀɢᴇ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }
                case 'x':
case 'scraper': {
    try {
        const targetUrl = args.join(" ");
        if (!targetUrl) {
            return await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🌐\n\n_URL එකක් දෙන්න._\n\n*ᴜꜱᴀɢᴇ ⁚* .apify <url>\n\n${config.BOT_FOOTER}` }, { quoted: msg });
        }

        await socket.sendMessage(sender, { text: `*ɴɪᴍᴀ ꜰᱟමීලි ꜰʀᴇᴇ ʙᴏᴛ* 🔄\n\n_Apify හරහා දත්ත ලබා ගනිමින් පවතී..._\n\n${config.BOT_FOOTER}` }, { quoted: msg });

        // Apify Client එක Initialize කිරීම (ඔබ දුන් Token සහ Actor එක සමඟ)
        const { ApifyClient } = require('apify-client');
        const client = new ApifyClient({
            token: "apify_api_fTLslt3ozFp5Lsp3eSLUnsQcVnDV0X22STK6",
        });

        // Actor එක Run කර ප්‍රතිඵල එනතුරු රැඳී සිටීම
        const run = await client.actor("xxxvideopornhubsex/xxx-porn-videos-xhamster").call({ url: targetUrl });

        // Dataset එකෙන් අයිතම ලබා ගැනීම
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
            throw new Error("දත්ත කිසිවක් හමු නොවීය.");
        }

        // ලැබුණු පළමු දත්තය හෝ අවශ්‍ය විස්තරය User ට යැවීම
        let resultText = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📊\n\n_Dataset ID: ${run.defaultDatasetId}_\n\n`;
        
        // උදාහරණයක් ලෙස පළමු අයිතමයේ සාරාංශයක් දැක්වීම (අවශ්‍ය පරිදි වෙනස් කරගත හැක)
        resultText += `Result: ${JSON.stringify(items[0]).slice(0, 300)}...\n\n${config.BOT_FOOTER}`;

        await socket.sendMessage(sender, { text: resultText }, { quoted: msg });

    } catch (error) {
        console.error('Apify error:', error.message);
        let errorMsg = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_Failed: ${error.message}_\n\n${config.BOT_FOOTER}`;
        await socket.sendMessage(sender, { text: errorMsg }, { quoted: msg });
    }
    break;
}

                case 'pssearch': {
                    try {
                        if (!args[0]) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔍

_ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴇᴀʀᴄʜ ᴛᴇʀᴍ._

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        const query = args.join(" ");
                        const api = `https://chathuradigital.netlify.app/scrape?search=${encodeURIComponent(query)}`;
                        const res = await axios.get(api);
                        const data = res.data;

                        if (!data || !data.results || data.results.length === 0) {
                            return await socket.sendMessage(sender, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏ ʀᴇꜱᴜʟᴛꜱ ꜰᴏʀ ⁚ ${query}_

${config.BOT_FOOTER}`
                            }, { quoted: msg });
                        }

                        for (let item of data.results.slice(0, 5)) {
                            let text = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔍

*${item.title}*

_${item.details.description || 'ɴᴏ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ'}_

`;
                            if (item.download_links && item.download_links.length > 0) {
                                item.download_links.slice(0, 3).forEach((dl) => {
                                    text += `*│* 🔗 ${dl.url}\n`;
                                });
                            }
                            text += `\n${config.BOT_FOOTER}`;
                            await socket.sendMessage(sender, { text: text }, { quoted: msg });
                        }
                    } catch (e) {
                        console.error(e);
                        await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜱᴇᴀʀᴄʜ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'gcstatus':
                case 'groupstatus':
                case 'togstatus': {
                    if (!isCmdOwner) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    if (!sender.endsWith('@g.us')) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ ᴛᴏ ɢʀᴏᴜᴘꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    let groupMeta;
                    try {
                        groupMeta = await socket.groupMetadata(sender);
                    } catch (e) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴄᴏᴜʟᴅɴ'ᴛ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ɪɴꜰᴏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    const actualSender = msg.key.participant || msg.key.participantAlt || sender;
                    const senderParticipant = groupMeta.participants.find(p => digitsOnly(p.id) === digitsOnly(actualSender));
                    const isGroupAdmin = !!(senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin'));

                    if (!isGroupAdmin) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ʏᴏᴜ ᴍᴜꜱᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const teks = args.join(' ') || '';
                    let media = null;
                    let mtype = null;

                    if (quotedMsg) {
                        if (quotedMsg.imageMessage) {
                            mtype = 'image';
                            const d = await downloadQuotedMedia(quotedMsg);
                            media = d?.buffer;
                        } else if (quotedMsg.videoMessage) {
                            mtype = 'video';
                            const d = await downloadQuotedMedia(quotedMsg);
                            media = d?.buffer;
                        } else if (quotedMsg.audioMessage) {
                            mtype = 'audio';
                            const d = await downloadQuotedMedia(quotedMsg);
                            media = d?.buffer;
                        }
                    }

                    if (!media && !teks) {
                        return await socket.sendMessage(sender, {
                            text: `❗ *ᴜꜱᴀɢᴇ:*
${config.PREFIX}gcstatus <text>
ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ/ᴠɪᴅᴇᴏ/ᴀᴜᴅɪᴏ ᴡɪᴛʜ ${config.PREFIX}gcstatus <optional caption>

*Example:* ${config.PREFIX}gcstatus Hello everyone!`
                        }, { quoted: msg });
                    }

                    const peserta = groupMeta.participants.map(v => v.id);

                    try {
                        if (!media) {
                            await socket.sendMessage(sender, {
                                text: teks || 'undefined',
                                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
                            }, { backgroundColor: '#000000', statusJidList: peserta });
                            return await socket.sendMessage(sender, { text: '✅ ᴛᴇxᴛ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ' }, { quoted: msg });
                        }
                        if (mtype === 'image') {
                            await socket.sendMessage(sender, {
                                image: media,
                                caption: teks || '',
                                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
                            }, { statusJidList: peserta });
                            return await socket.sendMessage(sender, { text: '✅ ɪᴍᴀɢᴇ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ' }, { quoted: msg });
                        }
                        if (mtype === 'video') {
                            await socket.sendMessage(sender, {
                                video: media,
                                caption: teks || '',
                                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
                            }, { statusJidList: peserta });
                            return await socket.sendMessage(sender, { text: '✅ ᴠɪᴅᴇᴏ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ' }, { quoted: msg });
                        }
                        if (mtype === 'audio') {
                            await socket.sendMessage(sender, {
                                audio: media,
                                mimetype: 'audio/mp4',
                                ptt: false,
                                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
                            }, { statusJidList: peserta });
                            return await socket.sendMessage(sender, { text: '✅ ᴀᴜᴅɪᴏ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ' }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error('gcstatus error:', err);
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ: ${err.message}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                case 'chstatus':
                case 'channelstatus':
                case 'chpost': {
                    if (!isCmdOwner) {
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }

                    const CHANNEL_JID = config.NEWSLETTER_JID;

                    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const teks = args.join(' ') || '';
                    let media = null;
                    let mtype = null;

                    if (quotedMsg) {
                        if (quotedMsg.imageMessage) {
                            mtype = 'image';
                            const d = await downloadQuotedMedia(quotedMsg);
                            media = d?.buffer;
                        } else if (quotedMsg.videoMessage) {
                            mtype = 'video';
                            const d = await downloadQuotedMedia(quotedMsg);
                            media = d?.buffer;
                        } else if (quotedMsg.audioMessage) {
                            mtype = 'audio';
                            const d = await downloadQuotedMedia(quotedMsg);
                            media = d?.buffer;
                        }
                    }

                    if (!media && !teks) {
                        return await socket.sendMessage(sender, {
                            text: `❗ *ᴜꜱᴀɢᴇ:*
${config.PREFIX}chstatus <text>
ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ/ᴠɪᴅᴇᴏ/ᴀᴜᴅɪᴏ ᴡɪᴛʜ ${config.PREFIX}chstatus <optional caption>

*Example:* ${config.PREFIX}chstatus Hello subscribers!`
                        }, { quoted: msg });
                    }

                    try {
                        if (!media) {
                            await socket.sendMessage(CHANNEL_JID, { text: teks });
                            return await socket.sendMessage(sender, { text: '✅ ᴛᴇxᴛ ᴘᴏꜱᴛᴇᴅ ᴛᴏ ᴄʜᴀɴɴᴇʟ' }, { quoted: msg });
                        }
                        if (mtype === 'image') {
                            await socket.sendMessage(CHANNEL_JID, { image: media, caption: teks || '' });
                            return await socket.sendMessage(sender, { text: '✅ ɪᴍᴀɢᴇ ᴘᴏꜱᴛᴇᴅ ᴛᴏ ᴄʜᴀɴɴᴇʟ' }, { quoted: msg });
                        }
                        if (mtype === 'video') {
                            await socket.sendMessage(CHANNEL_JID, { video: media, caption: teks || '' });
                            return await socket.sendMessage(sender, { text: '✅ ᴠɪᴅᴇᴏ ᴘᴏꜱᴛᴇᴅ ᴛᴏ ᴄʜᴀɴɴᴇʟ' }, { quoted: msg });
                        }
                        if (mtype === 'audio') {
                            await socket.sendMessage(CHANNEL_JID, { audio: media, mimetype: 'audio/mp4', ptt: false });
                            return await socket.sendMessage(sender, { text: '✅ ᴀᴜᴅɪᴏ ᴘᴏꜱᴛᴇᴅ ᴛᴏ ᴄʜᴀɴɴᴇʟ' }, { quoted: msg });
                        }
                    } catch (err) {
                        console.error('chstatus error:', err);
                        return await socket.sendMessage(sender, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ: ${err.message}_

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    }
                    break;
                }

                default:
                    break;
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ._
_ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ._

${config.BOT_FOOTER}`
            });
        }
    });
}

// ============================================
// MESSAGE HANDLER (Presence)
// ============================================
function setupMessageHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (getSetting(number, 'AUTO_RECORDING') === 'on') {
            try { await socket.sendPresenceUpdate('recording', msg.key.remoteJid); }
            catch (error) { /* silent */ }
        }
    });
}

// ============================================
// SESSION MANAGEMENT
// ============================================
async function deleteSessionFromMongo(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        if (!db) return;
        await db.collection('sessions').deleteOne({ number: sanitizedNumber });
    } catch (error) { console.error('deleteSessionFromMongo:', error); }
}

async function renameCredsOnLogout(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        if (!db) return;
        const collection = db.collection('sessions');
        const count = (await collection.countDocuments({ active: false })) + 1;
        await collection.updateOne(
            { number: sanitizedNumber },
            { $rename: { "creds": `delete_creds${count}` }, $set: { active: false } }
        );
    } catch (error) { console.error('renameCredsOnLogout:', error); }
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        if (!db) return null;
        const doc = await db.collection('sessions').findOne({ number: sanitizedNumber, active: true });
        if (!doc) return null;
        return JSON.parse(doc.creds);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

function setupAutoRestart(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection !== 'close') return;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        activeSockets.delete(sanitizedNumber);
        socketCreationTime.delete(sanitizedNumber);

        if (statusCode === 401) {
            console.log(`Logout for ${number}`);
            await renameCredsOnLogout(number);
            return;
        }

        if (_reconnecting.has(sanitizedNumber)) {
            console.log(`Reconnect already pending for ${number}`);
            return;
        }

        _reconnecting.add(sanitizedNumber);
        console.log(`Connection lost for ${number}, reconnecting in 3s...`);

        setTimeout(async () => {
            try {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            } finally {
                _reconnecting.delete(sanitizedNumber);
            }
        }, 3000);
    });
}

// ============================================
// MAIN PAIRING
// ============================================
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    try {
        await initUserEnvIfMissing(sanitizedNumber);
        await initEnvsettings(sanitizedNumber);
    } catch (e) {
        console.error('Settings init failed:', e.message);
    }

    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        await fs.ensureDir(sessionPath);
        await fs.writeFile(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Session restored for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari'),
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false,
            getMessage: async () => undefined
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket, sanitizedNumber);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket, sanitizedNumber);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1000);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Pair code retry: ${retries}`, error.message);
                    await delay(1500 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                if (code) res.send({ code });
                else res.status(500).send({ error: 'Failed to obtain pairing code' });
            }
        } else {
            if (!res.headersSent) {
                res.send({ status: 'already_paired', message: 'Session restored and connecting' });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            try {
                const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
                const db = await initMongo();
                if (!db) return;
                const sessionId = uuidv4();
                await db.collection('sessions').updateOne(
                    { number: sanitizedNumber },
                    {
                        $set: {
                            sessionId,
                            number: sanitizedNumber,
                            creds: fileContent,
                            active: true,
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );
            } catch (e) { console.error('Save creds failed:', e.message); }
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(2000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        const followEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: followEmoji, key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                    } catch (error) { /* silent */ }

                    activeSockets.set(sanitizedNumber, socket);

                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*

━━━━━━━━━━━━━━━━━━━━

*✅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ!*

*📞 ɴᴜᴍʙᴇʀ ⁚* ${sanitizedNumber}
*☣️ ᴄʜᴀɴɴᴇʟ ⁚* ꜰᴏʟʟᴏᴡᴇᴅ
*🟢 ꜱᴛᴀᴛᴜꜱ ⁚* ᴏɴʟɪɴᴇ

━━━━━━━━━━━━━━━━━━━━

*⭕ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴏᴍᴍᴀɴᴅꜱ*
*│* 🟢 .alive — ʙᴏᴛ ꜱᴛᴀᴛᴜꜱ
*│* 📋 .menu — ꜱʜᴏᴡ ᴄᴏᴍᴍᴀɴᴅꜱ
*│* ⚙️ .settings — ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ
*│* 🎼 .song — ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢꜱ
*│* 🎤 .csong — ꜱᴇɴᴅ ᴀꜱ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ
*│* 🎬 .video — ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏꜱ
*│* 📘 .fb — ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ
*│* 🎶 .tiktok — ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ
*│* 🔗 .pair — ᴅᴇᴘʟᴏʏ ᴍɪɴɪ ʙᴏᴛ
*│* 📥 .vv — ᴠɪᴇᴡ ꜱᴛᴀᴛᴜꜱ
*│* 🔄 .update — ᴜᴘᴅᴀᴛᴇ ʙᴏᴛ (ᴏᴡɴᴇʀ)

${config.BOT_FOOTER}`
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'Free-Bot-Session'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}

// ============================================
// ROUTES
// ============================================
router.get('/', async (req, res) => {
    const { number, force } = req.query;
    if (!number) return res.status(400).send({ error: 'Number parameter is required' });

    const forceRepair = force === 'true';
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
    }

    if (forceRepair) {
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        await deleteSessionFromMongo(sanitizedNumber);
        if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({ count: activeSockets.size, numbers: Array.from(activeSockets.keys()) });
});

router.get('/ping', (req, res) => {
    res.status(200).send({ status: 'active', message: 'BOT is running', activesession: activeSockets.size });
});

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) return res.status(404).send({ error: 'No numbers found to connect' });
        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) return res.status(404).send({ error: 'No numbers found to connect' });

        const results = [];
        const promises = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            promises.push(
                EmpirePair(number, mockRes)
                    .then(() => ({ number, status: 'connection_initiated' }))
                    .catch(error => ({ number, status: 'failed', error: error.message }))
            );
        }
        const promiseResults = await Promise.all(promises);
        results.push(...promiseResults);
        res.status(200).send({ status: 'success', connections: results });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const db = await initMongo();
        if (!db) return res.status(500).send({ error: 'MongoDB not connected' });

        const docs = await db.collection('sessions').find({ active: true }).toArray();
        if (docs.length === 0) return res.status(404).send({ error: 'No active sessions found in MongoDB' });

        const results = [];
        const promises = [];
        for (const doc of docs) {
            const number = doc.number;
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            promises.push(
                EmpirePair(number, mockRes)
                    .then(() => ({ number, status: 'connection_initiated' }))
                    .catch(error => ({ number, status: 'failed', error: error.message }))
            );
        }
        const promiseResults = await Promise.all(promises);
        results.push(...promiseResults);
        res.status(200).send({ status: 'success', connections: results });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) return res.status(400).send({ error: 'Number and target number are required' });

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) return res.status(404).send({ error: 'No active session found for this number' });

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({ status: 'success', number: target, about: aboutStatus, setAt: setAt });
    } catch (error) {
        res.status(500).send({ status: 'error', message: `Failed to fetch About status for ${target}.` });
    }
});

// ============================================
// PROCESS HANDLERS
// ============================================
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        try { socket.ws.close(); } catch (e) {}
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    try { client.close(); } catch (e) {}
});

let _restarting = false;
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    if (_restarting) return;
    _restarting = true;
    const name = process.env.PM2_NAME || 'Free-Bot-Session';
    exec(`pm2 restart ${name}`, () => process.exit(1));
    setTimeout(() => process.exit(1), 5000).unref();
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});

// ============================================
// AUTO-RECONNECT ON STARTUP
// ============================================
(async () => {
    try {
        const dbConn = await initMongo();
        if (dbConn) {
            const docs = await dbConn.collection('sessions').find({ active: true }).toArray();
            for (const doc of docs) {
                const number = doc.number;
                if (!activeSockets.has(number)) {
                    const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                    await EmpirePair(number, mockRes);
                }
            }
            console.log('Auto-reconnect completed on startup');
        } else {
            console.log('⚠️ Skipping auto-reconnect - MongoDB not available');
        }
    } catch (error) {
        console.error('Auto-reconnect failed:', error);
    }
})();

// ============================================
// EXPORT
// ============================================
module.exports = router;