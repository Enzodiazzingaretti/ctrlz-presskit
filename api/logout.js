const { sessionCookie } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.status(200).json({ ok: true });
};
