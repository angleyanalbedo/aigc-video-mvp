-- server/db/schema.sql
-- 数据库初始化脚本 - 包含所有表结构

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  product_info TEXT,
  script TEXT,
  settings TEXT,
  video_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分镜表（支持AI视频生成首尾帧控制）
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_order INTEGER NOT NULL DEFAULT 0,
  
  -- 基础内容
  description TEXT,
  voiceover TEXT,
  narration TEXT,
  subtitle TEXT,
  
  -- 视觉参数
  shot_type TEXT DEFAULT '中景',
  emotion TEXT DEFAULT '积极',
  transition TEXT DEFAULT 'fade',
  music_mood TEXT DEFAULT '无',
  
  -- AI生成控制（首尾帧）
  ai_prompt TEXT,
  first_frame_url TEXT,
  last_frame_url TEXT,
  source_video_url TEXT,
  
  -- 素材引用
  reference_image_id TEXT,
  reference_image_url TEXT,
  image_url TEXT,
  
  -- 渲染状态
  duration INTEGER DEFAULT 5,
  status TEXT DEFAULT 'idle',
  rendering INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- 生成结果
  video_url TEXT,
  audio_url TEXT,
  tts_est_duration INTEGER,
  
  -- 元数据
  generated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(project_id, scene_order);
CREATE INDEX IF NOT EXISTS idx_scenes_status ON scenes(status);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT,
  tags TEXT,
  embedding TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  type TEXT,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  result TEXT,
  error TEXT,
  trace TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT,
  description TEXT,
  type TEXT,
  status TEXT DEFAULT 'pending',
  check_results TEXT,
  history TEXT,
  creator TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ab_experiments (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  variants TEXT,
  results TEXT,
  sample_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  session_id TEXT,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  metadata TEXT,
  importance REAL DEFAULT 0.5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_session ON agent_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_importance ON agent_memory(importance);

CREATE TABLE IF NOT EXISTS agent_memory_summaries (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  session_id TEXT,
  summary TEXT NOT NULL,
  key_facts TEXT,
  embedding BLOB,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_summaries_agent ON agent_memory_summaries(agent_name);
CREATE INDEX IF NOT EXISTS idx_summaries_session ON agent_memory_summaries(session_id);

-- 无限画布工作台新增表

CREATE TABLE IF NOT EXISTS canvas_nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_data TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  width REAL DEFAULT 200,
  height REAL DEFAULT 150,
  style TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canvas_nodes_project ON canvas_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_type ON canvas_nodes(node_type);

CREATE TABLE IF NOT EXISTS canvas_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  label TEXT,
  style TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES canvas_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_connections_project ON canvas_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_connections_source ON canvas_connections(source_node_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON canvas_connections(target_node_id);

CREATE TABLE IF NOT EXISTS operation_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  session_id TEXT,
  agent_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  target_node_id TEXT,
  source_intent_id TEXT,
  operation_details TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  user_confirmation BOOLEAN DEFAULT FALSE,
  result TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  executed_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operations_project ON operation_history(project_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operation_history(status);
CREATE INDEX IF NOT EXISTS idx_operations_session ON operation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_operations_agent ON operation_history(agent_name);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  content TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);

-- 视频因子记录表 - 记录每个视频生成时使用的创作因子
CREATE TABLE IF NOT EXISTS video_factors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  video_id TEXT,
  
  -- 创作因子
  opening_style TEXT,
  bgm_style TEXT,
  bgm_volume REAL,
  voiceover_style TEXT,
  voiceover_gender TEXT,
  color_tone TEXT,
  saturation TEXT,
  subtitle_style TEXT,
  subtitle_position TEXT,
  
  -- 技术参数
  aspect_ratio TEXT,
  duration INTEGER,
  scene_count INTEGER,
  resolution TEXT,
  
  -- 产品信息
  product_name TEXT,
  product_category TEXT,
  
  -- 元数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_factors_project ON video_factors(project_id);
CREATE INDEX IF NOT EXISTS idx_video_factors_opening ON video_factors(opening_style);
CREATE INDEX IF NOT EXISTS idx_video_factors_bgm ON video_factors(bgm_style);
CREATE INDEX IF NOT EXISTS idx_video_factors_voiceover ON video_factors(voiceover_style);
CREATE INDEX IF NOT EXISTS idx_video_factors_color ON video_factors(color_tone);
CREATE INDEX IF NOT EXISTS idx_video_factors_aspect ON video_factors(aspect_ratio);
CREATE INDEX IF NOT EXISTS idx_video_factors_created ON video_factors(created_at);

-- 视频发布记录表 - 记录视频发布和模拟效果数据
CREATE TABLE IF NOT EXISTS video_publishing_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  video_factor_id TEXT,
  
  -- 发布信息
  platform TEXT,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'published',
  
  -- 模拟效果数据 (基于因子智能生成)
  mock_views INTEGER DEFAULT 0,
  mock_completion_rate REAL DEFAULT 0,
  mock_click_rate REAL DEFAULT 0,
  mock_conversion_rate REAL DEFAULT 0,
  mock_likes INTEGER DEFAULT 0,
  mock_comments INTEGER DEFAULT 0,
  mock_shares INTEGER DEFAULT 0,
  
  -- 关联的A/B实验
  experiment_id TEXT,
  variant_id TEXT,
  
  -- 元数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (video_factor_id) REFERENCES video_factors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_publishing_project ON video_publishing_records(project_id);
CREATE INDEX IF NOT EXISTS idx_publishing_experiment ON video_publishing_records(experiment_id);
CREATE INDEX IF NOT EXISTS idx_publishing_platform ON video_publishing_records(platform);
CREATE INDEX IF NOT EXISTS idx_publishing_created ON video_publishing_records(created_at);

-- ============================================================
-- 赛题核心模块：素材 / 剧本 / 创作 三大模块表结构
-- ============================================================

-- 素材切片表 - 多颗粒度结构化资产（商品/视频/slice 三层标签）
CREATE TABLE IF NOT EXISTS material_slices (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  slice_type TEXT NOT NULL DEFAULT 'frame',
  slice_index INTEGER NOT NULL DEFAULT 0,
  start_time REAL,
  end_time REAL,
  thumbnail_url TEXT,
  slice_url TEXT,

  product_tags TEXT,
  video_tags TEXT,
  slice_tags TEXT,

  description TEXT,
  embedding TEXT,
  metadata TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slices_material ON material_slices(material_id);
CREATE INDEX IF NOT EXISTS idx_slices_type ON material_slices(slice_type);

-- 优质视频库 - 爆款视频结构化拆解
CREATE TABLE IF NOT EXISTS video_library (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT,
  platform TEXT DEFAULT 'unknown',
  category TEXT,
  tags TEXT,
  thumbnail_url TEXT,
  video_url TEXT,

  hook_technique TEXT,
  selling_points TEXT,
  shot_analysis TEXT,
  style_analysis TEXT,
  structure_analysis TEXT,
  full_analysis TEXT,

  duration REAL,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  source_declaration TEXT,

  status TEXT DEFAULT 'analyzed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videolib_category ON video_library(category);
CREATE INDEX IF NOT EXISTS idx_videolib_platform ON video_library(platform);
CREATE INDEX IF NOT EXISTS idx_videolib_status ON video_library(status);
CREATE INDEX IF NOT EXISTS idx_videolib_created ON video_library(created_at);

-- 灵感模板（方法论提炼）- 策略 + 因子
CREATE TABLE IF NOT EXISTS inspiration_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  tags TEXT,

  strategy TEXT NOT NULL,
  factors TEXT NOT NULL,
  constraint_rules TEXT,

  source_video_ids TEXT,
  usage_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,

  thumbnail_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON inspiration_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON inspiration_templates(usage_count);
CREATE INDEX IF NOT EXISTS idx_templates_rating ON inspiration_templates(rating);

-- 剧本表 - 持久化生成的剧本
CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  generation_mode TEXT DEFAULT 'auto',
  template_id TEXT,
  reference_video_id TEXT,
  factors_used TEXT,

  product_info TEXT,
  constraint_rules TEXT,

  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  parent_script_id TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES inspiration_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (reference_video_id) REFERENCES video_library(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scripts_project ON scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_mode ON scripts(generation_mode);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);
CREATE INDEX IF NOT EXISTS idx_scripts_template ON scripts(template_id);
