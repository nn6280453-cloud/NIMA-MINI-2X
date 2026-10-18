import dns from 'dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { promisify } from 'util';
const execAsync = promisify(exec);
const router = express.Router();
import pino from 'pino';
import moment from 'moment-timezone';
import axios from 'axios';
import yts from 'yt-search';
import fetch from 'node-fetch';
import os from 'os';
import * as FileTypeNS from 'file-type';
// works with both file-type v16 (CJS) and v17+ (ESM)
const FileType = {
    fromBuffer: (buf) => {
        const fn = FileTypeNS.fromBuffer || FileTypeNS.fileTypeFromBuffer || FileTypeNS.default?.fromBuffer;
        return fn ? fn(buf) : Promise.resolve(undefined);
    }
};
import ytdl from '@distube/ytdl-core';
import playdl from '@iamtraction/play-dl';
import { AUTO_REPLY_RULES, AUTO_VOICE_REPLY_RULES } from './autoreply.js';

import { initUserEnvIfMissing } from './settingsdb.js';
import { initEnvsettings, getSetting, setSetting, getFullSettings } from './settings.js';
import https from 'https';
import http from 'http';

// ============================================
// NIMA YT API CONFIG
// ============================================
const NIMA_YT_API = process.env.NIMA_YT_API_URL || 'https://nima-song-api-nocache.up.railway.app';

// ============================================
// IMAGE LINK
// ============================================
const IMAGE_LINK = 'https://files.catbox.moe/gbe1sh.jpg';

// ============================================
// OWNER NUMBERS
// ============================================
const OWNER_NUMBERS = ['94760743488', '94741914169'];

// ============================================
// BAILEYS IMPORT
// ============================================
import makeWASocket, {
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    downloadContentFromMessage,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    proto,
    attachVoip
} from '@japofc/baileys';
// ============================================
// CONFIG
// ============================================
const config = {
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/K4V8721Jlar3shf8HzEZsP',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: IMAGE_LINK,
    NEWSLETTER_JID: '120363409660898486@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    BOT_NAME: 'ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '> © ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥',
    AUTO_LIKE_EMOJI: ['🖤', '❤️', '🤍', '🧡', '💛', '💚', '💙'],
    FALLBACK_EMOJI: ['❤️'],           // ← අලුතෙන් add කරපු එක
    BUTTON_IMAGES: {
        ALIVE: IMAGE_LINK,
        MENU: IMAGE_LINK,
        OWNER: IMAGE_LINK
    },
    YT_API_KEY: 'key_17c099de46c6006f594c19ac6835397f'
};

// ============================================
// 📇 CONTACT AUTO-SAVE helpers
// ============================================
const CONTACTS_FILE = './contacts.json';

function loadContacts() {
    try {
        if (fs.existsSync(CONTACTS_FILE)) {
            return JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8')) || [];
        }
    } catch (e) {}
    return [];
}

function saveContact(jid) {
    try {
        if (!jid || typeof jid !== 'string') return;
        const num = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        if (!num || num.length < 9 || num.length > 15) return;
        const normalized = `${num}@s.whatsapp.net`;
        const contacts = loadContacts();
        if (!contacts.includes(normalized)) {
            contacts.push(normalized);
            fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
            console.log(`📇 Contact saved: ${normalized} (total: ${contacts.length})`);
        }
    } catch (e) {}
}

// ============================================
// 📇 CONTACT SAVER HANDLER (for .ss audience)
// ============================================
function setupContactSaver(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg?.key) return;
            
            const remoteJid = msg.key.remoteJid;
            const participant = msg.key.participant || msg.key.participantAlt;
            
            // Save group participants
            if (participant) saveContact(participant);
            
            // Save direct chat senders
            if (remoteJid && !remoteJid.endsWith('@g.us') 
                && !remoteJid.endsWith('@newsletter') 
                && remoteJid !== 'status@broadcast') {
                saveContact(remoteJid);
            }
        } catch (e) {}
    });
}

// ============================================
// SETTINGS UI
// ============================================
// Keys that can be switched ON/OFF from the settings list
const TOGGLE_KEYS = [
    'AUTO_STATUS_VIEW', 'AUTO_STATUS_REACT', 'AUTO_RECORDING', 'AI_MODE',
    'AUTO_REPLY', 'AUTO_VOICE_REPLY', 'STATUS_AUTO_REPLY', 'ANTI_DELETE', 'CONNECT_MSG', 'AUTO_MSG_REACT', 'ANTI_CALL', 'AUTO_ANSWER'
];

// ============================================
// 🖼️ IMAGE + LIST BUTTON in ONE message
// (image, caption and the "select" list button all belong to the same message)
// Falls back to image message + separate list if the library can't do it.
// ============================================
async function sendImageList(socket, jid, opts, quoted) {
    const { imageUrl, caption, footer, title, buttonText, sections } = opts;
    try {
        const media = await prepareWAMessageMedia(
            { image: { url: imageUrl } },
            { upload: socket.waUploadToServer }
        );

        const nativeSections = sections.map(sec => ({
            title: sec.title,
            rows: sec.rows.map(r => ({
                header: '',
                title: r.title,
                description: r.description || '',
                id: r.rowId
            }))
        }));

        const content = {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        header: proto.Message.InteractiveMessage.Header.create({
                            hasMediaAttachment: true,
                            imageMessage: media.imageMessage
                        }),
                        body: proto.Message.InteractiveMessage.Body.create({ text: caption }),
                        ...(footer ? { footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }) } : {}),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [{
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({ title: buttonText, sections: nativeSections })
                            }]
                        })
                    })
                }
            }
        };

        const waMsg = generateWAMessageFromContent(jid, content, {
            quoted,
            userJid: socket.user?.id
        });
        await socket.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
        return waMsg;
    } catch (e) {
        console.error('⚠️ sendImageList failed, using fallback:', e.message);
        await socket.sendMessage(jid, { image: { url: imageUrl }, caption }, { quoted });
        return await socket.sendMessage(jid, { text: title || ' ', footer, title, buttonText, sections }, { quoted });
    }
}

async function showSettingsMenu(socket, sender, number, msg) {
    const s = getFullSettings(number) || {};

    // read a setting safely (new keys may not exist yet → use default)
    const readVal = (k, def) => {
        let v = s[k];
        if (v === undefined || v === null || v === '') { try { v = getSetting(number, k); } catch (e) {} }
        if (v === undefined || v === null || v === '') v = def;
        if (v === true) return 'on';
        if (v === false) return 'off';
        return v;
    };
    const isOn = (k, def = 'off') => readVal(k, def) === 'on';
    const flag = (k, def = 'off') => isOn(k, def) ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ';
    const cur = (k, v, def = 'off') => (readVal(k, def) === v ? ' ✅' : '');

    const mode = readVal('BOT_MODE', 'public');
    const modeLabel = mode === 'public' ? '🌍 ᴘᴜʙʟɪᴄ'
                    : mode === 'private' ? '🔒 ᴘʀɪᴠᴀᴛᴇ'
                    : '👥 ɢʀᴏᴜᴘꜱ ᴏɴʟʏ';

    const text = `*╭━━━〔 ⚙️ ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ 〕━━━╮*
*┃* 🔥 *ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ*
*╰━━━━━━━━━━━━━━━━━━━╯*

*📊 ᴄᴜʀʀᴇɴᴛ ꜱᴛᴀᴛᴜꜱ*

*│* 🌐 *ʙᴏᴛ ᴍᴏᴅᴇ ⁚* ${modeLabel}
*│* 👁️ *ꜱᴛᴀᴛᴜꜱ ᴠɪᴇᴡ ⁚* ${flag('AUTO_STATUS_VIEW')}
*│* ❤️ *ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ ⁚* ${flag('AUTO_STATUS_REACT')}
*│* 🎙️ *ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ ⁚* ${flag('AUTO_RECORDING')}
*│* 🧠 *ɴɪᴍᴀ ᴀɪ ⁚* ${flag('AI_MODE')}
*│* 💬 *ᴀᴜᴛᴏ ʀᴇᴘʟʏ ⁚* ${flag('AUTO_REPLY')}
*│* 🎤 *ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ ⁚* ${flag('AUTO_VOICE_REPLY')}
*│* 📩 *ꜱᴛᴀᴛᴜꜱ ʀᴇᴘʟʏ ⁚* ${flag('STATUS_AUTO_REPLY')}
*│* 🗑️ *ᴀɴᴛɪ ᴅᴇʟᴇᴛᴇ ⁚* ${flag('ANTI_DELETE', 'on')}
*│* 🔔 *ᴄᴏɴɴᴇᴄᴛ ᴍꜱɢ ⁚* ${flag('CONNECT_MSG', 'on')}
*│* 💞 *ᴍꜱɢ ʀᴇᴀᴄᴛ ⁚* ${flag('AUTO_MSG_REACT')}
*│* 📵 *ᴀɴᴛɪ ᴄᴀʟʟ ⁚* ${flag('ANTI_CALL', 'on')}
*│* 📞 *ᴀᴜᴛᴏ ᴀɴꜱᴡᴇʀ ⁚* ${flag('AUTO_ANSWER')}

👇 _ᴛᴀᴘ ᴛʜᴇ ʙᴜᴛᴛᴏɴ ʙᴇʟᴏᴡ ᴛᴏ ᴄʜᴀɴɢᴇ ᴀ ꜱᴇᴛᴛɪɴɢ_

*© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*`;

    // ON / OFF pair of rows
    const onOff = (key, label, onDesc, offDesc, def = 'off') => ([
        { title: `🟢 ${label} ᴏɴ`,  description: `${onDesc}${cur(key, 'on', def)}`,   rowId: `setting:set:${key}:on` },
        { title: `🔴 ${label} ᴏꜰꜰ`, description: `${offDesc}${cur(key, 'off', def)}`, rowId: `setting:set:${key}:off` }
    ]);

    const sections = [
        {
            title: '1️⃣ ʙᴏᴛ ᴍᴏᴅᴇ',
            rows: [
                { title: '🌍 ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ',      description: `ᴀᴠᴀɪʟᴀʙʟᴇ ꜰᴏʀ ᴇᴠᴇʀʏᴏɴᴇ${mode === 'public' ? ' ✅' : ''}`,  rowId: 'setting:setmode:public' },
                { title: '🔒 ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ',     description: `ᴏᴡɴᴇʀ ᴏɴʟʏ${mode === 'private' ? ' ✅' : ''}`,              rowId: 'setting:setmode:private' },
                { title: '👥 ɢʀᴏᴜᴘꜱ ᴏɴʟʏ ᴍᴏᴅᴇ', description: `ɢʀᴏᴜᴘ ᴄʜᴀᴛꜱ ᴏɴʟʏ${mode === 'groups' ? ' ✅' : ''}`,         rowId: 'setting:setmode:groups' }
            ]
        },
        { title: '2️⃣ ꜱᴛᴀᴛᴜꜱ ᴠɪᴇᴡ',  rows: onOff('AUTO_STATUS_VIEW',  '👁️ ꜱᴛᴀᴛᴜꜱ ᴠɪᴇᴡ',  'ᴀᴜᴛᴏ ᴠɪᴇᴡ ꜰʀɪᴇɴᴅꜱ ꜱᴛᴀᴛᴜꜱ ', 'ꜱᴛᴏᴘ ᴀᴜᴛᴏ ꜱᴛᴀᴛᴜꜱ ᴠɪᴇᴡ ') },
        { title: '3️⃣ ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ', rows: onOff('AUTO_STATUS_REACT', '❤️ ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ', 'ᴀᴜᴛᴏ ʀᴇᴀᴄᴛ ᴛᴏ ꜱᴛᴀᴛᴜꜱ ',     'ꜱᴛᴏᴘ ᴀᴜᴛᴏ ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ ') },
        { title: '4️⃣ ʀᴇᴄᴏʀᴅɪɴɢ',    rows: onOff('AUTO_RECORDING',    '🎙️ ʀᴇᴄᴏʀᴅɪɴɢ',    'ꜱʜᴏᴡ ʀᴇᴄᴏʀᴅɪɴɢ ᴘʀᴇꜱᴇɴᴄᴇ ',   'ʜɪᴅᴇ ʀᴇᴄᴏʀᴅɪɴɢ ᴘʀᴇꜱᴇɴᴄᴇ ') },
        { title: '5️⃣ ɴɪᴍᴀ ᴀɪ',       rows: onOff('AI_MODE',           '🧠 ɴɪᴍᴀ ᴀɪ',       'ᴀɪ ʀᴇᴘʟɪᴇꜱ ɪɴ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ ',  'ᴛᴜʀɴ ᴏꜰꜰ ᴀᴜᴛᴏ ᴀɪ ') },
        { title: '6️⃣ ᴀᴜᴛᴏ ʀᴇᴘʟʏ',    rows: onOff('AUTO_REPLY',        '💬 ᴀᴜᴛᴏ ʀᴇᴘʟʏ',    'ᴇɴᴀʙʟᴇ ᴀᴜᴛᴏ ʀᴇᴘʟʏ ',          'ᴅɪꜱᴀʙʟᴇ ᴀᴜᴛᴏ ʀᴇᴘʟʏ ') },
        { title: '7️⃣ ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ',   rows: onOff('AUTO_VOICE_REPLY',  '🎤 ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ',   'ᴇɴᴀʙʟᴇ ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ ',         'ᴅɪꜱᴀʙʟᴇ ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ ') },
        { title: '8️⃣ ꜱᴛᴀᴛᴜꜱ ʀᴇᴘʟʏ',  rows: onOff('STATUS_AUTO_REPLY', '📩 ꜱᴛᴀᴛᴜꜱ ʀᴇᴘʟʏ',  'ꜱᴇɴᴅ ʀᴇᴘʟʏ ᴀꜰᴛᴇʀ ᴠɪᴇᴡɪɴɢ ',   'ꜱᴛᴏᴘ ꜱᴛᴀᴛᴜꜱ ʀᴇᴘʟʏ ') },
        { title: '9️⃣ ᴀɴᴛɪ ᴅᴇʟᴇᴛᴇ',   rows: onOff('ANTI_DELETE',       '🗑️ ᴀɴᴛɪ ᴅᴇʟᴇᴛᴇ',   'ꜱᴇɴᴅ ᴅᴇʟᴇᴛᴇᴅ ᴍꜱɢꜱ ᴛᴏ ʏᴏᴜ ',    'ꜱᴛᴏᴘ ᴅᴇʟᴇᴛᴇᴅ ᴍꜱɢ ᴀʟᴇʀᴛꜱ ', 'on') },
        { title: '🔟 ᴄᴏɴɴᴇᴄᴛ ᴍꜱɢ',   rows: onOff('CONNECT_MSG',       '🔔 ᴄᴏɴɴᴇᴄᴛ ᴍꜱɢ',   'ꜱʜᴏᴡ ᴄᴏɴɴᴇᴄᴛ ᴍᴇꜱꜱᴀɢᴇ ',       'ʜɪᴅᴇ ᴄᴏɴɴᴇᴄᴛ ᴍᴇꜱꜱᴀɢᴇ ', 'on') },
        { title: '1️⃣1️⃣ ᴍꜱɢ ʀᴇᴀᴄᴛ',    rows: onOff('AUTO_MSG_REACT',    '💞 ᴍꜱɢ ʀᴇᴀᴄᴛ',    'ʀᴇᴀᴄᴛ ᴛᴏ ᴇᴠᴇʀʏ ɪɴᴄᴏᴍɪɴɢ ᴍꜱɢ ', 'ꜱᴛᴏᴘ ᴀᴜᴛᴏ ᴍꜱɢ ʀᴇᴀᴄᴛ ') },
        { title: '1️⃣2️⃣ ᴀɴᴛɪ ᴄᴀʟʟ',    rows: onOff('ANTI_CALL',        '📵 ᴀɴᴛɪ ᴄᴀʟʟ',    'ᴀᴜᴛᴏ ʀᴇᴊᴇᴄᴛ ɪɴᴄᴏᴍɪɴɢ ᴄᴀʟʟꜱ ', 'ᴀʟʟᴏᴡ ɪɴᴄᴏᴍɪɴɢ ᴄᴀʟʟꜱ ', 'on') },
        { title: '1️⃣3️⃣ ᴀᴜᴛᴏ ᴀɴꜱᴡᴇʀ', rows: onOff('AUTO_ANSWER', '📞 ᴀᴜᴛᴏ ᴀɴꜱᴡᴇʀ', 'ᴀɴꜱᴡᴇʀ ᴄᴀʟʟꜱ ᴡɪᴛʜ ᴡᴇʟᴄᴏᴍᴇ.ᴍᴘ3 ', 'ꜱᴛᴏᴘ ᴀᴜᴛᴏ ᴀɴꜱᴡᴇʀ ') }
    ];

    await sendImageList(socket, sender, {
        imageUrl: config.BUTTON_IMAGES.MENU,
        caption: text,
        footer: '',
        title: '⚙️ ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ',
        buttonText: '「 🛠️ ꜱᴇʟᴇᴄᴛ ꜱᴇᴛᴛɪɴɢ 」',
        sections
    }, msg);
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
                    { buttonId: 'setting:setmode:public', buttonText: { displayText: '「 🌍 ᴘᴜʙʟɪᴄ 」' }, type: 1 },
                    { buttonId: 'setting:setmode:private', buttonText: { displayText: '「 🔒 ᴘʀɪᴠᴀᴛᴇ 」' }, type: 1 },
                    { buttonId: 'setting:setmode:groups', buttonText: { displayText: '「 👥 ɢʀᴏᴜᴘꜱ ᴏɴʟʏ 」' }, type: 1 },
                    { buttonId: `${config.PREFIX}settings`, buttonText: { displayText: '「 🔙 ʙᴀᴄᴋ ᴛᴏ ꜱᴇᴛᴛɪɴɢꜱ 」' }, type: 1 }
                ],
                headerType: 4
            }, { quoted: msg });
            return;
        }

        if (buttonId.startsWith('setting:set:')) {
            const parts = buttonId.split(':');
            const key = parts[2];
            const val = String(parts[3] || '').toLowerCase();
            if (!TOGGLE_KEYS.includes(key) || (val !== 'on' && val !== 'off')) return;
            await setSetting(number, key, val);
            await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*${key} ⁚* ${val.toUpperCase()}

${config.BOT_FOOTER}`
            }, { quoted: msg });
            await showSettingsMenu(socket, sender, number, msg);
            if (key === 'AUTO_ANSWER') {
                // VoIP auto-answer is attached when the socket connects, so reconnect this session to apply it
                setTimeout(() => {
                    restartSingleSession(number).catch(e => console.error('AUTO_ANSWER restart failed:', e.message));
                }, 1500);
            }
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
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

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
const NIMA_AI_API_URL = 'https://w-nima-ai.up.railway.app/chat';

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

// 🎤 Voice statuses are limited by WhatsApp (30s on many Android versions),
// so .ss posts the WHOLE song as consecutive statuses, each this long.
// (Set a very large number, e.g. 3600, to post the song as ONE long status.)
const STATUS_AUDIO_MAX_SECONDS = 30;
// Safety cap: max number of status parts for one song
const STATUS_MAX_PARTS = 25;

// Real duration of an audio file (WhatsApp Android needs a correct "seconds" value)
async function getAudioDurationSeconds(filePath) {
    try {
        const ffmpegCmd = ffmpegPath ? `"${ffmpegPath}"` : 'ffmpeg';
        let out = '';
        try {
            const r = await execAsync(`${ffmpegCmd} -i "${filePath}" -f null -`, { timeout: 120000, maxBuffer: 20 * 1024 * 1024 });
            out = (r.stderr || '') + (r.stdout || '');
        } catch (e) {
            out = (e.stderr || '') + (e.stdout || '');
        }
        const m = out.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g);
        const last = m && m[m.length - 1] ? m[m.length - 1].match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/) : null;
        const d = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        const pick = last || d;
        if (!pick) return 0;
        const secs = Number(pick[1]) * 3600 + Number(pick[2]) * 60 + Number(pick[3]);
        return Math.max(1, Math.round(secs));
    } catch (e) { return 0; }
}

// ============================================
// 🎵 SONG INFO CAPTION (title / views / duration / release date)
// ============================================
function shortAgo(ago) {
    if (!ago) return 'N/A';
    const m = String(ago).match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?/i);
    if (!m) return String(ago);
    const unit = { second: 's', minute: 'min', hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y' }[m[2].toLowerCase()];
    return `${m[1]}${unit} ago`;
}

async function buildSongCaption(videoUrl, fallbackTitle) {
    let title = fallbackTitle || 'Song';
    let views = 'N/A', duration = 'N/A', ago = 'N/A';
    try {
        const idMatch = String(videoUrl).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
        if (idMatch) {
            const d = await yts({ videoId: idMatch[1] });
            if (d) {
                if (d.title) title = d.title;
                if (d.views !== undefined && d.views !== null) views = d.views;
                if (d.timestamp) duration = d.timestamp;
                ago = shortAgo(d.ago || d.uploadDate);
            }
        }
    } catch (e) {
        console.log('⚠️ Song info failed:', e.message);
    }
    return `☘️ *Title: ${title}*\n\n` +
           `❒ *🎭 Vɪᴇᴡꜱ :* ${views}\n` +
           `❒ *⏱️ Dᴜʀᴀᴛɪᴏɴ :* ${duration}\n` +
           `❒ *📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ :* ${ago}\n\n` +
           `*00:00 ───●────────── ${duration}*\n\n` +
           `*ලස්සන රියැක්ට් ඕනී ...💗😽🍃*`;
}

// ============================================
// 🎬 MAKE VIDEO PLAYABLE ON WHATSAPP (H.264 + AAC, faststart MP4)
// ============================================
async function makeWhatsAppVideo(inputBuffer) {
    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const inPath = path.join(os.tmpdir(), `vid_in_${id}.bin`);
    const outPath = path.join(os.tmpdir(), `vid_out_${id}.mp4`);
    const ffmpegCmd = ffmpegPath ? `"${ffmpegPath}"` : 'ffmpeg';
    try {
        await fs.writeFile(inPath, inputBuffer);

        // 1) Probe codecs
        let info = '';
        try {
            const r = await execAsync(`${ffmpegCmd} -hide_banner -i "${inPath}"`, { timeout: 60000, maxBuffer: 20 * 1024 * 1024 });
            info = (r.stderr || '') + (r.stdout || '');
        } catch (e) {
            info = (e.stderr || '') + (e.stdout || '');
        }

        const vLine = (info.match(/Stream #[^\n]*Video:[^\n]*/) || [''])[0];
        const aLine = (info.match(/Stream #[^\n]*Audio:[^\n]*/) || [''])[0];

        if (!vLine) {
            if (/Invalid data found|moov atom not found|could not find codec/i.test(info)) {
                throw new Error('Downloaded file is not a valid video');
            }
            return inputBuffer; // ffmpeg unavailable / unknown → send as is
        }

        const isH264 = /Video:\s*h264/i.test(vLine) && /yuv420p/i.test(vLine);
        const audioOk = !aLine || /Audio:\s*aac/i.test(aLine);

        // 2) Remux (fast) when already H.264/AAC, otherwise re-encode
        const cmd = (isH264 && audioOk)
            ? `${ffmpegCmd} -y -i "${inPath}" -c copy -movflags +faststart -f mp4 "${outPath}"`
            : `${ffmpegCmd} -y -i "${inPath}" -c:v libx264 -preset veryfast -crf 26 -pix_fmt yuv420p ` +
              `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:a aac -b:a 128k -ar 44100 -ac 2 ` +
              `-movflags +faststart -f mp4 "${outPath}"`;

        await execAsync(cmd, { timeout: 900000, maxBuffer: 100 * 1024 * 1024 });

        const out = await fs.readFile(outPath);
        if (!out || out.length === 0) throw new Error('ffmpeg empty output');
        return out;
    } catch (e) {
        if (/not a valid video/i.test(e.message)) throw e;
        console.log('⚠️ Video convert failed, sending original:', e.message);
        return inputBuffer;
    } finally {
        fs.remove(inPath).catch(() => {});
        fs.remove(outPath).catch(() => {});
    }
}

async function convertToOpusOgg(inputBuffer) {
    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const inPath = path.join(os.tmpdir(), `yt_${id}.mp3`);
    const outPath = path.join(os.tmpdir(), `yt_${id}.ogg`);
    try {
        await fs.writeFile(inPath, inputBuffer);
        const ffmpegCmd = ffmpegPath ? `"${ffmpegPath}"` : 'ffmpeg';
        await execAsync(
            `${ffmpegCmd} -y -i "${inPath}" -vn -ar 48000 -ac 1 -c:a libopus -b:a 64k -application voip -map_metadata -1 -f ogg "${outPath}"`,
            { timeout: 300000, maxBuffer: 100 * 1024 * 1024 }
        );
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
// STATUS HANDLER (v2 — LID-safe auto-react)
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
                // ─────── JID selection (CRITICAL for LID accounts) ───────
                // participantAlt = Phone Number JID (PN)  ← WhatsApp status reactions need THIS
                // participant    = LID (Linked ID)        ← NOT accepted by server for status react
                const pnJid       = message.key.participantAlt;   // e.g. 94771234567@s.whatsapp.net
                const lidJid      = message.key.participant;      // e.g. 1234567890@lid
                const reactTarget = pnJid || lidJid;              // PN preferred, LID fallback

                if (!reactTarget) continue;

                // ────────────────────────────────────────────
                // AUTO VIEW
                // ────────────────────────────────────────────
                const viewSetting = getSetting(number, 'AUTO_STATUS_VIEW');
                if (viewSetting === 'on' || viewSetting === true) {
                    let viewed = false;
                    for (let i = 0; i < 3 && !viewed; i++) {
                        try {
                            await socket.readMessages([message.key]);
                            viewed = true;
                        } catch (e) {
                            await delay(800);
                        }
                    }

                    // ─── STATUS AUTO REPLY ───
                    const replySetting = getSetting(number, 'STATUS_AUTO_REPLY');
                    if (viewed && (replySetting === 'on' || replySetting === true)) {
                        try {
                            const posterJid = jidNormalizedUser(lidJid || reactTarget);
                            await socket.sendMessage(posterJid, {
                                text: boldify('ɴɪᴍᴀ ᴍɪɴɪ ꜱᴛᴀᴛᴜꜱ ꜱᴇᴇɴ ᴅᴏɴᴇ')
                            });
                        } catch (err) {
                            console.error('Status auto-reply error:', err?.message || err);
                        }
                    }
                }

                // ────────────────────────────────────────────
                // AUTO REACT
                // ────────────────────────────────────────────
                const reactSetting = getSetting(number, 'AUTO_STATUS_REACT');
                if (reactSetting !== 'on' && reactSetting !== true) continue;

                // Emoji list with safe fallback (random pick from AUTO_LIKE_EMOJI)
                const emojiList = (Array.isArray(config.AUTO_LIKE_EMOJI) && config.AUTO_LIKE_EMOJI.length > 0)
                    ? config.AUTO_LIKE_EMOJI
                    : (config.FALLBACK_EMOJI || ['❤️']);
                const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];

                console.log('👀 Status react attempt:', {
                    pnJid,
                    lidJid,
                    using: reactTarget,
                    emoji,
                    msgId: message.key.id
                });

                // ⚠️ WhatsApp requires status to be SEEN before reacting
                let seen = false;
                for (let i = 0; i < 3 && !seen; i++) {
                    try {
                        await socket.readMessages([message.key]);
                        seen = true;
                    } catch (e) {
                        await delay(1000);
                    }
                }

                if (!seen) {
                    console.log('❌ Could not mark status as viewed, skipping react');
                    continue;
                }

                await delay(1500); // small delay after view before react

                // ─── Build react key with PN JID (participantAlt) ───
                const normalizedTarget = jidNormalizedUser(reactTarget);
                const normalizedLid    = lidJid ? jidNormalizedUser(lidJid) : null;

                const reactKey = {
                    remoteJid: 'status@broadcast',
                    id: message.key.id,
                    participant: normalizedTarget,   // ← PN JID (critical!)
                    fromMe: false
                };

                // ─── Try list: primary PN-only, then PN+LID, then LID-key fallback ───
                const attempts = [
                    {
                        key: reactKey,
                        jidList: [normalizedTarget]
                    },
                    {
                        key: reactKey,
                        jidList: [normalizedTarget, normalizedLid].filter(Boolean)
                    },
                    {
                        key: { ...reactKey, participant: normalizedLid || normalizedTarget },
                        jidList: [normalizedTarget, normalizedLid].filter(Boolean)
                    }
                ];

                let reacted = false;
                for (let i = 0; i < attempts.length && !reacted; i++) {
                    const { key, jidList } = attempts[i];
                    try {
                        await socket.sendMessage('status@broadcast', {
                            react: { text: emoji, key }
                        }, { statusJidList: jidList });
                        reacted = true;
                    } catch (err) {
                        console.error(`Status react attempt ${i + 1} failed:`, err?.message || err);
                        await delay(1000);
                    }
                }

                if (reacted) {
                    console.log(`✅ Status auto-react sent: ${emoji} → ${normalizedTarget}`);
                } else {
                    console.log('❌ All status react attempts failed for', normalizedTarget);
                }
            }
        } catch (e) {
            console.error('Status handler error:', e);
        }
    });
}

// ============================================
// MESSAGE DELETE
// ============================================
async function handleMessageRevocation(socket, number) {
    // 🗑️ ANTI DELETE — deleted messages are sent to the bot's own "You" chat.
    // WhatsApp only tells us the message ID, so we keep a small in-memory
    // cache of incoming messages to be able to show what was deleted.
    const msgCache = new Map();
    const handledDeletes = new Set();
    const CACHE_LIMIT = 1000;

    const cacheMessage = (m) => {
        try {
            if (!m?.key?.id || !m.message) return;
            const jid = m.key.remoteJid || '';
            if (jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
            if (m.key.fromMe) return;
            if (m.message.protocolMessage) return;
            msgCache.set(m.key.id, m);
            if (msgCache.size > CACHE_LIMIT) msgCache.delete(msgCache.keys().next().value);
        } catch (e) {}
    };

    const notifyDeleted = async (key) => {
        try {
            if (!key?.id || !socket.user?.id) return;
            if (handledDeletes.has(key.id)) return;
            handledDeletes.add(key.id);
            if (handledDeletes.size > CACHE_LIMIT) handledDeletes.delete(handledDeletes.values().next().value);

            if (getSetting(number, 'ANTI_DELETE') === 'off') return;
            if (key.fromMe) return;

            const chatJid = key.remoteJid || '';
            if (chatJid === 'status@broadcast' || chatJid.endsWith('@newsletter')) return;

            const myJid = jidNormalizedUser(socket.user.id);
            const isGroup = chatJid.endsWith('@g.us');
            if (!isGroup && digitsOnly(chatJid) === digitsOnly(myJid)) return;

            const cached = msgCache.get(key.id);
            const senderJid = cached?.key?.participantAlt || cached?.key?.participant
                || key.participantAlt || key.participant
                || cached?.key?.remoteJidAlt || key.remoteJidAlt || chatJid;

            let header = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🗑️

*ᴅᴇʟᴇᴛᴇᴅ ᴍᴇꜱꜱᴀɢᴇ*

*ꜰʀᴏᴍ ⁚* +${digitsOnly(senderJid)}
*ᴄʜᴀᴛ ⁚* ${isGroup ? 'ɢʀᴏᴜᴘ' : 'ᴘʀɪᴠᴀᴛᴇ'}
*ᴛɪᴍᴇ ⁚* ${getSriLankaTimestamp()}`;

            if (!cached) {
                await socket.sendMessage(myJid, {
                    text: `${header}\n\n_ᴍᴇꜱꜱᴀɢᴇ ᴄᴏɴᴛᴇɴᴛ ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ (ᴏʟᴅ ᴏʀ ʙᴇꜰᴏʀᴇ ʙᴏᴛ ꜱᴛᴀʀᴛᴇᴅ)._\n\n${config.BOT_FOOTER}`
                });
                return;
            }

            const plainText = cached.message.conversation || cached.message.extendedTextMessage?.text;
            if (plainText) {
                await socket.sendMessage(myJid, {
                    text: `${header}\n\n*ᴍᴇꜱꜱᴀɢᴇ ⁚*\n${plainText}\n\n${config.BOT_FOOTER}`
                });
                return;
            }

            // media / other types → header, then the original message forwarded
            await socket.sendMessage(myJid, { text: `${header}\n\n${config.BOT_FOOTER}` });
            try {
                await socket.sendMessage(myJid, { forward: cached });
            } catch (fe) {
                console.log('Anti-delete forward failed:', fe.message);
                await socket.sendMessage(myJid, { text: '_ᴄᴏᴜʟᴅ ɴᴏᴛ ʀᴇᴄᴏᴠᴇʀ ᴛʜᴇ ᴍᴇᴅɪᴀ ᴏꜰ ᴛʜɪꜱ ᴍᴇꜱꜱᴀɢᴇ._' });
            }
        } catch (e) { console.error('Delete notify fail:', e.message); }
    };

    // cache incoming messages + catch "delete for everyone" (protocol REVOKE)
    socket.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages || []) {
            const proto = m?.message?.protocolMessage;
            if (proto && (proto.type === 0 || proto.type === 'REVOKE') && proto.key) {
                await notifyDeleted({
                    ...proto.key,
                    remoteJid: proto.key.remoteJid || m.key.remoteJid,
                    participant: proto.key.participant || m.key.participant,
                    participantAlt: proto.key.participantAlt || m.key.participantAlt
                });
                continue;
            }
            cacheMessage(m);
        }
    });

    // some versions report the revoke as a message update
    socket.ev.on('messages.update', async (updates) => {
        for (const u of updates || []) {
            const st = u?.update?.messageStubType;
            if (u?.key && (st === 1 || st === 'REVOKE')) await notifyDeleted(u.key);
        }
    });

    socket.ev.on('messages.delete', async (data) => {
        for (const key of (data?.keys || [])) await notifyDeleted(key);
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

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
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
        else if (msg.message.interactiveResponseMessage) {
            let buttonId = null;
            try {
                const params = msg.message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
                buttonId = params ? JSON.parse(params).id : null;
            } catch (e) {}
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
            // ᴀᴜᴛᴏ ʀᴇᴘʟʏ / ᴀᴜᴛᴏ ᴠᴏɪᴄᴇ ʀᴇᴘʟʏ / ᴀᴜᴛᴏ ᴀɪ ʀᴇᴘʟʏ — a plain message
            // (no . prefix) in a private chat can trigger these, per-setting.
            try {
                const isStatusOrChannel = sender === 'status@broadcast' || sender.endsWith('@newsletter');
                const isGroupChat = sender.endsWith('@g.us');
                if (!msg.key.fromMe && !isStatusOrChannel && !isGroupChat) {
                    const plainText = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
                    const keyword = plainText.toLowerCase().normalize('NFC');
                    let handledByKeyword = false;

                    if (plainText && getSetting(number, 'AUTO_REPLY') === 'on' && AUTO_REPLY_RULES[keyword]) {
                        try {
                            await socket.sendMessage(sender, { text: AUTO_REPLY_RULES[keyword] }, { quoted: msg });
                            handledByKeyword = true;
                        } catch (e) {
                            console.error('Auto reply error:', e.message);
                        }
                    }

                    if (plainText && getSetting(number, 'AUTO_VOICE_REPLY') === 'on' && AUTO_VOICE_REPLY_RULES[keyword]) {
                        try {
                            await socket.sendMessage(sender, {
                                audio: { url: AUTO_VOICE_REPLY_RULES[keyword] },
                                mimetype: 'audio/mpeg'
                            }, { quoted: msg });
                            handledByKeyword = true;
                        } catch (e) {
                            console.error('Auto voice reply error:', e.message);
                        }
                    }

                    if (!handledByKeyword && plainText && getSetting(number, 'AI_MODE') === 'on') {
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
            (msg.key.fromMe === true && isOwnerJid(socket.user?.id));

        const currentMode = getSetting(number, 'BOT_MODE') || 'public';
        const isGroupChat = sender.endsWith('@g.us');
        const isChannel = sender.endsWith('@newsletter');

        if (currentMode === 'private' && !isCmdOwner && !isChannel) return;
        if (currentMode === 'groups' && !isGroupChat && !isCmdOwner && !isChannel) return;

        // ⚙️ ON/OFF rows from the settings list (setting:set:KEY:on|off)
        if (command.startsWith('setting:set:')) {
            try {
                if (!isCmdOwner) {
                    return await socket.sendMessage(sender, {
                        text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴄᴀɴɴᴏᴛ ᴄʜᴀɴɢᴇ ꜱᴇᴛᴛɪɴɢꜱ (ᴏᴡɴᴇʀ ᴏɴʟʏ)._

${config.BOT_FOOTER}`
                    }, { quoted: msg });
                }
                await handleSettingButton(socket, sender, number, msg, command);
            } catch (e) { console.error('Setting set error:', e.message); }
            return;
        }

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
                        (msg.key.fromMe === true && isOwnerJid(socket.user?.id));

                    if (!isGlobalOwnerRestart) {
                        try {
                            await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                            await socket.sendMessage(sender, {
                                text: `*╭━━━〔 🔄 ʀᴇꜱᴛᴀʀᴛɪɴɢ 〕━━━╮*
*┃* 🔥 *ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ*
*╰━━━━━━━━━━━━━━━━━━╯*

*│* ⏳ *ꜱᴛᴀᴛᴜꜱ ⁚* ʀᴇꜱᴛᴀʀᴛɪɴɢ ᴛʜɪꜱ ʙᴏᴛ
*│* 🛡️ *ᴏᴛʜᴇʀ ʙᴏᴛꜱ ⁚* ɴᴏᴛ ᴀꜰꜰᴇᴄᴛᴇᴅ
*│* ⏱️ *ʀᴇᴀᴅʏ ɪɴ ⁚* ᴀʙᴏᴜᴛ 5-10 ꜱᴇᴄᴏɴᴅꜱ

_ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ, ʏᴏᴜʀ ʙᴏᴛ ᴡɪʟʟ ʙᴇ ʙᴀᴄᴋ ᴏɴʟɪɴᴇ ꜱᴏᴏɴ_ ✨

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
                            text: `*╭━━━〔 🔄 ʀᴇꜱᴛᴀʀᴛɪɴɢ ᴀʟʟ 〕━━━╮*
*┃* 🔥 *ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ*
*╰━━━━━━━━━━━━━━━━━━━╯*

*│* ⏳ *ꜱᴛᴀᴛᴜꜱ ⁚* ʀᴇꜱᴛᴀʀᴛɪɴɢ ᴀʟʟ ʙᴏᴛꜱ
*│* 👑 *ʀᴇǫᴜᴇꜱᴛᴇᴅ ʙʏ ⁚* ᴏᴡɴᴇʀ
*│* ⏱️ *ʀᴇᴀᴅʏ ɪɴ ⁚* ᴀʙᴏᴜᴛ 30-60 ꜱᴇᴄᴏɴᴅꜱ

_ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ, ᴀʟʟ ʙᴏᴛꜱ ᴡɪʟʟ ʙᴇ ʙᴀᴄᴋ ᴏɴʟɪɴᴇ ꜱᴏᴏɴ_ ✨

${config.BOT_FOOTER}`
                        }, { quoted: msg });
                    } catch (e) {}
                    setTimeout(() => { console.log('🔄 Owner restart-all requested...'); process.exit(1); }, 2000);
                    break;
                }
                case 'xo':
case 'tictactoe':
case 'game': {
    // 1. ගේම් එකේ දත්ත තියාගන්න Global Map එකක් හදාගැනීම
    if (!global.xoGames) global.xoGames = new Map();

    // 2. ගේම් එකට අවශ්‍ය ෆන්ක්ෂන්ස් (Functions) මෙතනම හදාගැනීම
    const checkXOWin = (board, mark) => {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        return winPatterns.some(pattern => pattern.every(index => board[index] === mark));
    };

    const renderXOBoard = (board) => {
        return `*ɴɪᴍᴀ ᴄʏʙᴇʀ ᴀʀᴄᴀᴅᴇ* 🎮\n\n` +
               `${board[0]}  |  ${board[1]}  |  ${board[2]}\n` +
               `-----------------\n` +
               `${board[3]}  |  ${board[4]}  |  ${board[5]}\n` +
               `-----------------\n` +
               `${board[6]}  |  ${board[7]}  |  ${board[8]}\n\n` +
               `*ʏᴏᴜ ⁚* ❌\n*ʙᴏᴛ ⁚* ⭕\n\n` +
               `*ᴛᴏ ᴍᴏᴠᴇ ⁚* .xo <1-9>\n` +
               `*ᴛᴏ ǫᴜɪᴛ ⁚* .xo quit`;
    };

    const getBotMove = (board) => {
        const empty = board.map((val, idx) => (val !== '❌' && val !== '⭕') ? idx : null).filter(val => val !== null);
        for (let i of empty) {
            let temp = [...board]; temp[i] = '⭕';
            if (checkXOWin(temp, '⭕')) return i;
        }
        for (let i of empty) {
            let temp = [...board]; temp[i] = '❌';
            if (checkXOWin(temp, '❌')) return i;
        }
        return empty[Math.floor(Math.random() * empty.length)];
    };

    // 3. ගේම් එකේ ප්‍රධාන Logic එක
    try {
        if (!args[0]) {
            if (!global.xoGames.has(sender)) {
                global.xoGames.set(sender, {
                    board: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'],
                    active: true
                });
                return await socket.sendMessage(sender, { 
                    image: { url: config.IMAGE_PATH },
                    caption: renderXOBoard(global.xoGames.get(sender).board) 
                }, { quoted: msg });
            } else {
                return await socket.sendMessage(sender, { 
                    text: renderXOBoard(global.xoGames.get(sender).board) 
                }, { quoted: msg });
            }
        }

        const action = args[0].toLowerCase();
        if (action === 'quit' || action === 'stop' || action === 'end') {
            global.xoGames.delete(sender);
            return await socket.sendMessage(sender, { text: `*🛑 ɢᴀᴍᴇ ᴇɴᴅᴇᴅ.*` }, { quoted: msg });
        }

        const move = parseInt(action) - 1;
        if (isNaN(move) || move < 0 || move > 8) {
            return await socket.sendMessage(sender, { text: `*❌ ɪɴᴠᴀʟɪᴅ ᴍᴏᴠᴇ. ᴄʜᴏᴏꜱᴇ 1-9.*` }, { quoted: msg });
        }

        let game = global.xoGames.get(sender);
        if (!game) {
            global.xoGames.set(sender, { board: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'], active: true });
            game = global.xoGames.get(sender);
        }

        if (game.board[move] === '❌' || game.board[move] === '⭕') {
            return await socket.sendMessage(sender, { text: `*⚠️ ᴛʜᴀᴛ ꜱᴘᴏᴛ ɪꜱ ᴀʟʀᴇᴀᴅʏ ᴛᴀᴋᴇɴ!*` }, { quoted: msg });
        }

        game.board[move] = '❌';

        if (checkXOWin(game.board, '❌')) {
            global.xoGames.delete(sender);
            return await socket.sendMessage(sender, { text: `*🎉 ᴄᴏɴɢʀᴀᴛꜱ! ʏᴏᴜ ᴡɪɴ!*\n\n${renderXOBoard(game.board)}` }, { quoted: msg });
        }

        if (game.board.every(cell => cell === '❌' || cell === '⭕')) {
            global.xoGames.delete(sender);
            return await socket.sendMessage(sender, { text: `*🤝 ɪᴛ'ꜱ ᴀ ᴅʀᴀᴡ!*\n\n${renderXOBoard(game.board)}` }, { quoted: msg });
        }

        const botMove = getBotMove(game.board);
        game.board[botMove] = '⭕';

        if (checkXOWin(game.board, '⭕')) {
            global.xoGames.delete(sender);
            return await socket.sendMessage(sender, { text: `*🤖 ʙᴏᴛ ᴡɪɴꜱ! ʙᴇᴛᴛᴇʀ ʟᴜᴄᴋ ɴᴇxᴛ ᴛɪᴍᴇ.*\n\n${renderXOBoard(game.board)}` }, { quoted: msg });
        }

        if (game.board.every(cell => cell === '❌' || cell === '⭕')) {
            global.xoGames.delete(sender);
            return await socket.sendMessage(sender, { text: `*🤝 ɪᴛ'ꜱ ᴀ ᴅʀᴀᴡ!*\n\n${renderXOBoard(game.board)}` }, { quoted: msg });
        }

        await socket.sendMessage(sender, { text: renderXOBoard(game.board) }, { quoted: msg });

    } catch (e) {
        console.error('XO Game Error:', e.message);
        await socket.sendMessage(sender, { text: `*❌ ᴇʀʀᴏʀ. ᴛʀʏ ᴀɢᴀɪɴ.*` }, { quoted: msg });
    }
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
> https://nima-mini.zone.id/
> *© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
`;

                    await socket.sendMessage(sender, { react: { text: "🔥", key: msg.key } });
                    await sendImageList(socket, sender, {
                        imageUrl: config.BUTTON_IMAGES.ALIVE,
                        caption: aliveCaption,
                        footer: '',
                        title: '🟢 ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
                        buttonText: '「 ⚡ ꜱᴇʟᴇᴄᴛ ᴀᴄᴛɪᴏɴ 」',
                        sections: [
                            {
                                title: '⚡ ǫᴜɪᴄᴋ ᴀᴄᴛɪᴏɴꜱ',
                                rows: [
                                    { title: '📋 ᴍᴇɴᴜ',            description: 'ᴍᴀɪɴ ᴄᴏᴍᴍᴀɴᴅ ʟɪꜱᴛ',    rowId: `${config.PREFIX}menu` },
                                    { title: '📶 ᴘɪɴɢ',            description: 'ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ',           rowId: `${config.PREFIX}ping` },
                                    { title: '⚙️ ꜱʏꜱᴛᴇᴍ',          description: 'ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ',          rowId: `${config.PREFIX}system` },
                                    { title: '👑 ᴏᴡɴᴇʀ',           description: 'ʙᴏᴛ ᴏᴡɴᴇʀꜱ',           rowId: `${config.PREFIX}owner` },
                                    { title: '🛠️ ꜱᴇᴛᴛɪɴɢꜱ',        description: 'ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ',         rowId: `${config.PREFIX}settings` },
                                    { title: '🎵 ꜱᴏɴɢ ᴅᴏᴡɴʟᴏᴀᴅ',   description: 'ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢꜱ',       rowId: `${config.PREFIX}song` },
                                    { title: '🤖 ɴɪᴍᴀ ᴀɪ',         description: 'ᴄʜᴀᴛ ᴡɪᴛʜ ᴀɪ',         rowId: `${config.PREFIX}ai` }
                                ]
                            }
                        ]
                    }, msg);
                    break;
                }
                case 'gcstatus':
case 'groupstatus':
case 'togstatus': {
    try {
        // 🔒 Owner check
        if (!isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // 👥 Group check
        if (!sender.endsWith('@g.us')) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ ᴛᴏ ɢʀᴏᴜᴘꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // 📋 Group metadata
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

        // 🛡️ Admin check (group admin OR bot owner)
        const actualSender = msg.key.participant || msg.key.participantAlt || sender;
        const senderParticipant = groupMeta.participants.find(p => digitsOnly(p.id) === digitsOnly(actualSender));
        const isGroupAdmin = !!(senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin'));

        if (!isGroupAdmin && !isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ʏᴏᴜ ᴍᴜꜱᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // 📝 Text & quoted media
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

        // ❗ Usage
        if (!media && !teks) {
            return await socket.sendMessage(sender, {
                text: `❗ *ᴜꜱᴀɢᴇ:*
${config.PREFIX}gcstatus <text>
ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ/ᴠɪᴅᴇᴏ/ᴀᴜᴅɪᴏ ᴡɪᴛʜ ${config.PREFIX}gcstatus <optional caption>

*ᴇxᴀᴍᴘʟᴇ:* ${config.PREFIX}gcstatus Hello everyone!`
            }, { quoted: msg });
        }

        const peserta = groupMeta.participants.map(v => v.id);

        // ⏳ React
        try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (e) {}

        // 📤 Send status
        if (!media) {
            await socket.sendMessage(sender, {
                text: teks || 'undefined',
                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
            }, { backgroundColor: '#000000', statusJidList: peserta });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: '✅ ᴛᴇxᴛ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ'
            }, { quoted: msg });
        }

        if (mtype === 'image') {
            await socket.sendMessage(sender, {
                image: media,
                caption: teks || '',
                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
            }, { statusJidList: peserta });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: '✅ ɪᴍᴀɢᴇ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ'
            }, { quoted: msg });
        }

        if (mtype === 'video') {
            await socket.sendMessage(sender, {
                video: media,
                caption: teks || '',
                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
            }, { statusJidList: peserta });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: '✅ ᴠɪᴅᴇᴏ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ'
            }, { quoted: msg });
        }

        if (mtype === 'audio') {
            await socket.sendMessage(sender, {
                audio: media,
                mimetype: 'audio/mp4',
                ptt: false,
                contextInfo: { mentionedJid: peserta, isGroupStatus: true }
            }, { statusJidList: peserta });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: '✅ ᴀᴜᴅɪᴏ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ ᴛᴏ ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ'
            }, { quoted: msg });
        }

    } catch (err) {
        console.error('gcstatus error:', err);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (e) {}
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ: ${err.message}_

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
                
case 'menu': {
    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const menuCaption = `*╭━━━〔 🔥 ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ 🔥 〕━━━╮*
*┃* 👑 *ᴏᴡɴᴇʀ ⁚* ʟᴏᴋᴜ ɴɪᴍᴀ
*┃* 📞 *ɴᴜᴍʙᴇʀ ⁚* 94760743488
*┃* ⏱️ *ᴜᴘᴛɪᴍᴇ ⁚* ${hours}ʜ ${minutes}ᴍ ${seconds}ꜱ
*┃* 🛡️ *ᴠᴇʀꜱɪᴏɴ ⁚* ${config.BOT_VERSION}
*╰━━━━━━━━━━━━━━━━━━━━━━━╯*

*╭─〔 📌 ᴄᴏʀᴇ ᴄᴏᴍᴍᴀɴᴅꜱ 〕*
*│* 🟢 .alive — ʙᴏᴛ ꜱᴛᴀᴛᴜꜱ
*│* 📶 .ping — ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ
*│* ⚙️ .system — ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ
*│* 👑 .owner — ʙᴏᴛ ᴏᴡɴᴇʀꜱ
*│* 🛠️ .settings — ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ
*│* 📋 .menu — ᴍᴀɪɴ ᴍᴇɴᴜ
*│* 🔄 .restart — ʀᴇꜱᴛᴀʀᴛ ʙᴏᴛ
*│* 📥 .update — ᴜᴘᴅᴀᴛᴇ ʙᴏᴛ (ᴏᴡɴᴇʀ)
*│* ♻️ .reload — ʀᴇʟᴏᴀᴅ ʙᴏᴛ (ᴏᴡɴᴇʀ)
*╰──────────────────*

*╭─〔 🎵 ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ 〕*
*│* 🎼 .song — ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢ
*│* 🎵 .mp3 — ᴅᴏᴡɴʟᴏᴀᴅ ᴍᴘ3
*│* 🎤 .csong — ꜱᴇɴᴅ ᴀꜱ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ
*│* 🎬 .video — ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ
*│* 📘 .fb — ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ
*│* 🎶 .tiktok — ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ
*│* 🔍 .tiktoksearch — ᴛɪᴋᴛᴏᴋ ꜱᴇᴀʀᴄʜ
*│* 📲 .apk — ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴘᴋ
*╰──────────────────*

*╭─〔 🛠️ ᴛᴏᴏʟꜱ & ᴀɪ 〕*
*│* 🤖 .ai — ᴄʜᴀᴛ ᴡɪᴛʜ ᴀɪ
*│* 🔍 .google — ꜱᴇᴀʀᴄʜ ᴡᴇʙ
*│* 📦 .npm — ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ ɪɴꜰᴏ
*│* 🖼️ .getdp — ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ
*│* 💥 .boom — ꜱᴇɴᴅ ʙᴏᴍʙ
*│* 👁️ .vv — ꜱᴀᴠᴇ ꜱᴛᴀᴛᴜꜱ
*│* 💾 .save — ꜱᴀᴠᴇ ᴍᴇꜱꜱᴀɢᴇ
*│* 🔗 .url — ɪᴍᴀɢᴇ ᴛᴏ ʟɪɴᴋ
*│* 🎨 .seaart — ᴀɪ ɪᴍᴀɢᴇ ɢᴇɴ
*│* 🎨 .logo — ᴀɪ ʟᴏɢᴏ ɢᴇɴ
*│* 🔎 .pssearch — ꜱᴇᴀʀᴄʜ ᴛᴏᴏʟ
*│* 🎮 .xo — ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ ɢᴀᴍᴇ
*╰──────────────────*

*╭─〔 🌐 ᴡʜᴀᴛꜱᴀᴘᴘ 〕*
*│* 🔗 .pair — ᴘᴀɪʀ ꜱᴇꜱꜱɪᴏɴ
*│* 📡 .cid — ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ
*│* 💬 .react — ᴄʜᴀɴɴᴇʟ ʀᴇᴀᴄᴛ
*│* 📢 .tagall — ᴛᴀɢ ᴀʟʟ (ɢʀᴏᴜᴘ, ᴀᴅᴍɪɴ)
*│* 📊 .gcstatus — ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ (ɢʀᴏᴜᴘ, ᴀᴅᴍɪɴ)
*│* 🎤 .ss — ꜱᴏɴɢ ᴠᴏɪᴄᴇ ꜱᴛᴀᴛᴜꜱ (ᴏᴡɴᴇʀ)
*│* 🖼️ .setdp — ꜱᴇᴛ ꜰᴜʟʟ ᴅᴘ (ᴏᴡɴᴇʀ)
*│* 📌 .setchannel — ꜱᴀᴠᴇ ᴄʜᴀɴɴᴇʟ (ᴏᴡɴᴇʀ)
*│* 🗑️ .delchannel — ʀᴇᴍᴏᴠᴇ ᴄʜᴀɴɴᴇʟ (ᴏᴡɴᴇʀ)
*│* 📣 .chstatus — ᴄʜᴀɴɴᴇʟ ꜱᴛᴀᴛᴜꜱ (ᴏᴡɴᴇʀ)
*│* 🤝 .chf — ᴄʜᴀɴɴᴇʟ ꜰᴏʟʟᴏᴡ ʙᴏᴏꜱᴛ (ᴏᴡɴᴇʀ)
*╰──────────────────*

*🌐 ᴅᴇᴘʟᴏʏ ᴍɪɴɪ ꜱɪᴛᴇ*
> https://nima-mini.zone.id/

*📢 ᴡʜᴀᴛꜱᴀᴘᴘ ᴄʜᴀɴɴᴇʟ*
> https://whatsapp.com/channel/0029Vb8c75l1SWstC9vY7c37

*💬 ᴡʜᴀᴛꜱᴀᴘᴘ ɢʀᴏᴜᴘ*
> ${config.GROUP_INVITE_LINK}

> *© ᴘᴏᴡᴇʀᴅ ʙʏ ʟᴏᴋᴜ ɴɪᴍᴀ 🔥*
`;

    await socket.sendMessage(sender, { react: { text: "🌟", key: msg.key } });
    await sendImageList(socket, sender, {
        imageUrl: config.BUTTON_IMAGES.MENU,
        caption: menuCaption,
        footer: '',
        title: '🔥 ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ',
        buttonText: '「 📋 ꜱᴇʟᴇᴄᴛ ᴄᴏᴍᴍᴀɴᴅ 」',
        sections: [
            {
                title: '📌 ᴄᴏʀᴇ ᴄᴏᴍᴍᴀɴᴅꜱ',
                rows: [
                    { title: '🟢 .alive', description: 'ʙᴏᴛ ꜱᴛᴀᴛᴜꜱ', rowId: `${config.PREFIX}alive` },
                    { title: '📶 .ping', description: 'ꜱᴘᴇᴇᴅ ᴛᴇꜱᴛ', rowId: `${config.PREFIX}ping` },
                    { title: '⚙️ .system', description: 'ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ', rowId: `${config.PREFIX}system` },
                    { title: '👑 .owner', description: 'ʙᴏᴛ ᴏᴡɴᴇʀꜱ', rowId: `${config.PREFIX}owner` },
                    { title: '🛠️ .settings', description: 'ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ', rowId: `${config.PREFIX}settings` },
                    { title: '📋 .menu', description: 'ᴍᴀɪɴ ᴍᴇɴᴜ', rowId: `${config.PREFIX}menu` },
                    { title: '🔄 .restart', description: 'ʀᴇꜱᴛᴀʀᴛ ʙᴏᴛ', rowId: `${config.PREFIX}restart` },
                    { title: '📥 .update', description: 'ᴜᴘᴅᴀᴛᴇ ʙᴏᴛ (ᴏᴡɴᴇʀ)', rowId: `${config.PREFIX}update` },
                    { title: '♻️ .reload', description: 'ʀᴇʟᴏᴀᴅ ʙᴏᴛ (ᴏᴡɴᴇʀ)', rowId: `${config.PREFIX}reload` }
                ]
            },
            {
                title: '🎵 ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ',
                rows: [
                    { title: '🎼 .song', description: 'ᴅᴏᴡɴʟᴏᴀᴅ ꜱᴏɴɢ', rowId: `${config.PREFIX}song` },
                    { title: '🎵 .mp3', description: 'ᴅᴏᴡɴʟᴏᴀᴅ ᴍᴘ3', rowId: `${config.PREFIX}mp3` },
                    { title: '🎤 .csong', description: 'ꜱᴇɴᴅ ᴀꜱ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ', rowId: `${config.PREFIX}csong` },
                    { title: '🎬 .video', description: 'ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ', rowId: `${config.PREFIX}video` },
                    { title: '📘 .fb', description: 'ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ', rowId: `${config.PREFIX}fb` },
                    { title: '🎶 .tiktok', description: 'ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ', rowId: `${config.PREFIX}tiktok` },
                    { title: '🔍 .tiktoksearch', description: 'ᴛɪᴋᴛᴏᴋ ꜱᴇᴀʀᴄʜ', rowId: `${config.PREFIX}tiktoksearch` },
                    { title: '📲 .apk', description: 'ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴘᴋ', rowId: `${config.PREFIX}apk` }
                ]
            },
            {
                title: '🛠️ ᴛᴏᴏʟꜱ & ᴀɪ',
                rows: [
                    { title: '🤖 .ai', description: 'ᴄʜᴀᴛ ᴡɪᴛʜ ᴀɪ', rowId: `${config.PREFIX}ai` },
                    { title: '🔍 .google', description: 'ꜱᴇᴀʀᴄʜ ᴡᴇʙ', rowId: `${config.PREFIX}google` },
                    { title: '📦 .npm', description: 'ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ ɪɴꜰᴏ', rowId: `${config.PREFIX}npm` },
                    { title: '🖼️ .getdp', description: 'ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ', rowId: `${config.PREFIX}getdp` },
                    { title: '💥 .boom', description: 'ꜱᴇɴᴅ ʙᴏᴍʙ', rowId: `${config.PREFIX}boom` },
                    { title: '👁️ .vv', description: 'ꜱᴀᴠᴇ ꜱᴛᴀᴛᴜꜱ', rowId: `${config.PREFIX}vv` },
                    { title: '💾 .save', description: 'ꜱᴀᴠᴇ ᴍᴇꜱꜱᴀɢᴇ', rowId: `${config.PREFIX}save` },
                    { title: '🔗 .url', description: 'ɪᴍᴀɢᴇ ᴛᴏ ʟɪɴᴋ', rowId: `${config.PREFIX}url` },
                    { title: '🎨 .seaart', description: 'ᴀɪ ɪᴍᴀɢᴇ ɢᴇɴ', rowId: `${config.PREFIX}seaart` },
                    { title: '🎨 .logo', description: 'ᴀɪ ʟᴏɢᴏ ɢᴇɴ', rowId: `${config.PREFIX}logo` }
                ]
            },
            {
                title: '🌐 ᴍᴏʀᴇ ᴛᴏᴏʟꜱ',
                rows: [
                    { title: '🔎 .pssearch', description: 'ꜱᴇᴀʀᴄʜ ᴛᴏᴏʟ', rowId: `${config.PREFIX}pssearch` },
                    { title: '🎮 .xo', description: 'ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ ɢᴀᴍᴇ', rowId: `${config.PREFIX}xo` },
                    { title: '🔗 .pair', description: 'ᴘᴀɪʀ ꜱᴇꜱꜱɪᴏɴ', rowId: `${config.PREFIX}pair` },
                    { title: '📡 .cid', description: 'ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ', rowId: `${config.PREFIX}cid` },
                    { title: '💬 .react', description: 'ᴄʜᴀɴɴᴇʟ ʀᴇᴀᴄᴛ', rowId: `${config.PREFIX}react` },
                    { title: '📢 .tagall', description: 'ᴛᴀɢ ᴀʟʟ (ᴀᴅᴍɪɴ)', rowId: `${config.PREFIX}tagall` },
                    { title: '📊 .gcstatus', description: 'ɢʀᴏᴜᴘ ꜱᴛᴀᴛᴜꜱ (ᴀᴅᴍɪɴ)', rowId: `${config.PREFIX}gcstatus` },
                    { title: '🎤 .ss', description: 'ꜱᴏɴɢ ᴠᴏɪᴄᴇ ꜱᴛᴀᴛᴜꜱ', rowId: `${config.PREFIX}ss` },
                    { title: '🖼️ .setdp', description: 'ꜱᴇᴛ ꜰᴜʟʟ ᴅᴘ', rowId: `${config.PREFIX}setdp` },
                    { title: '📣 .chstatus', description: 'ᴄʜᴀɴɴᴇʟ ꜱᴛᴀᴛᴜꜱ', rowId: `${config.PREFIX}chstatus` },
                    { title: '🤝 .chf', description: 'ᴄʜᴀɴɴᴇʟ ꜰᴏʟʟᴏᴡ ʙᴏᴏꜱᴛ (ᴏᴡɴᴇʀ)', rowId: `${config.PREFIX}chf` }
                ]
            }
        ]
    }, msg);
    break;
}
                case 'url': {
    try {
        // 🔗 API URL (hardcoded - constant ඕන නෑ)
        const API_URL = 'https://nima-url-api.onrender.com/api/upload-base64';

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📥

_ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ ᴡɪᴛʜ .url_

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        if (!quotedMsg.imageMessage) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ_

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch(e){}

        const media = await downloadQuotedMedia(quotedMsg);
        if (!media || !media.buffer) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // Size check (32MB limit)
        if (media.buffer.length > 32 * 1024 * 1024) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪᴍᴀɢᴇ ᴛᴏᴏ ʟᴀʀɢᴇ (ᴍᴀx 32ᴍʙ)_

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const base64 = media.buffer.toString('base64');

        // 🚀 API call
        const response = await axios.post(
            API_URL,
            { image: base64 },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        // Response check
        if (!response.data || !response.data.success || !response.data.direct_url) {
            console.error('❌ Bad response:', response.data);
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴜᴘʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const imageUrl = response.data.direct_url || response.data.url;

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ᴍɪɴɪ ᴜʀʟ ꜱᴜᴄᴄᴇꜱꜱ* ⬇️
${imageUrl}`
        }, { quoted: msg });

    } catch (error) {
        // 🔍 Full debug log
        console.error('═══════════════════════════════');
        console.error('❌ URL upload error:', error.message);
        console.error('📋 Code:', error.code);
        console.error('📋 Status:', error.response?.status);
        console.error('📋 Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('═══════════════════════════════');

        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴜᴘʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ._

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}

                // ============================================
                // 🎵 SONG COMMAND (PTT Voice Note)
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
                            caption: await buildSongCaption(videoUrl, videoTitle)
                        }, { quoted: msg });

                        // --- PTT (voice note) ලෙස යවන්න ---
                        // 1) Elite mp3 → ffmpeg → ogg/opus (හොඳම voice note)
                        // 2) ffmpeg fail වුණොත් mp3 එක සාමාන්‍ය audio එකක් ලෙස යවනවා
                        let audioBuffer = null;
                        let sendAsOgg = false;

                        try {
                            const mp3Buf = await getAudioFromEliteAPI(videoUrl, 128);
                            try {
                                audioBuffer = await convertToOpusOgg(mp3Buf);
                                sendAsOgg = true;
                                console.log('✅ Song PTT: Elite + ffmpeg (ogg/opus)');
                            } catch (convErr) {
                                console.log('⚠️ ffmpeg failed, sending mp3 as normal audio:', convErr.message);
                                audioBuffer = mp3Buf;
                                sendAsOgg = false;
                            }
                        } catch (eliteErr) {
                            console.log('❌ Elite failed, trying full fallback chain:', eliteErr.message);
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

                        if (sendAsOgg) {
                            await socket.sendMessage(sender, {
                                audio: audioBuffer,
                                mimetype: 'audio/ogg; codecs=opus',
                                ptt: true
                            }, { quoted: msg });
                        } else {
                            // convert fail වුණොත් සාමාන්‍ය audio එකක් ලෙස යවනවා (play වෙනවා)
                            await socket.sendMessage(sender, {
                                audio: audioBuffer,
                                mimetype: 'audio/mpeg',
                                ptt: false
                            }, { quoted: msg });
                        }

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
            caption: await buildSongCaption(videoUrl, videoTitle)
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
            // convert fail වුණොත් සාමාන්‍ය audio එකක් විදියට යවන්න (play වෙනවා)
            await socket.sendMessage(sender, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false
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
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎬\n\n_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠɪᴅᴇᴏ ɴᴀᴍᴇ ᴏʀ ʟɪɴᴋ._\n\n*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}video <ɴᴀᴍᴇ ᴏʀ ʟɪɴᴋ>\n\n${config.BOT_FOOTER}`
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
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ᴠɪᴅᴇᴏ ɴᴏᴛ ꜰᴏᴜɴᴅ._\n\n${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, {
            image: { url: videoThumbnail },
            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎬\n\n*ᴛɪᴛʟᴇ ⁚* ${videoTitle}\n\n_ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ..._\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });

        // ---- VIDEO DOWNLOAD (inline) ----
        const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp4v3?apiKey=${config.YT_API_KEY}&url=${encodeURIComponent(videoUrl)}`;
        const apiRes = await axios.get(apiUrl, { timeout: 60000 });
        const data = apiRes.data;

        const links = data?.data?.download_links || {};
        const downloadUrl = links.mp4_720p || links.mp4_1080p || links.mp4_360p || null;

        if (!downloadUrl) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            throw new Error('Download link not found');
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
        let videoBuffer = Buffer.from(videoRes.data);

        if (!videoBuffer || videoBuffer.length === 0) {
            throw new Error('Empty video buffer');
        }

        // 🎬 Make sure WhatsApp can play it (H.264 + AAC, faststart)
        videoBuffer = await makeWhatsAppVideo(videoBuffer);

        const finalTitle = data?.data?.title || videoTitle;
        const safeTitle = finalTitle.replace(/[^\w\s\u0D80-\u0DFF-]/g, '').slice(0, 60) || 'video';

        await socket.sendMessage(sender, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: `${safeTitle}.mp4`,
            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅\n\n*ᴛɪᴛʟᴇ ⁚* ${finalTitle}\n\n_ᴠɪᴅᴇᴏ ꜱᴇɴᴛ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ._ 🎬\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

    } catch (error) {
        console.error('❌ Video error:', error.message);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ᴜɴᴀʙʟᴇ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ._\n\n_${error.message || 'ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.'}_\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
// ============================================
// 📢 CHANNEL STATUS — v2 (fixo-baileys sendChannelStatus)
// ============================================

case 'setchannel':
case 'savechannel':
case 'chset': {
    try {
        if (!isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const link = args[0];
        if (!link || !link.includes('whatsapp.com/channel/')) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ._

*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}setchannel <link>

*ᴇxᴀᴍᴘʟᴇ ⁚*
${config.PREFIX}setchannel https://whatsapp.com/channel/0029Vb8c...

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const match = link.match(/channel\/([\w-]+)/);
        if (!match) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ ꜰᴏʀᴍᴀᴛ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (e) {}

        const meta = await socket.newsletterMetadata("invite", match[1]);
        if (!meta || !meta.id) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴄʜᴀɴɴᴇʟ ɴᴏᴛ ꜰᴏᴜɴᴅ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        await setSetting(number, 'STATUS_CHANNEL', meta.id);

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}

        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

_ᴄʜᴀɴɴᴇʟ ꜱᴀᴠᴇᴅ!_

*│* 📛 *ɴᴀᴍᴇ ⁚* ${meta.name || 'N/A'}
*│* 🆔 *ɪᴅ ⁚* ${meta.id}
*│* 👥 *ꜰᴏʟʟᴏᴡᴇʀꜱ ⁚* ${meta.subscribers?.toLocaleString() || 'N/A'}

_ᴅᴀɴ ${config.PREFIX}chstatus ᴜꜱᴇ ᴋᴀʀᴀɴɴᴀ._ 🎯

${config.BOT_FOOTER}`
        }, { quoted: msg });

    } catch (err) {
        console.error('setchannel error:', err);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (e) {}
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ ⁚ ${err.message}_

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}

case 'delchannel':
case 'clearchannel': {
    try {
        if (!isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._\n\n${config.BOT_FOOTER}`
            }, { quoted: msg });
        }
        await setSetting(number, 'STATUS_CHANNEL', '');
        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

_ᴄʜᴀɴɴᴇʟ ʀᴇᴍᴏᴠᴇᴅ._

${config.BOT_FOOTER}`
        }, { quoted: msg });
    } catch (err) {
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_${err.message}_\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}

case 'chstatus':
case 'channelstatus':
case 'chpost': {
    try {
        // 🔒 Owner check
        if (!isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // ℹ️ @japofc/baileys has no native sendChannelStatus — handled by sendChannelStatusCompat()

        // 📡 Channel JID එක ගන්නවා
        let channelJid = getSetting(number, 'STATUS_CHANNEL');
        let teks = args.join(' ').trim();

        // Link එකක් inline pass කරලා නම්
        if (args[0] && args[0].includes('whatsapp.com/channel/')) {
            const match = args[0].match(/channel\/([\w-]+)/);
            if (match) {
                try {
                    const meta = await socket.newsletterMetadata("invite", match[1]);
                    if (meta && meta.id) {
                        channelJid = meta.id;
                        teks = args.slice(1).join(' ').trim();
                    }
                } catch (e) {
                    console.error('Channel lookup error:', e.message);
                }
            }
        }

        if (!channelJid) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɴᴏ ᴄʜᴀɴɴᴇʟ ꜱᴇᴛ._

*ꜱᴛᴇᴘ 1 ⁚* ꜱᴀᴠᴇ ᴀ ᴄʜᴀɴɴᴇʟ
> ${config.PREFIX}setchannel <link>

*ꜱᴛᴇᴘ 2 ⁚* ᴘᴏꜱᴛ ꜱᴛᴀᴛᴜꜱ
> ${config.PREFIX}chstatus <text>

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // 📝 Quoted media ගන්නවා
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
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

        // ❗ Usage
        if (!media && !teks) {
            return await socket.sendMessage(sender, {
                text: `❗ *ᴜꜱᴀɢᴇ ⁚*
${config.PREFIX}chstatus <text>
ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ/ᴠɪᴅᴇᴏ/ᴀᴜᴅɪᴏ ᴡɪᴛʜ ${config.PREFIX}chstatus <optional caption>

*ᴇxᴀᴍᴘʟᴇ ⁚*
${config.PREFIX}chstatus Hello everyone!`
            }, { quoted: msg });
        }

        // ⏳ React
        try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (e) {}

        let res = null;

        // 📤 sendChannelStatus මගින් post කරනවා
        if (!media) {
            // 📝 Text status (colored background)
            res = await sendChannelStatusCompat(socket, channelJid, {
                text: teks || 'undefined',
                backgroundColor: '#000000',
                textColor: '#FFFFFF'
            });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 📝 ᴛᴇxᴛ ꜱᴛᴀᴛᴜꜱ ᴘᴏꜱᴛᴇᴅ
*│* 🆔 ᴍꜱɢ ɪᴅ ⁚* ${res?.key?.id || 'N/A'}

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        if (mtype === 'image') {
            res = await sendChannelStatusCompat(socket, channelJid, {
                image: media,
                caption: teks || ''
            });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 🖼️ ɪᴍᴀɢᴇ ꜱᴛᴀᴛᴜꜱ ᴘᴏꜱᴛᴇᴅ
*│* 🆔 ᴍꜱɢ ɪᴅ ⁚* ${res?.key?.id || 'N/A'}

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        if (mtype === 'video') {
            res = await sendChannelStatusCompat(socket, channelJid, {
                video: media,
                caption: teks || ''
            });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 🎬 ᴠɪᴅᴇᴏ ꜱᴛᴀᴛᴜꜱ ᴘᴏꜱᴛᴇᴅ
*│* 🆔 ᴍꜱɢ ɪᴅ ⁚* ${res?.key?.id || 'N/A'}

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        if (mtype === 'audio') {
            res = await sendChannelStatusCompat(socket, channelJid, {
                audio: media,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                backgroundColor: '#FF1493'
            });

            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 🎙️ ᴠᴏɪᴄᴇ ꜱᴛᴀᴛᴜꜱ ᴘᴏꜱᴛᴇᴅ
*│* 🆔 ᴍꜱɢ ɪᴅ ⁚* ${res?.key?.id || 'N/A'}

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

    } catch (err) {
        console.error('chstatus error:', err);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (e) {}
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ ⁚ ${err.message}_

*ᴛɪᴘ ⁚* ʙᴏᴛ ᴄʜᴀɴɴᴇʟ ᴏᴡɴᴇʀ/ᴀᴅᴍɪɴ ᴠᴇɴɴᴀ ᴏɴᴀ. 🛡️

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

                        const apiUrl = 'https://nima-fb-api.up.railway.app/download';
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

    const q = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || msg.message?.videoMessage?.caption
        || '';
    const pairNumber = q.replace(/^[.\/!]pair\s*/i, '').trim();

    if (!pairNumber) {
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔗

_ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ._

*ᴜꜱᴀɢᴇ ⁚* .pair 9476066XXXX

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }

    const cleanedNumber = pairNumber.replace(/[^0-9]/g, '');
    if (cleanedNumber.length < 9 || cleanedNumber.length > 15) {
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ._

*ᴜꜱᴀɢᴇ ⁚* .pair 9476066XXXX

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }

    // ✅ helper function - fetch walata wada wada karana https request
    const fetchJSON = (url) => {
        return new Promise((resolve, reject) => {
            const lib = url.startsWith('https') ? https : http;
            const req = lib.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 30000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                    }
                    resolve(data);
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        });
    };

    try {
        const BASE_URL = 'https://nima-mini.up.railway.app';
        const url = `${BASE_URL}/code?number=${encodeURIComponent(cleanedNumber)}`;

        console.log("📡 Pair Request:", url);

        const bodyText = await fetchJSON(url);
        console.log("📥 Pair Raw Response:", bodyText);

        let result;
        try { result = JSON.parse(bodyText); }
        catch (e) {
            console.error("❌ JSON Parse Error:", e, bodyText);
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪɴᴠᴀʟɪᴅ ꜱᴇʀᴠᴇʀ ʀᴇꜱᴘᴏɴꜱᴇ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const code = result.code
            || result.pairingCode
            || result.pairCode
            || result.data?.code
            || null;

        if (!code) {
            console.error("❌ No code in result:", result);
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴄᴏᴅᴇ._

*ʀᴇᴀꜱᴏɴ ⁚* ${result.message || result.error || 'Unknown'}

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🔗

*01* 📋 ᴄᴏᴘʏ ᴛʜɪꜱ ᴄᴏᴅᴇ
*02* 🔗 ɢᴏ ᴛᴏ ʟɪɴᴋ ᴅᴇᴠɪᴄᴇ
*03* ✂️ ᴘᴀꜱᴛᴇ ᴛʜᴇ ᴄᴏᴅᴇ

*🔑 ʏᴏᴜʀ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ ⁚*
*${code}*

${config.BOT_FOOTER}`
        }, { quoted: msg });

        await sleep(1000);
        await socket.sendMessage(sender, { text: `*${code}*` }, { quoted: msg });

    } catch (err) {
        console.error("❌ Pair Error:", err.message);
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘᴀɪʀ ꜰᴀɪʟᴇᴅ._

*ᴇʀʀᴏʀ ⁚* ${err.message}

${config.BOT_FOOTER}`
        }, { quoted: msg });
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

                case 'chf':
                case 'chfollow': {
                    try {
                        // 🔒 ONLY the owner number 94741914169
                        const chfOwner =
                            (msg.key.fromMe === true && digitsOnly(socket.user?.id) === '94741914169') ||
                            digitsOnly(msg.key.participant) === '94741914169' ||
                            digitsOnly(msg.key.participantAlt) === '94741914169' ||
                            (!sender.endsWith('@g.us') && !sender.endsWith('@newsletter') &&
                                (digitsOnly(msg.key.remoteJid) === '94741914169' || digitsOnly(msg.key.remoteJidAlt) === '94741914169'));
                        if (!chfOwner) break;

                        const myJid = jidNormalizedUser(socket.user.id);
                        const link = args.find(a => a.includes('whatsapp.com/channel/'));
                        const m = link ? link.match(/channel\/([\w-]+)/) : null;
                        if (!m) {
                            await socket.sendMessage(myJid, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ._\n\n*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}chf <channel link>\n\n${config.BOT_FOOTER}`
                            });
                            break;
                        }

                        const meta = await socket.newsletterMetadata('invite', m[1]);
                        if (!meta || !meta.id) {
                            await socket.sendMessage(myJid, {
                                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ᴄʜᴀɴɴᴇʟ ɴᴏᴛ ꜰᴏᴜɴᴅ._\n\n${config.BOT_FOOTER}`
                            });
                            break;
                        }

                        // every connected bot follows the channel
                        let ok = 0, fail = 0;
                        for (const [, sock] of activeSockets) {
                            try {
                                await sock.newsletterFollow(meta.id);
                                ok++;
                            } catch (e) {
                                if (/already|conflict/i.test(String(e?.message))) ok++; else fail++;
                            }
                            await delay(1500);
                        }

                        await socket.sendMessage(myJid, {
                            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 📛 *ɴᴀᴍᴇ ⁚* ${meta.name || 'N/A'}
*│* 🆔 *ɪᴅ ⁚* ${meta.id}
*│* ✅ *ꜰᴏʟʟᴏᴡᴇᴅ ʙʏ ⁚* ${ok} ʙᴏᴛꜱ
*│* ❌ *ꜰᴀɪʟᴇᴅ ⁚* ${fail}

${config.BOT_FOOTER}`
                        });
                    } catch (err) {
                        console.error('chf error:', err.message);
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

        // ⭐ අලුත් NPM පැකේජ් එක require කරනවා
        const _ttMod = await import("@ssut/tiktok-api");
        const TikTokClient = _ttMod.TikTokClient || _ttMod.default?.TikTokClient;
        
        // Client එක හදනවා (Region එක US වගේ දාන්න)
        const client = new TikTokClient({ region: "US" });
        
        // TikTok API එකට කෝල් කරනවා
        const download = await client.downloadVideo(ttUrl);

        // සාර්ථකද කියලා චෙක් කරනවා
        if (download.status !== "success" || !download.result) {
            throw new Error(download.message || "TikTok API error");
        }

        const result = download.result;

        // Photos (Slideshow) නම් ඒක handle කරනවා
        if (result.type === "image" && result.images && result.images.length > 0) {
            const cap = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🖼️\n\n*ᴛɪᴛʟᴇ ⁚* ${result.title || 'TikTok Slideshow'}\n*ᴀᴜᴛʜᴏʀ ⁚* ${result.author?.nickname || 'Unknown'}\n\n${config.BOT_FOOTER}`;
            
            for (let i = 0; i < result.images.length; i++) {
                await socket.sendMessage(sender, {
                    image: { url: result.images[i] },
                    caption: i === 0 ? cap : ''
                }, { quoted: msg });
            }
            try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}
            return; // වැඩේ ඉවර නිසා මෙතනින් නවතිනවා
        }

        // වීඩියෝ නම් formats array එකෙන් හොඳම එක ගන්නවා
        if (result.type !== "video" || !result.video || !result.video.formats || result.video.formats.length === 0) {
            throw new Error("No downloadable video found");
        }

        // Formats අතරින් පළවෙනි එක (හෝ HD එක) තෝරාගන්නවා
        // සාමාන්‍යයෙන් formats[0] එකේ තමයි හොඳම quality එක තියෙන්නේ
        const videoUrl = result.video.formats[0].url;

        // වීඩියෝ එක Buffer එකකට බාගන්නවා (WhatsApp එකට යවන්න)
        const videoResponse = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const videoBuffer = Buffer.from(videoResponse.data);

        if (videoBuffer.length < 10000) {
            throw new Error("Downloaded video is too small (blocked by TikTok)");
        }

        // WhatsApp එකට වීඩියෝ එක යවනවා
        await socket.sendMessage(sender, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            fileName: `tiktok_${Date.now()}.mp4`,
            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📥\n\n*ᴛɪᴛʟᴇ ⁚* ${result.title || 'TikTok Video'}\n*ᴀᴜᴛʜᴏʀ ⁚* ${result.author?.nickname || 'Unknown'}\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });

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
        const api = `https://nima-logo-api.onrender.com/ai-logo?prompt=${encodeURIComponent(prompt)}`;
        const res = await axios.get(api, { responseType: 'arraybuffer' });

        if (!res || !res.data || res.data.length === 0) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ɪᴍᴀɢᴇ ɢᴇɴᴇʀᴀᴛɪᴏɴ ꜰᴀɪʟᴇᴅ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        await socket.sendMessage(sender, {
            image: Buffer.from(res.data),
            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎨

*ᴘʀᴏᴍᴘᴛ ⁚* ${prompt}

${config.BOT_FOOTER}`
        }, { quoted: msg });
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
case 'tagall':
case 'everyone':
case 'all': {
    try {
        // 🔍 Group check
        if (!sender.endsWith('@g.us')) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴏɴʟʏ ᴡᴏʀᴋꜱ ɪɴ ɢʀᴏᴜᴘꜱ_

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // ⏳ React
        try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch(e){}

        // 📋 Get group metadata
        let groupMetadata;
        try {
            groupMetadata = await socket.groupMetadata(sender);
        } catch (e) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴄᴏᴜʟᴅɴ'ᴛ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ɪɴꜰᴏ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const participants = groupMetadata.participants;

        // 🔍 Admin check (group admin OR bot owner)
        const actualSender = msg.key.participant || msg.key.participantAlt || sender;
        const senderParticipant = participants.find(p => digitsOnly(p.id) === digitsOnly(actualSender));
        const isGroupAdmin = !!(senderParticipant && (senderParticipant.admin === 'admin' || senderParticipant.admin === 'superadmin'));

        if (!isGroupAdmin && !isCmdOwner) {
            try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // 📝 Message text
        const q = args.join(' ').trim() || 'No message';

        // 📝 Build tag text (with mention limit handling)
        const MAX_MENTIONS = 50;
        const mentionJids = participants.map(p => p.id);
        const messageHeader = `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 📢\n\n*ᴛᴀɢ ᴀʟʟ*\n\n*ᴍᴇꜱꜱᴀɢᴇ:* ${q}\n\n`;

        // WhatsApp mention limit එකට split කරන්න
        for (let i = 0; i < participants.length; i += MAX_MENTIONS) {
            const chunk = participants.slice(i, i + MAX_MENTIONS);
            let tagText = i === 0 ? messageHeader : '';
            for (let mem of chunk) {
                tagText += `🔹 @${mem.id.split('@')[0]}\n`;
            }
            if (i === 0) tagText += `\n${config.BOT_FOOTER}`;

            await socket.sendMessage(sender, {
                text: tagText,
                mentions: chunk.map(p => p.id)
            }, { quoted: i === 0 ? msg : undefined });
        }

        // ✅ React
        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

    } catch (error) {
        console.error('═══════════════════════════════');
        console.error('❌ Tagall error:', error.message);
        console.error('📋 Code:', error.code);
        console.error('═══════════════════════════════');

        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
        await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛᴀɢᴀʟʟ ꜰᴀɪʟᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ._

${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
case 'setdp':
case 'fulldp':
case 'setprofile': {
    try {
        // 🔒 Owner check
        if (!isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._\n\n${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let imageBuffer = null;

        // 📥 Image එක ගන්නවා (reply කරපු එකෙන් හෝ කෙලින්ම එවපු එකෙන්)
        if (quotedMsg?.imageMessage) {
            const d = await downloadQuotedMedia(quotedMsg);
            imageBuffer = d?.buffer;
        } else if (msg.message?.imageMessage) {
            const d = await downloadQuotedMedia(msg.message);
            imageBuffer = d?.buffer;
        }

        if (!imageBuffer) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ._\n\n${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } }); } catch (e) {}

        // 🖼️ Panorama Profile Picture එක use කරලා full-size DP එක set කරනවා
        // මේකෙන් ඕනෑම aspect ratio එකක පින්තූරයක් crop නොවී වැටෙනවා.
        await setFullProfilePictureCompat(socket, socket.user.id, imageBuffer);

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch (e) {}

        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅\n\n_ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴜᴘᴅᴀᴛᴇᴅ!_\n\n_ꜰᴜʟʟ ɪᴍᴀɢᴇ ⁚ ᴠɪꜱɪʙʟᴇ_ 🖼️\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });

    } catch (err) {
        console.error('setdp error:', err);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch (e) {}
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌\n\n_ꜰᴀɪʟᴇᴅ ⁚ ${err.message}_\n\n${config.BOT_FOOTER}`
        }, { quoted: msg });
    }
    break;
}
case 'ss':
case 'songstatus':
case 'statusong': {
    try {
        // 🔒 Owner check
        if (!isCmdOwner) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ᴏᴡɴᴇʀꜱ ᴏɴʟʏ._

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        const q = args.join(' ').trim();
        if (!q) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵

_ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴏɴɢ ʟɪɴᴋ._

*ᴜꜱᴀɢᴇ ⁚* ${config.PREFIX}ss <link>

*ꜱᴜᴘᴘᴏʀᴛᴇᴅ ⁚*
› ʏᴏᴜᴛᴜʙᴇ ʟɪɴᴋ
› ᴅɪʀᴇᴄᴛ ᴀᴜᴅɪᴏ ʟɪɴᴋ (ᴄᴀᴛʙᴏx, ᴇᴛᴄ.)

*ᴇxᴀᴍᴘʟᴇꜱ ⁚*
${config.PREFIX}ss https://youtu.be/xxxxx
${config.PREFIX}ss https://files.catbox.moe/xxxxx.mp3

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        // 🔍 Detect link type
        const isYouTube = q.includes('youtube.com') || q.includes('youtu.be');
        const isDirectAudio = /^https?:\/\/.+\.(mp3|ogg|m4a|opus|wav|aac|webm)(\?.*)?$/i.test(q)
                              || q.includes('catbox.moe')
                              || q.includes('cdn.discordapp.com')
                              || q.includes('files.catbox.moe');

        if (!isYouTube && !isDirectAudio) {
            return await socket.sendMessage(sender, {
                text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ʟɪɴᴋ._

*ꜱᴜᴘᴘᴏʀᴛᴇᴅ ⁚*
› ʏᴏᴜᴛᴜʙᴇ.ᴄᴏᴍ / ʏᴏᴜᴛᴜ.ʙᴇ
› ᴅɪʀᴇᴄᴛ ᴀᴜᴅɪᴏ ʟɪɴᴋ (ᴍᴘ3/ᴏɢɢ/ᴍ4ᴀ)

${config.BOT_FOOTER}`
            }, { quoted: msg });
        }

        try { await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } }); } catch(e){}

        let videoTitle = isYouTube ? 'Song' : 'Audio';
        let videoThumbnail = IMAGE_LINK;
        let videoDuration = '';

        // ─────────────────────────────────────────
        // 📋 Get title (YouTube only)
        // ─────────────────────────────────────────
        if (isYouTube) {
            try {
                const info = await ytdl.getInfo(q);
                videoTitle = info.videoDetails.title || 'Song';
                videoThumbnail = info.videoDetails.thumbnails?.slice(-1)?.[0]?.url || IMAGE_LINK;
                videoDuration = info.videoDetails.lengthSeconds
                    ? `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${String(info.videoDetails.lengthSeconds % 60).padStart(2, '0')}`
                    : '';
            } catch (e) {
                console.log('⚠️ ytdl info failed:', e.message);
            }
        } else {
            try {
                const urlObj = new URL(q);
                const fileName = urlObj.pathname.split('/').pop() || 'audio';
                videoTitle = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
            } catch (_) {}
        }

        // 📤 Progress message
        await socket.sendMessage(sender, {
            image: { url: videoThumbnail },
            caption: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* 🎵

*ᴛɪᴛʟᴇ ⁚* ${videoTitle}
*ꜱᴏᴜʀᴄᴇ ⁚* ${isYouTube ? 'ʏᴏᴜᴛᴜʙᴇ' : 'ᴅɪʀᴇᴄᴛ ʟɪɴᴋ'}
${videoDuration ? `*ᴅᴜʀᴀᴛɪᴏɴ ⁚* ${videoDuration}\n` : ''}
_ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ..._

${config.BOT_FOOTER}`
        }, { quoted: msg });

        // ─────────────────────────────────────────
        // ⬇️ Download audio
        // ─────────────────────────────────────────
        let rawAudio = null;

        if (isDirectAudio) {
            console.log('⬇️ Downloading direct audio link...');
            const res = await axios.get(q, {
                responseType: 'arraybuffer',
                timeout: 180000,
                maxContentLength: 300 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0' },
                validateStatus: () => true
            });

            if (res.status !== 200) throw new Error(`Download HTTP ${res.status}`);
            rawAudio = Buffer.from(res.data);
            if (rawAudio.length < 1024) throw new Error('File too small');

            const contentType = String(res.headers['content-type'] || '').toLowerCase();
            console.log(`📦 Downloaded: ${(rawAudio.length / 1024 / 1024).toFixed(2)} MB, type: ${contentType}`);
        } else {
            try {
                rawAudio = await getAudioFromEliteAPI(q, 128);
            } catch (eliteErr) {
                console.log('❌ Elite failed, trying full chain:', eliteErr.message);
                try {
                    rawAudio = await getAudioBufferFromYT(q, 'mp3');
                } catch (_) {
                    rawAudio = await getAudioBufferFromYT(q, 'ogg');
                }
            }
        }

        if (!rawAudio || rawAudio.length === 0) {
            throw new Error('Empty audio buffer');
        }

        // ─────────────────────────────────────────
        // 🎤 Convert → proper Opus/OGG PTT (FIXED ffmpeg command)
        // ─────────────────────────────────────────
        console.log('🎤 Converting to PTT (Opus/OGG)...');

        const _fs = fs;
        const _path = path;
        const _os = os;
        const _execAsync = execAsync;

        const tempId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const inPath = _path.join(_os.tmpdir(), `ptt_in_${tempId}.mp3`);
        const outPath = _path.join(_os.tmpdir(), `ptt_out_${tempId}.ogg`);

        await _fs.writeFile(inPath, rawAudio);

        let pttBuffer = null;
        let audioSeconds = 0;
        let statusParts = [];   // [{ buffer, seconds }]

        try {
            // Try ffmpeg-static first
            let ffmpegCmd = 'ffmpeg';
            if (ffmpegPath) ffmpegCmd = `"${ffmpegPath}"`;

            // ─── Convert the WHOLE song and cut it into WhatsApp-sized parts ───
            const segPattern = _path.join(_os.tmpdir(), `ptt_seg_${tempId}_%03d.ogg`);
            await _execAsync(
                `${ffmpegCmd} -y -i "${inPath}" ` +
                `-vn -ar 48000 -ac 1 -c:a libopus -b:a 64k ` +
                `-application voip -map_metadata -1 ` +
                `-f segment -segment_time ${STATUS_AUDIO_MAX_SECONDS} -segment_format ogg -reset_timestamps 1 ` +
                `"${segPattern}"`,
                { timeout: 900000, maxBuffer: 100 * 1024 * 1024 }
            );
            console.log('✅ Converted to Opus PTT parts');

            const segPrefix = `ptt_seg_${tempId}_`;
            const segFiles = (await _fs.readdir(_os.tmpdir()))
                .filter(f => f.startsWith(segPrefix) && f.endsWith('.ogg'))
                .sort()
                .slice(0, STATUS_MAX_PARTS);

            for (const f of segFiles) {
                const fp = _path.join(_os.tmpdir(), f);
                const buf = await _fs.readFile(fp);
                if (buf.length > 0) {
                    const secs = (await getAudioDurationSeconds(fp)) || Math.ceil(buf.length / 8000);
                    statusParts.push({ buffer: buf, seconds: secs });
                }
                _fs.remove(fp).catch(() => {});
            }
            console.log(`🎤 Parts: ${statusParts.length}`);

        } catch (ffErr) {
            console.error('❌ ffmpeg PTT error:', ffErr.message);
            console.log('⚠️ Falling back to raw audio as PTT');
            statusParts = [{ buffer: rawAudio, seconds: Math.ceil(rawAudio.length / 16000) }];
        }

        if (statusParts.length === 0) {
            statusParts = [{ buffer: rawAudio, seconds: Math.ceil(rawAudio.length / 16000) }];
        }

        audioSeconds = statusParts.reduce((a, b) => a + b.seconds, 0);
        pttBuffer = Buffer.concat(statusParts.map(x => x.buffer));

        // Cleanup
        _fs.remove(inPath).catch(() => {});

        if (!pttBuffer || pttBuffer.length === 0) {
            throw new Error('PTT buffer empty');
        }

        // ─────────────────────────────────────────
        // 📋 Build statusJidList from saved contacts
        // ─────────────────────────────────────────
        let statusJidList = [];

        try {
            statusJidList = loadContacts();
            console.log(`📇 Contacts from file: ${statusJidList.length}`);
        } catch (e) {
            console.error('Load contacts error:', e.message);
        }

        if (statusJidList.length === 0 && socket.store?.contacts) {
            try {
                statusJidList = Object.values(socket.store.contacts)
                    .filter(c => c?.id && String(c.id).endsWith('@s.whatsapp.net'))
                    .map(c => c.id);
                console.log(`📇 Contacts from store: ${statusJidList.length}`);
            } catch (e) {}
        }

        const myJid = jidNormalizedUser(socket.user?.id);
        if (myJid && !statusJidList.includes(myJid)) {
            statusJidList.push(myJid);
        }

        if (statusJidList.length <= 1) {
            console.log('⚠️ No contacts saved yet — status visible only to YOU');
        }

        console.log(`📤 Posting PTT status (${(pttBuffer.length / 1024 / 1024).toFixed(2)}MB, ${audioSeconds}s, ${statusParts.length} part(s)) to ${statusJidList.length} recipients...`);

        // ─────────────────────────────────────────
        // 🎤 Post PTT STATUS — every part, in order (full song)
        // ─────────────────────────────────────────
        for (let i = 0; i < statusParts.length; i++) {
            const part = statusParts[i];

            // 🎤 Generate waveform (48 bytes)
            const waveform = new Uint8Array(48);
            for (let w = 0; w < 48; w++) {
                waveform[w] = Math.floor(Math.random() * 60) + 20;
            }

            await socket.sendMessage('status@broadcast', {
                audio: part.buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                seconds: part.seconds,
                waveform: Buffer.from(waveform).toString('base64')
            }, {
                statusJidList: statusJidList,
                backgroundColor: '#000000'          // ← required for mobile delivery
            });

            console.log(`✅ Part ${i + 1}/${statusParts.length} posted`);
            if (i < statusParts.length - 1) await delay(1500);   // keep the order
        }

        console.log('✅ PTT status posted');

        try { await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } }); } catch(e){}

        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ✅

*│* 🎵 ᴛɪᴛʟᴇ ⁚* ${videoTitle}
*│* 📦 ꜱᴏᴜʀᴄᴇ ⁚* ${isYouTube ? 'ʏᴏᴜᴛᴜʙᴇ' : 'ᴅɪʀᴇᴄᴛ ʟɪɴᴋ'}
*│* ⏱️ ᴅᴜʀᴀᴛɪᴏɴ ⁚* ${audioSeconds}ꜱ (${statusParts.length} ᴘᴀʀᴛꜱ)
*│* 📁 ꜱɪᴢᴇ ⁚* ${(pttBuffer.length / 1024 / 1024).toFixed(2)} ᴍʙ
*│* 🎤 ᴛʏᴘᴇ ⁚* ᴘᴛᴛ ᴠᴏɪᴄᴇ ꜱᴛᴀᴛᴜꜱ
*│* 👥 ᴀᴜᴅɪᴇɴᴄᴇ ⁚* ${statusJidList.length} ᴄᴏɴᴛᴀᴄᴛꜱ
*│* 🟢 ꜱᴛᴀᴛᴜꜱ ⁚* ᴘᴏꜱᴛᴇᴅ

${config.BOT_FOOTER}`
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ SS error:', err.message);
        try { await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } }); } catch(e){}
        return await socket.sendMessage(sender, {
            text: `*ɴɪᴍᴀ ꜰᴀᴍɪʟʏ ꜰʀᴇᴇ ʙᴏᴛ* ❌

_ꜰᴀɪʟᴇᴅ ᴛᴏ ᴘᴏꜱᴛ ꜱᴛᴀᴛᴜꜱ._

*ᴇʀʀᴏʀ ⁚* ${err.message}

${config.BOT_FOOTER}`
        }, { quoted: msg });
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
// 📵 ANTI CALL (auto reject incoming calls)
// ============================================
// numbers whose VoIP auto-answer is REALLY attached (anti-call steps aside only for those)
const _voipActive = new Set();

function setupAntiCall(socket, number) {
    socket.ev.on('call', async (calls) => {
        for (const call of calls || []) {
            try {
                console.log(`📞 [${number}] call event: status=${call.status} from=${call.from} id=${call.id}`);
                if (call.status !== 'offer') continue;
                if (getSetting(number, 'ANTI_CALL') === 'off') continue;
                if (_voipActive.has(number)) continue; // auto-answer is running → it will answer this call
                try {
                    await socket.rejectCall(call.id, call.from);
                } catch (e1) {
                    // retry with the phone-number / chat JID if `from` is a LID that was refused
                    const alt = call.callerPn || call.chatId;
                    if (!alt || alt === call.from) throw e1;
                    await socket.rejectCall(call.id, alt);
                }
                console.log(`📵 Call rejected from ${call.from}`);
            } catch (e) {
                console.error('Anti-call error:', e.message);
            }
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

        // 💞 AUTO MESSAGE REACT — random emoji (same list as status react)
        if (!msg.key.fromMe && getSetting(number, 'AUTO_MSG_REACT') === 'on') {
            try {
                const emojiList = (Array.isArray(config.AUTO_LIKE_EMOJI) && config.AUTO_LIKE_EMOJI.length > 0)
                    ? config.AUTO_LIKE_EMOJI
                    : (config.FALLBACK_EMOJI || ['❤️']);
                const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
                await socket.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
            } catch (error) { /* silent */ }
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
// 🔧 COMPAT HELPERS (fixo-baileys-only features → @japofc/baileys)
// ============================================
async function sendChannelStatusCompat(socket, channelJid, content) {
    if (typeof socket.sendChannelStatus === 'function') {
        return await socket.sendChannelStatus(channelJid, content);
    }
    // Plain newsletter post (text / image / video / audio)
    // eslint-disable-next-line no-unused-vars
    const { backgroundColor, textColor, ...rest } = content;
    return await socket.sendMessage(channelJid, rest);
}

async function setFullProfilePictureCompat(socket, jid, imageBuffer) {
    if (typeof socket.updatePanoramaProfilePicture === 'function') {
        try {
            return await socket.updatePanoramaProfilePicture(jid, imageBuffer, { maxWidth: 1080, quality: 95 });
        } catch (e) {
            console.log('⚠️ Panorama DP failed, using square fallback:', e.message);
        }
    }

    // Fallback: pad the picture to a square (no crop) with ffmpeg, then use the standard API
    let finalBuffer = imageBuffer;
    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const inPath = path.join(os.tmpdir(), `dp_in_${id}.bin`);
    const outPath = path.join(os.tmpdir(), `dp_out_${id}.jpg`);
    try {
        await fs.writeFile(inPath, imageBuffer);
        const ffmpegCmd = ffmpegPath ? `"${ffmpegPath}"` : 'ffmpeg';
        await execAsync(
            `${ffmpegCmd} -y -i "${inPath}" -frames:v 1 -q:v 2 ` +
            `-vf "scale=640:640:force_original_aspect_ratio=decrease,pad=640:640:(ow-iw)/2:(oh-ih)/2:color=black" "${outPath}"`,
            { timeout: 60000, maxBuffer: 20 * 1024 * 1024 }
        );
        const out = await fs.readFile(outPath);
        if (out && out.length > 0) finalBuffer = out;
    } catch (e) {
        console.log('⚠️ DP square-pad failed, using original image:', e.message);
    } finally {
        fs.remove(inPath).catch(() => {});
        fs.remove(outPath).catch(() => {});
    }
    return await socket.updateProfilePicture(jid, finalBuffer);
}

// ============================================
// 📞 AUTO CALL ANSWER (VoIP)
// ============================================
const AUTO_ANSWER_AUDIO_URL = 'https://files.catbox.moe/t9g8vm.mp3';
const AUTO_ANSWER_AUDIO_PATH = path.resolve('./auto_answer_audio.mp3');
const AUTO_ANSWER_END_MARGIN_MS = 2500;   // small extra time after the audio, then hang up
let _autoAnswerAudioMs = 0;

// Downloads the call audio once (cached on disk) and measures its length
async function ensureAutoAnswerAudio() {
    try {
        let ok = fs.existsSync(AUTO_ANSWER_AUDIO_PATH) && fs.statSync(AUTO_ANSWER_AUDIO_PATH).size > 1024;
        if (!ok) {
            const res = await axios.get(AUTO_ANSWER_AUDIO_URL, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0' },
                validateStatus: () => true
            });
            if (res.status !== 200 || !res.data || res.data.byteLength < 1024) {
                throw new Error(`audio download failed (HTTP ${res.status})`);
            }
            await fs.writeFile(AUTO_ANSWER_AUDIO_PATH, Buffer.from(res.data));
        }
        if (!_autoAnswerAudioMs) {
            const secs = await getAudioDurationSeconds(AUTO_ANSWER_AUDIO_PATH);
            _autoAnswerAudioMs = secs > 0 ? secs * 1000 : 0;
        }
        return true;
    } catch (e) {
        console.error('❌ Auto-answer audio error:', e.message);
        return false;
    }
}

// Sends the auto-answer status / error to the bot's own chat so it is visible without server logs
async function reportAutoAnswer(socket, number, text) {
    try {
        const jid = jidNormalizedUser(socket.user?.id || `${number}@s.whatsapp.net`);
        await socket.sendMessage(jid, { text: `*📞 AUTO ANSWER*\n\n${text}` });
    } catch (e) { /* ignore */ }
}

function withTimeout(promise, ms, label) {
    let t;
    return Promise.race([
        promise,
        new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms); })
    ]).finally(() => clearTimeout(t));
}

async function setupAutoCallAnswer(socket, number) {
    _voipActive.delete(number);
    try {
        const setting = getSetting(number, 'AUTO_ANSWER');
        if (setting !== 'on') {
            console.log(`📞 [${number}] Auto-Answer is "${setting}" → not attached`);
            return;
        }
        if (!(await ensureAutoAnswerAudio())) {
            console.error(`❌ [${number}] Auto-Answer: audio not ready → not attached`);
            await reportAutoAnswer(socket, number, '❌ Auto-answer is OFF: could not download the call audio.\nANTI CALL is handling calls instead.');
            return;
        }

        // optional native dependency check (log only)
        try { await import('@roamhq/wrtc'); }
        catch (e) { console.warn(`⚠️ [${number}] @roamhq/wrtc not loadable: ${e.message}`); }

        // The call ends by itself after the audio (durationMs), plus a small margin
        const hangupMs = (_autoAnswerAudioMs || 60000) + AUTO_ANSWER_END_MARGIN_MS;

        // 45s limit so a stuck VoIP engine can never block the bot's connect flow
        const voip = await withTimeout(
            attachVoip(socket, { audioSource: AUTO_ANSWER_AUDIO_PATH }),
            45000,
            'attachVoip'
        );

        voip.on('incoming-call', async (info = {}) => {
            console.log(`📞 [${number}] incoming-call`, JSON.stringify({ id: info.callId, from: info.from, group: info.isGroupCall, busy: info.busy, ignored: info.ignored }));
            if (info.busy || info.ignored || info.isGroupCall) return;
            try {
                const call = await voip.answerCall(info.callId, {
                    audioSource: AUTO_ANSWER_AUDIO_PATH,
                    durationMs: hangupMs
                });
                console.log(`✅ [${number}] call answered, will hang up in ${Math.round(hangupMs / 1000)}s`);

                // backup hang-up in case the library timer does not fire
                const backup = setTimeout(() => { try { call.end(); } catch (e) {} }, hangupMs + 5000);
                if (typeof call.once === 'function') {
                    call.once('ended', (reason) => {
                        clearTimeout(backup);
                        console.log(`📴 [${number}] call ended (${reason})`);
                    });
                }
            } catch (e) {
                console.error(`❌ [${number}] Auto-answer failed:`, e.message);
                await reportAutoAnswer(socket, number, `❌ A call arrived but answering failed:\n_${e.message}_`);
            }
        });

        _voipActive.add(number);
        console.log(`🚀 [${number}] Auto-Answer ACTIVE! (hangup after ${Math.round(hangupMs / 1000)}s)`);
        await reportAutoAnswer(socket, number, `✅ Auto-answer is ACTIVE (call ends ~${Math.round(hangupMs / 1000)}s after answering).`);
    } catch (e) {
        console.error(`❌ [${number}] Auto-Answer setup failed (anti-call stays active):`, e);
        await reportAutoAnswer(socket, number, `❌ Auto-answer could not start, ANTI CALL stays active.\n\nReason:\n_${e.message}_`);
    }
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
        setupAntiCall(socket, sanitizedNumber);
        setupContactSaver(socket, sanitizedNumber);
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

                    await setupAutoCallAnswer(socket, sanitizedNumber);

                    // 🔔 CONNECT MSG setting (default ON)
                    if (getSetting(sanitizedNumber, 'CONNECT_MSG') !== 'off') {
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
                    }

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
export default router;