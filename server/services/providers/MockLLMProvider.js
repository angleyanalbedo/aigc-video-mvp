const BaseLLMProvider = require('./BaseLLMProvider');
const { mockChatCompletion } = require('../mockArkService');

class MockLLMProvider extends BaseLLMProvider {
  async generateText({ system, prompt, temperature = 0.7, maxTokens = 2000 }) {
    const messages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt }
    ];
    const res = await mockChatCompletion(messages, { temperature, maxTokens });
    return res.choices[0].message.content;
  }

  async generateStructuredText({ system, prompt, schema, maxTokens = 2000 }) {
    const response = await this.generateText({
      system,
      prompt,
      maxTokens
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch {
      console.warn('JSON 解析失败，尝试解析 XML 格式...');
      return this._parseXmlToJson(response);
    }
  }

  _parseXmlToJson(xmlString) {
    try {
      const titleMatch = xmlString.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1] : '未命名剧本';
      
      const sceneMatches = xmlString.match(/<scene[^>]*>[\s\S]*?<\/scene>/g);
      const scenes = sceneMatches ? sceneMatches.map((sceneXml, index) => {
        const idMatch = sceneXml.match(/id=["']([^"']+)["']/);
        const descMatch = sceneXml.match(/<description>([^<]+)<\/description>/);
        const durationMatch = sceneXml.match(/<duration>([^<]+)<\/duration>/);
        const voiceoverMatch = sceneXml.match(/<voiceover>([^<]+)<\/voiceover>/);
        const shotMatch = sceneXml.match(/<shot>([^<]+)<\/shot>/);
        const emotionMatch = sceneXml.match(/<emotion>([^<]+)<\/emotion>/);
        const transitionMatch = sceneXml.match(/<transition>([^<]+)<\/transition>/);
        
        return {
          id: idMatch ? parseInt(idMatch[1]) : index + 1,
          description: descMatch ? descMatch[1] : '',
          duration: durationMatch ? parseInt(durationMatch[1]) : 3,
          voiceover: voiceoverMatch ? voiceoverMatch[1] : '',
          shot: shotMatch ? shotMatch[1] : '中景',
          emotion: emotionMatch ? emotionMatch[1] : '积极',
          transition: transitionMatch ? transitionMatch[1] : 'cut'
        };
      }) : [];
      
      return { title, scenes };
    } catch (error) {
      console.error('XML 解析失败:', error.message);
      throw new Error('LLM 返回格式错误');
    }
  }

  async generateImage({ prompt, width = 1024, height = 1024 }) {
    console.log(`💡 MockLLMProvider: 正在为提示词 "${prompt.slice(0, 30)}..." 模拟生图...`);
    const mockImages = [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80', // 精致腕表
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80', // 爆款跑鞋
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80', // 降噪耳机
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80', // 复古相机
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&auto=format&fit=crop&q=80', // 时尚单鞋
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80'  // 太阳眼镜
    ];

    let resultUrl = mockImages[Math.floor(Math.random() * mockImages.length)];
    if (prompt.toLowerCase().includes('watch') || prompt.includes('表')) {
      resultUrl = mockImages[0];
    } else if (prompt.toLowerCase().includes('shoe') || prompt.includes('鞋')) {
      resultUrl = mockImages[1];
    } else if (prompt.toLowerCase().includes('headphone') || prompt.includes('耳机')) {
      resultUrl = mockImages[2];
    } else if (prompt.toLowerCase().includes('camera') || prompt.includes('相机')) {
      resultUrl = mockImages[3];
    }
    
    await new Promise(resolve => setTimeout(resolve, 1200));
    return resultUrl;
  }
}

module.exports = MockLLMProvider;
