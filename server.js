const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const { createClient } = require('redis');

require('dotenv').config();
const app = express();
app.use(cors());

app.use(express.json());
app.use(express.static('public'));
const redis = createClient({
    url: process.env.REDIS_URL,
    socket: {
        tls: true,
        rejectUnauthorized: false,
        keepAlive: 10000
    }
});


redis.on('error', (err) => {
    console.error('Redis error:', err.message);

});
redis.connect()
    .then(() => console.log('Redis connected'))
    .catch(console.error);

function nowMs(req) {
    if (process.env.TEST_MODE === '1') {
        const h = req.headers['x-test-now-ms'];
        if (h) return parseInt(h, 10);
    } return Date.now();
}

app.get('/api/healthz', async (req, res) => {

    try {
        await redis.ping();
        res.json({ ok: true });
    } catch {
        res.status(500).json({ ok: false });
    }
});

app.post('/api/pastes', async (req, res) => {
    const { content, ttl_seconds, max_views } = req.body || {};
    if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ error: 'Invalid content' });

    } if (ttl_seconds !== undefined && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
        return res.status(400).json({ error: 'Invalid ttl_seconds' });
    } if (max_views !== undefined && (!Number.isInteger(max_views) || max_views < 1)) {
        return res.status(400).json({ error: 'Invalid max_views' });
    }

    const id = nanoid(10);
    const createdAt = Date.now();
    const expiresAt = ttl_seconds ? createdAt + ttl_seconds * 1000 : null;
    const paste = { id, content, created_at: createdAt, expires_at: expiresAt, max_views: max_views ?? null, views: 0 };
    await redis.set(`paste:${id}`, JSON.stringify(paste));
    const baseUrl = req.protocol + '://' + req.get('host');
    res.json({ id, url:`${baseUrl}/p/${id}` });
});

async function getPaste(id) {
    const raw = await redis.get(`paste:${id}`);
    return raw ? JSON.parse(raw) : null;
} async function savePaste(paste) {
    await redis.set(`paste:${paste.id}`, JSON.stringify(paste));

}

app.get('/api/pastes/:id', async (req, res) => {

    const paste = await getPaste(req.params.id);
    if (!paste) return res.status(404).json({ error: 'Not found' });
    const now = nowMs(req);

    if (paste.expires_at && now >= paste.expires_at)
        return res.status(404).json({ error: 'Not found' });

    if (paste.max_views !== null && paste.views >= paste.max_views)

        return res.status(404).json({ error: 'Not found' }); paste.views += 1;

    await savePaste(paste);

    res.json({ content: paste.content, remaining_views: paste.max_views === null ? null : Math.max(paste.max_views - paste.views, 0), expires_at: paste.expires_at ? new Date(paste.expires_at).toISOString() : null });
});

app.get('/p/:id', async (req, res) => {

    const paste = await getPaste(req.params.id);
    if (!paste) return res.status(404).send('Not Found');

    const now = nowMs(req);
    if (paste.expires_at && now >= paste.expires_at) return res.status(404).send('Not Found');

    if (paste.max_views !== null && paste.views >= paste.max_views) return res.status(404).send('Not Found');
    paste.views += 1;
    await savePaste(paste);

    const safeContent = paste.content.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<pre>${safeContent}</pre>`);
});


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));

