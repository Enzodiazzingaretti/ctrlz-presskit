const { isConfigured, checkPassword, sign, sessionCookie, SESSION_MS } = require('./_lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!isConfigured()) return res.status(501).json({ error: 'not_configured' });

  const password = req.body && req.body.password;

  if (!checkPassword(password)) {
    // Frena un poco los intentos fallidos; scrypt ya hace caro adivinar.
    await sleep(400);
    return res.status(401).json({ error: 'bad_password' });
  }

  const token = sign({ exp: Date.now() + SESSION_MS });
  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
  res.status(200).json({ ok: true });
};
