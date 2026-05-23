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
      console.error('JSON 解析失败:', response);
      throw new Error('LLM 返回格式错误');
    }
  }
}

module.exports = MockLLMProvider;
