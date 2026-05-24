const BaseLLMProvider = require('./BaseLLMProvider');
const { createOpenAI } = require('@ai-sdk/openai');
const { generateText as aiGenerateText, streamText, generateTextWithStructuredOutput } = require('ai');
const { z } = require('zod');

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
      const result = await aiGenerateText({
        model: this.model,
        system: system,
        prompt: prompt,
        temperature: temperature,
        maxTokens: maxTokens
      });
      
      return result.text;
    } catch (error) {
      console.error('Ark LLM 调用失败:', error);
      throw error;
    }
  }

  async generateStructuredText({ system, prompt, schema, maxTokens = 2000 }) {
    try {
      const zodSchema = this._convertToZodSchema(schema);
      
      const result = await generateTextWithStructuredOutput({
        model: this.model,
        system: `${system}\n\n请使用 JSON 格式返回结果。`,
        prompt: `${prompt}\n\n请严格按照以下 JSON 格式返回，不要包含其他内容：\n${JSON.stringify(schema, null, 2)}`,
        schema: zodSchema,
        maxTokens: maxTokens
      });
      
      return result;
    } catch (error) {
      console.error('Ark LLM 结构化输出失败:', error);
      throw error;
    }
  }

  _convertToZodSchema(schema) {
    if (typeof schema === 'string') {
      return z.string();
    }
    
    if (Array.isArray(schema)) {
      return z.array(this._convertToZodSchema(schema[0]));
    }
    
    if (typeof schema === 'object') {
      const shape = {};
      for (const [key, value] of Object.entries(schema)) {
        if (typeof value === 'string') {
          if (value.includes('number')) {
            shape[key] = z.number();
          } else if (value.includes('array')) {
            shape[key] = z.array(z.any());
          } else if (value.includes('boolean')) {
            shape[key] = z.boolean();
          } else {
            shape[key] = z.string();
          }
        } else if (typeof value === 'object') {
          shape[key] = this._convertToZodSchema(value);
        } else {
          shape[key] = z.any();
        }
      }
      return z.object(shape);
    }
    
    return z.any();
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

  getModel() {
    return this.model;
  }
}

module.exports = ArkLLMProvider;
