const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // OPTIONS 预检请求直接放行
  if (req.method === 'OPTIONS') {
    return next();
  }

  // 登录接口和健康检查不需要认证（注意：挂载在 /api 下，req.path 已剥离前缀）
  if (req.path === '/auth/login' || req.path === '/auth/verify' || req.path === '/health') {
    return next();
  }

  // 支持从 Authorization header 或 query parameter 获取 token（EventSource 不支持自定义 header）
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.substring(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, error: '未登录，请先登录' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

module.exports = requireAuth;
