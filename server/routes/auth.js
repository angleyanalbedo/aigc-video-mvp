const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// 常量时间字符串比较，防止时序攻击
function safeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // 长度不同时也要执行一次比较，保持恒定时间
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: '请输入用户名和密码' });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error('⚠️ ADMIN_USERNAME 或 ADMIN_PASSWORD 未在 .env 中配置');
    return res.status(500).json({ success: false, error: '服务端认证未配置' });
  }

  const usernameMatch = safeCompare(username, adminUsername);
  const passwordMatch = safeCompare(password, adminPassword);

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({ success: false, error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ success: true, token });
});

// GET /api/auth/verify
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未提供认证令牌' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, valid: true, username: decoded.username });
  } catch (err) {
    res.status(401).json({ success: false, error: '令牌无效或已过期' });
  }
});

module.exports = router;
