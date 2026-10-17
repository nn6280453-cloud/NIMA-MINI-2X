import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import bodyParser from 'body-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// ============================================
// Global settings
// ============================================
EventEmitter.defaultMaxListeners = 500;

// ============================================
// Body Parser (routes වලට උඩින් තියෙන්න ඕන!)
// ============================================
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// Load pair.js router
// (dynamic import so it loads AFTER the settings above, same as before)
// ============================================
const { default: code } = await import('./pair.js');

// ============================================
// Mount pair router at /code
// ============================================
app.use('/code', code);

// ============================================
// FIX: Root URL එකෙන් ?number= සමඟ එන request
// pair.js router එකට forward කරනවා
// ============================================
app.use('/', (req, res, next) => {
    // Root path + number query param තියෙනවා නම් router එකට යවන්න
    if ((req.path === '/' || req.path === '') && req.query.number) {
        return code(req, res, next);
    }
    next();
});

// ============================================
// HTML Pages
// ============================================
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// ============================================
// Health check
// ============================================
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ============================================
// 404 Handler (අන්තිමට තියෙන්න ඕන)
// ============================================
app.use((req, res) => {
    res.status(404).send('Not Found');
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log(`
Don't Forget To Give Star 📡⌛⏳✅

Server running on http://localhost:${PORT}`);
});

export default app;
