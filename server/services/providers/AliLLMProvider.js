const BaseLLMProvider = require('./BaseLLMProvider');

class AliLLMProvider extends BaseLLMProvider {
  constructor({ apiKey, llmModel = 'qwen-plus', imageModel = 'qwen-image-2.0-pro' }) {
    super();
    this.apiKey = apiKey;
    this.llmModel = llmModel;
    this.imageModel = imageModel;
  }

  async generateText({ system, prompt, messages, temperature = 0.7, maxTokens = 2000 }) {
    try {
      // 支持多轮消息格式：如果传了 messages 数组则直接使用，否则用 prompt 构造单条消息
      const msgArray = messages
        ? [...(system ? [{ role: 'system', content: system }] : []), ...messages]
        : [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: msgArray,
          temperature,
          max_tokens: maxTokens
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Ali LLM 调用失败:', error);
      throw error;
    }
  }

  async generateStructuredText({ system, prompt, schema, maxTokens = 2000 }) {
    const response = await this.generateText({
      system: `${system}\n\n请使用 JSON 格式返回结果。`,
      prompt: `${prompt}\n\n请严格按照以下 JSON 格式返回，不要包含其他内容：\n${JSON.stringify(schema, null, 2)}`,
      maxTokens
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch {
      console.error('JSON 解析失败:', response);
      throw new Error('LLM 返回格式错误');
    }
  }

  async generateImage({ prompt, width = 1024, height = 1024 }) {
    try {
      let size = '1024*1024';
      if (width === 1024 && height === 1024) size = '1024*1024';
      else if (width === 720 && height === 1280) size = '720*1280';
      else if (width === 1280 && height === 720) size = '1280*720';
      // 支持更大分辨率
      else if (width === 2048 && height === 2048) size = '2048*2048';

      console.log(`📡 [AliLLMProvider] 正在向 DashScope 发起生图任务: model=${this.imageModel}, size=${size}`);

      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.imageModel,
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { text: prompt }
                ]
              }
            ]
          },
          parameters: {
            prompt_extend: true,
            watermark: false,
            size
          }
        })
      });

      const data = await response.json();
      console.log(`📡 [AliLLMProvider] 生图 API 响应:`, JSON.stringify(data).slice(0, 500));

      if (data.code) {
        throw new Error(data.message || `DashScope API Error: ${data.code}`);
      }

      // 从响应中提取图片 URL
      // Qwen-Image 返回格式: output.choices[0].message.content[].image
      const choices = data.output?.choices;
      if (choices && choices.length > 0) {
        const content = choices[0].message?.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.image) return item.image;
            if (item.url) return item.url;
          }
        }
      }

      // 备用提取路径
      const results = data.output?.results;
      if (results && results.length > 0 && results[0].url) {
        return results[0].url;
      }

      throw new Error('No image URL found in DashScope response');
    } catch (error) {
      console.error('Ali LLM Provider generateImage 失败:', error);
      throw error;
    }
  }
}

module.exports = AliLLMProvider;
