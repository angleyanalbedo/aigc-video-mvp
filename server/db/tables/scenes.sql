-- =====================================================
-- scenes 表创建脚本
-- 用途：存储项目的分镜信息
-- 创建时间：2026-05-24
-- =====================================================

-- 如果表已存在，先删除（用于重新创建）
-- DROP TABLE IF EXISTS scenes;

CREATE TABLE IF NOT EXISTS scenes (
  -- 核心标识
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_order INTEGER NOT NULL DEFAULT 0,

  -- 基础内容
  description TEXT,                    -- 画面描述（AI视频生成提示词）
  voiceover TEXT,                       -- 旁白文案（TTS配音内容）
  narration TEXT,                       -- 备用旁白
  subtitle TEXT,                        -- 字幕文案

  -- 视觉参数
  shot_type TEXT DEFAULT '中景',       -- 镜头类型（特写/近景/中景/全景/远景/俯拍/仰拍/航拍/移动镜头）
  emotion TEXT DEFAULT '积极',          -- 情感基调（积极/专业/热情/平静/紧张/轻松/浪漫/神秘）
  transition TEXT DEFAULT 'fade',       -- 转场效果（none/fade/wipe/dissolve/zoom）
  music_mood TEXT DEFAULT '无',         -- 配乐氛围（无/轻快/舒缓/动感/紧张/浪漫/史诗）

  -- AI生成控制
  ai_prompt TEXT,                      -- AI生图提示词（英文，用于AI生成图片）
  first_frame_url TEXT,                 -- 首帧图片URL（AI视频生成控制）
  last_frame_url TEXT,                  -- 尾帧图片URL（AI视频生成控制）
  source_video_url TEXT,                -- 源视频素材URL（如果有现成素材）

  -- 素材引用
  reference_image_id TEXT,              -- 参考图片ID（素材库中的ID）
  reference_image_url TEXT,            -- 参考图片URL
  image_url TEXT,                      -- AI生成的图片URL

  -- 渲染状态
  duration INTEGER DEFAULT 5,           -- 预计时长（秒）
  status TEXT DEFAULT 'idle',          -- 状态（idle/pending/generating/completed/failed）
  rendering INTEGER DEFAULT 0,          -- 是否渲染中（0/1）
  progress INTEGER DEFAULT 0,           -- 渲染进度（0-100）
  error_message TEXT,                  -- 错误信息

  -- 生成结果
  video_url TEXT,                      -- AI生成的视频URL
  audio_url TEXT,                       -- 音频URL（TTS配音）
  tts_est_duration INTEGER,            -- TTS预计时长

  -- 元数据
  generated_at DATETIME,               -- 生成时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 外键约束
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =====================================================
-- 索引
-- =====================================================

-- 项目内分镜查询索引
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);

-- 按顺序查询分镜
CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(project_id, scene_order);

-- 状态查询索引
CREATE INDEX IF NOT EXISTS idx_scenes_status ON scenes(status);

-- 按项目+状态联合索引
CREATE INDEX IF NOT EXISTS idx_scenes_project_status ON scenes(project_id, status);

COMMENT ON TABLE scenes IS '项目分镜表 - 存储每个项目的所有分镜信息，包括AI视频生成参数和渲染状态';
COMMENT ON COLUMN scenes.first_frame_url IS '首帧图片URL - 用于AI视频生成的首帧控制';
COMMENT ON COLUMN scenes.last_frame_url IS '尾帧图片URL - 用于AI视频生成的尾帧控制';
COMMENT ON COLUMN scenes.ai_prompt IS 'AI生图提示词 - 英文描述，用于AI生成图片或视频';
