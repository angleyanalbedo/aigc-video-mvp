const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // 登录接口和健康检查不需要认证
  if (req.path === '/api/auth/login' || req.path === '/api/auth/verify' || req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录，请先登录' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

module.exports = requireAuth;
