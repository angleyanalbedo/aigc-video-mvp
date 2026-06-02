const BaseLLMProvider = require('./BaseLLMProvider');

class AliLLMProvider extends BaseLLMProvider {
  constructor({ apiKey, llmModel = 'qwen-plus', imageModel = 'wanx-v1' }) {
    super();
    this.apiKey = apiKey;
    this.llmModel = llmModel;
    this.imageModel = imageModel;
  }

  async generateText({ system, prompt, temperature = 0.7, maxTokens = 2000 }) {
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt }
          ],
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

      console.log(`📡 [AliLLMProvider] 正在向 DashScope 发起生图任务: model=${this.imageModel}, size=${size}`);

      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify({
          model: this.imageModel,
          input: {
            prompt
          },
          parameters: {
            size,
            n: 1
          }
        })
      });

      const data = await response.json();
      if (data.code || (data.status_code && data.status_code !== 200)) {
        throw new Error(data.message || 'API Error');
      }

      const taskId = data.output?.task_id || data.id;
      if (!taskId) {
        throw new Error('No task ID returned from Ali image generation API');
      }

      console.log(`📡 [AliLLMProvider] 生图任务已创建, ID: ${taskId}, 开始轮询状态...`);

      // Poll task status
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        const pollResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });
        const pollData = await pollResponse.json();
        if (pollData.code || (pollData.status_code && pollData.status_code !== 200)) {
          throw new Error(pollData.message || 'API Error while polling status');
        }

        const taskStatus = pollData.output?.task_status;
        console.log(`📡 [AliLLMProvider] 轮询任务 ${taskId} 状态: ${taskStatus}`);

        if (taskStatus === 'SUCCEEDED') {
          const url = pollData.output?.results?.[0]?.url;
          if (url) return url;
          throw new Error('No image URL returned in succeeded task response');
        }
        if (taskStatus === 'FAILED') {
          throw new Error(pollData.output?.message || 'Image generation task failed');
        }
        attempts++;
      }
      throw new Error('Ali Image generation task timed out');
    } catch (error) {
      console.error('Ali LLM Provider generateImage 失败:', error);
      throw error;
    }
  }
}

module.exports = AliLLMProvider;
