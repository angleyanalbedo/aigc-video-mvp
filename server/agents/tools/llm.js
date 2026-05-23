const { llmProvider } = require('../../services/providers');

async function generateText({ system, prompt, maxTokens = 2000, temperature = 0.7 }) {
  return llmProvider.generateText({ system, prompt, temperature, maxTokens });
}

async function generateStructuredText({ system, prompt, schema, maxTokens = 2000 }) {
  return llmProvider.generateStructuredText({ system, prompt, schema, maxTokens });
}

module.exports = {
  model: llmProvider.model,
  ark: llmProvider.ark,
  generateText,
  generateStructuredText,
  LLM_EP: llmProvider.llmEp || 'mock-llm-ep',
  ARK_API_KEY: llmProvider.apiKey || 'mock-api-key'
};
