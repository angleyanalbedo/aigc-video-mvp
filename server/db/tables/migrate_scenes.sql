-- =====================================================
-- scenes 数据迁移脚本
-- 从 projects.script JSON 迁移到 scenes 表
-- 执行时间：2026-05-24
-- =====================================================

-- 1. 创建临时表存储迁移数据
CREATE TEMP TABLE scenes_migration AS
WITH parsed_scenes AS (
  SELECT
    p.id as project_id,
    json_each.value as scene_data,
    json_each.value->>'$.id' as scene_id,
    CAST(json_each.value->>'$.sceneId' AS INTEGER) as scene_order
  FROM projects p,
       json_each(p.script)
  WHERE p.script IS NOT NULL
)
SELECT
  project_id,
  scene_order,
  scene_data->>'$.description' as description,
  scene_data->>'$.voiceover' as voiceover,
  scene_data->>'$.narration' as narration,
  scene_data->>'$.subtitle' as subtitle,
  scene_data->>'$.shot_type' as shot_type,
  scene_data->>'$.emotion' as emotion,
  scene_data->>'$.transition' as transition,
  scene_data->>'$.music_mood' as music_mood,
  scene_data->>'$.ai_prompt' as ai_prompt,
  scene_data->>'$.first_frame_url' as first_frame_url,
  scene_data->>'$.last_frame_url' as last_frame_url,
  scene_data->>'$.source_video_url' as source_video_url,
  scene_data->>'$.reference_image_id' as reference_image_id,
  scene_data->>'$.reference_image_url' as reference_image_url,
  scene_data->>'$.image_url' as image_url,
  CAST(scene_data->>'$.duration' AS INTEGER) as duration,
  COALESCE(scene_data->>'$.status', 'idle') as status,
  CAST(scene_data->>'$.rendering' AS INTEGER) as rendering,
  CAST(scene_data->>'$.progress' AS INTEGER) as progress,
  scene_data->>'$.error_message' as error_message,
  scene_data->>'$.video_url' as video_url,
  scene_data->>'$.audio_url' as audio_url,
  CAST(scene_data->>'$.tts_est_duration' AS INTEGER) as tts_est_duration,
  scene_data->>'$.generated_at' as generated_at
FROM parsed_scenes
WHERE scene_order IS NOT NULL;

-- 2. 插入数据到 scenes 表
INSERT INTO scenes (
  id,
  project_id,
  scene_order,
  description,
  voiceover,
  narration,
  subtitle,
  shot_type,
  emotion,
  transition,
  music_mood,
  ai_prompt,
  first_frame_url,
  last_frame_url,
  source_video_url,
  reference_image_id,
  reference_image_url,
  image_url,
  duration,
  status,
  rendering,
  progress,
  error_message,
  video_url,
  audio_url,
  tts_est_duration,
  generated_at,
  created_at,
  updated_at
)
SELECT
  'scene_' || project_id || '_' || scene_order || '_' || ABS(RANDOM() % 10000) as id,
  project_id,
  scene_order,
  description,
  voiceover,
  narration,
  subtitle,
  COALESCE(shot_type, '中景'),
  COALESCE(emotion, '积极'),
  COALESCE(transition, 'fade'),
  COALESCE(music_mood, '无'),
  ai_prompt,
  first_frame_url,
  last_frame_url,
  source_video_url,
  reference_image_id,
  reference_image_url,
  image_url,
  COALESCE(duration, 5),
  COALESCE(status, 'idle'),
  COALESCE(rendering, 0),
  COALESCE(progress, 0),
  error_message,
  video_url,
  audio_url,
  tts_est_duration,
  generated_at,
  datetime('now'),
  datetime('now')
FROM scenes_migration;

-- 3. 输出迁移结果
SELECT
  '迁移完成' as status,
  COUNT(*) as total_scenes,
  COUNT(DISTINCT project_id) as total_projects
FROM scenes;
