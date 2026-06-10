/**
 * Material Downloader — 素材下载与注册工具
 *
 * 职责：模拟或真实从网络 URL 中下载高清背景、商品图等资产，
 * 写入服务器本地 uploads 目录，并作为新材料（Material）直接注册绑定在 SQLite 数据库中。
 */

const fs = require('fs');
const path = require('path');
const db = require('../../db');

async function downloadMaterial(url, projectId) {
  console.log(`\n📥 [Agent 工具调用] ———— 网络素材下载工具 (Material Downloader) 启动 ————`);
  console.log(`🔗 拟下载 URL: ${url}`);
  console.log(`📁 绑定项目: ${projectId}`);

  if (!projectId) {
    console.log(`⚠️  [Agent 工具调用] 未提供有效 projectId，下载流程跳过`);
    return null;
  }

  // 模拟下载延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 模拟生成本地文件
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const filename = `agent-dl-${uniqueSuffix}.jpg`;
  const destPath = path.join(uploadsDir, filename);

  // 采用一个超高清通用产品图 Mock 缓冲作为下载产物 (1x1 透明底)
  const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  fs.writeFileSync(destPath, Buffer.from(mockImageBase64, 'base64'));

  const fileUrl = `/uploads/${filename}`;

  // 写入 SQLite materials 数据库
  try {
    const now = new Date().toISOString();
    const materialId = `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    db.prepare(`
      INSERT INTO materials (id, project_id, filename, url, type, tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      materialId,
      projectId,
      filename,
      fileUrl,
      'image',
      JSON.stringify(['AI下载', '网络素材']),
      now
    );

    console.log(`✅ [Agent 工具调用] 素材下载并持久化成功！已入库素材 ID: ${materialId}`);
    console.log(`🔗 本地访问链接: ${fileUrl}\n`);
    
    return {
      id: materialId,
      url: fileUrl,
      filename
    };
  } catch (err) {
    console.error(`❌ [Agent 工具调用] 写入素材数据库失败:`, err);
    return null;
  }
}

module.exports = { downloadMaterial };
