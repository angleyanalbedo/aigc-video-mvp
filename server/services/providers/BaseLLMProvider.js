class BaseLLMProvider {
  async generateText({ system, prompt, temperature = 0.7, maxTokens = 2000 }) {
    throw new Error('Method generateText() must be implemented');
  }

  async generateStructuredText({ system, prompt, schema, maxTokens = 2000 }) {
    throw new Error('Method generateStructuredText() must be implemented');
  }

  async generateImage({ prompt, width = 1024, height = 1024 }) {
    throw new Error('Method generateImage() must be implemented');
  }
}

module.exports = BaseLLMProvider;
