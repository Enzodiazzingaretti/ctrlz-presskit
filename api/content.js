const { requireAuth, ghRead, ghWrite, isAllowedFile } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const file = req.query && req.query.file;
      if (!isAllowedFile(file)) return res.status(400).json({ error: 'bad_file' });

      const found = await ghRead(file);
      if (!found) return res.status(404).json({ error: 'not_found' });

      const text = Buffer.from(found.content, 'base64').toString('utf8');
      return res.status(200).json({ data: JSON.parse(text) });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!isAllowedFile(body.file)) return res.status(400).json({ error: 'bad_file' });
      if (body.data == null || typeof body.data !== 'object') {
        return res.status(400).json({ error: 'bad_payload' });
      }

      const json = JSON.stringify(body.data, null, 2) + '\n';
      const message = typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 120)
        : 'update: ' + body.file + ' desde la consola';

      await ghWrite(body.file, Buffer.from(json, 'utf8').toString('base64'), message);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
