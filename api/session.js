const { isConfigured, currentSession } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    configured: isConfigured(),
    authenticated: isConfigured() ? Boolean(currentSession(req)) : false
  });
};
