const BaseLLMProvider = require('./BaseLLMProvider');
const { createOpenAI } = require('@ai-sdk/openai');

class ArkLLMProvider extends BaseLLMProvider {
  constructor({ apiKey, llmEp, imageEp }) {
    super();
    this.apiKey = apiKey;
    this.llmEp = llmEp;
    this.imageEp = imageEp;
    
    this.ark = createOpenAI({
      name: 'volcengine',
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: this.apiKey,
    });
    this.model = this.ark.languageModel(this.llmEp);
  }

  async generateText({ system, prompt, temperature = 0.7, maxTokens = 2000 }) {
    try {
      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.llmEp,
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
      console.error('Ark LLM 调用失败:', error);
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
      if (!this.imageEp) {
        throw new Error('Image generation endpoint not configured. Please set IMAGE_EP in .env file.');
      }
      
      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.imageEp,
          prompt,
          width,
          height
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'CV API Error');
      }

      if (data.data && data.data[0] && data.data[0].url) {
        return data.data[0].url;
      }
      throw new Error('No image URL returned from CV Generations API');
    } catch (error) {
      console.error('Ark LLM Provider generateImage 失败:', error);
      throw error;
    }
  }
}

module.exports = ArkLLMProvider;
