// ============================================
// ɴɪᴍᴀ ᴍɪɴɪ — AUTO REPLY / AUTO VOICE REPLY RULES
// ============================================
// Keyword matching: incoming plain text (no . command prefix) is trimmed
// and lower-cased, then matched exactly against the keys below.
// Add more keyword -> reply pairs here as needed.

module.exports = {
    // TEXT auto-reply keywords (used when the "AUTO_REPLY" setting is on)
    AUTO_REPLY_RULES: {
        'hi': 'hi kohomada'
    },

    // VOICE auto-reply keywords (used when the "AUTO_VOICE_REPLY" setting is on)
    // value = a direct URL to the audio file to send as a voice note
    AUTO_VOICE_REPLY_RULES: {
        'hi': 'https://files.catbox.moe/pyj2hx.mp3'
    }
};
