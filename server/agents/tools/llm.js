const { createOpenAI } = require('@ai-sdk/openai');

const ARK_API_KEY = process.env.ARK_API_KEY || 'ark-2af51d30-ed70-4061-a2cd-74f454ccc4e8-2282e';
const LLM_EP = process.env.LLM_EP || 'ep-20260514115629-vhldw';

const ark = createOpenAI({
  name: 'volcengine',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: ARK_API_KEY,
});

const model = ark.languageModel(LLM_EP);

async function generateText({ system, prompt, maxTokens = 2000, temperature = 0.7 }) {
  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_EP,
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
    console.error('LLM 调用失败:', error);
    throw error;
  }
}

async function generateStructuredText({ system, prompt, schema, maxTokens = 2000 }) {
  const response = await generateText({
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

module.exports = {
  model,
  ark,
  generateText,
  generateStructuredText,
  LLM_EP,
  ARK_API_KEY
};
