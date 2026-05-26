const db = require('../db');

class SceneModel {
  // 从 scenes 表获取所有分镜
  static getByProjectId(projectId) {
    const scenes = db.prepare(`
      SELECT * FROM scenes 
      WHERE project_id = ? 
      ORDER BY scene_order ASC
    `).all(projectId);
    
    return scenes.map(scene => this.formatScene(scene));
  }
  
  // 根据ID获取单个分镜
  static getById(sceneId) {
    const scene = db.prepare('SELECT * FROM scenes WHERE id = ?').get(sceneId);
    return scene ? this.formatScene(scene) : null;
  }
  
  // 创建分镜
  static create(projectId, sceneData) {
    const id = `scene_${projectId}_${Date.now()}`;
    const sceneOrder = this.getNextOrder(projectId);
    
    db.prepare(`
      INSERT INTO scenes (
        id, project_id, scene_order, description, voiceover, narration,
        subtitle, shot_type, emotion, transition, music_mood,
        ai_prompt, first_frame_url, last_frame_url, source_video_url,
        reference_image_id, reference_image_url, image_url,
        duration, status, rendering, progress, error_message,
        video_url, audio_url, tts_est_duration, generated_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      sceneOrder,
      sceneData.description || null,
      sceneData.voiceover || null,
      sceneData.narration || null,
      sceneData.subtitle || null,
      sceneData.shot_type || '中景',
      sceneData.emotion || '积极',
      sceneData.transition || 'fade',
      sceneData.music_mood || '无',
      sceneData.ai_prompt || null,
      sceneData.first_frame_url || null,
      sceneData.last_frame_url || null,
      sceneData.source_video_url || null,
      sceneData.reference_image_id || null,
      sceneData.reference_image_url || null,
      sceneData.image_url || null,
      sceneData.duration || 5,
      sceneData.status || 'idle',
      sceneData.rendering ? 1 : 0,
      sceneData.progress || 0,
      sceneData.error_message || null,
      sceneData.video_url || null,
      sceneData.audio_url || null,
      sceneData.tts_est_duration || null,
      sceneData.generated_at || null,
      new Date().toISOString(),
      new Date().toISOString()
    );
    
    return this.getById(id);
  }
  
  // 更新分镜
  static update(sceneId, updates) {
    const fields = [];
    const values = [];
    
    const fieldMap = {
      description: 'description',
      voiceover: 'voiceover',
      narration: 'narration',
      subtitle: 'subtitle',
      shot_type: 'shot_type',
      emotion: 'emotion',
      transition: 'transition',
      music_mood: 'music_mood',
      ai_prompt: 'ai_prompt',
      first_frame_url: 'first_frame_url',
      last_frame_url: 'last_frame_url',
      source_video_url: 'source_video_url',
      reference_image_id: 'reference_image_id',
      reference_image_url: 'reference_image_url',
      image_url: 'image_url',
      duration: 'duration',
      status: 'status',
      rendering: 'rendering',
      progress: 'progress',
      error_message: 'error_message',
      video_url: 'video_url',
      audio_url: 'audio_url',
      tts_est_duration: 'tts_est_duration',
      generated_at: 'generated_at'
    };
    
    Object.entries(updates).forEach(([key, value]) => {
      if (fieldMap[key]) {
        fields.push(`${fieldMap[key]} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) return null;
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(sceneId);
    
    db.prepare(`
      UPDATE scenes 
      SET ${fields.join(', ')}
      WHERE id = ?
    `).run(...values);
    
    return this.getById(sceneId);
  }
  
  // 删除分镜
  static delete(sceneId) {
    const scene = this.getById(sceneId);
    if (!scene) return false;
    
    db.prepare('DELETE FROM scenes WHERE id = ?').run(sceneId);
    
    // 重新排序
    this.reorder(scene.project_id);
    
    return true;
  }
  
  // 删除项目下所有分镜
  static deleteByProjectId(projectId) {
    db.prepare('DELETE FROM scenes WHERE project_id = ?').run(projectId);
    return true;
  }
  
  // 批量创建分镜
  static createBatch(projectId, scenesData) {
    const createdScenes = [];
    
    scenesData.forEach((sceneData, index) => {
      const scene = this.create(projectId, {
        ...sceneData,
        scene_order: index + 1
      });
      createdScenes.push(scene);
    });
    
    return createdScenes;
  }
  
  // 获取下一个分镜序号
  static getNextOrder(projectId) {
    const result = db.prepare(`
      SELECT MAX(scene_order) as max_order 
      FROM scenes 
      WHERE project_id = ?
    `).get(projectId);
    
    return (result.max_order || 0) + 1;
  }
  
  // 重新排序
  static reorder(projectId) {
    const scenes = this.getByProjectId(projectId);
    
    scenes.forEach((scene, index) => {
      db.prepare(`
        UPDATE scenes 
        SET scene_order = ?, updated_at = ?
        WHERE id = ?
      `).run(index + 1, new Date().toISOString(), scene.id);
    });
  }
  
  // 更新渲染状态
  static updateRenderStatus(sceneId, status, progress = 0, error = null) {
    const updates = {
      status,
      progress,
      rendering: status === 'generating' ? 1 : 0
    };
    
    if (error) {
      updates.error_message = error;
    }
    
    if (status === 'completed') {
      updates.rendering = 0;
      updates.progress = 100;
    }
    
    return this.update(sceneId, updates);
  }
  
  // 格式化分镜数据（统一字段命名）
  static formatScene(scene) {
    return {
      id: scene.id,
      project_id: scene.project_id,
      scene_order: scene.scene_order,
      
      // 内容
      description: scene.description,
      voiceover: scene.voiceover,
      narration: scene.narration,
      subtitle: scene.subtitle,
      
      // 视觉
      shot_type: scene.shot_type,
      emotion: scene.emotion,
      transition: scene.transition,
      music_mood: scene.music_mood,
      
      // AI生成
      ai_prompt: scene.ai_prompt,
      first_frame_url: scene.first_frame_url,
      last_frame_url: scene.last_frame_url,
      source_video_url: scene.source_video_url,
      
      // 素材
      reference_image_id: scene.reference_image_id,
      reference_image_url: scene.reference_image_url,
      image_url: scene.image_url,
      
      // 状态
      duration: scene.duration,
      status: scene.status,
      rendering: scene.rendering === 1,
      progress: scene.progress,
      error_message: scene.error_message,
      
      // 结果
      video_url: scene.video_url,
      audio_url: scene.audio_url,
      tts_est_duration: scene.tts_est_duration,
      
      // 元数据
      generated_at: scene.generated_at,
      created_at: scene.created_at,
      updated_at: scene.updated_at
    };
  }
}

module.exports = SceneModel;
