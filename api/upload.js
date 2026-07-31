const { requireAuth, ghWrite, isAllowedImagePath } = require('./_lib');

const SLOTS = ['cover', 'bio', 'shared', 'stages', 'hosp', 'riderdiagram', 'booking', 'gallery'];
const MAX_BYTES = 2 * 1024 * 1024;

// RIFF....WEBP
function isWebp(buf) {
  return buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const slot = String(body.slot || '').toLowerCase();
    if (SLOTS.indexOf(slot) === -1) return res.status(400).json({ error: 'bad_slot' });

    const b64 = String(body.data || '').replace(/^data:image\/webp;base64,/, '');
    if (!b64) return res.status(400).json({ error: 'no_data' });

    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'no_data' });
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'too_large' });
    if (!isWebp(buf)) return res.status(400).json({ error: 'not_webp' });

    // Nombre nuevo en cada subida para que el navegador y el CDN lo tomen ya.
    const path = 'img/' + slot + '-' + Date.now() + '.webp';
    if (!isAllowedImagePath(path)) return res.status(400).json({ error: 'bad_path' });

    await ghWrite(path, buf.toString('base64'), 'update: imagen ' + slot + ' desde la consola');
    return res.status(200).json({ ok: true, path: path });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
