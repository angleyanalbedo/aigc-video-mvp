const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../skills');
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;

class SkillLoader {
  constructor() {
    this._cache = new Map();
    this._watchers = new Map();
  }

  async execute(skillId, context = {}, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, maxRetries = DEFAULT_MAX_RETRIES } = options;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const skill = this.load(skillId);
        if (!skill) {
          throw new Error(`Skill "${skillId}" not found`);
        }

        const prompt = this._injectContext(skill.prompt, context);
        
        const result = await Promise.race([
          this._executeSkill(skillId, prompt, context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Skill "${skillId}" execution timeout after ${timeout}ms`)), timeout)
          )
        ]);

        return {
          success: true,
          skillId,
          result,
          attempt,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error(`⚠️ Skill "${skillId}" execution failed (attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            skillId,
            error: error.message,
            attempt,
            timestamp: Date.now()
          };
        }
        
        await this._delay(1000 * attempt);
      }
    }
  }

  async _executeSkill(skillId, prompt, context) {
    const { generateText, generateStructuredText } = require('../tools/llm');
    
    if (context.schema) {
      return await generateStructuredText({
        system: prompt,
        prompt: context.prompt || '',
        schema: context.schema
      });
    }
    
    return await generateText({
      system: prompt,
      prompt: context.prompt || ''
    });
  }

  _injectContext(prompt, context) {
    if (!context.params || Object.keys(context.params).length === 0) {
      return prompt;
    }

    let enhancedPrompt = prompt;
    
    for (const [key, value] of Object.entries(context.params)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      enhancedPrompt = enhancedPrompt.replace(placeholder, JSON.stringify(value));
    }

    return enhancedPrompt;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async call(agentName, params = {}, options = {}) {
    const skill = this.getSkillForAgent(agentName);
    if (!skill) {
      throw new Error(`No skill found for agent "${agentName}"`);
    }
    return this.execute(skill.id, { params, prompt: params.prompt || '', schema: params.schema }, options);
  }

  async callSkill(skillId, params = {}, options = {}) {
    return this.execute(skillId, { params, prompt: params.prompt || '', schema: params.schema }, options);
  }

  load(skillId) {
    if (this._cache.has(skillId)) {
      return this._cache.get(skillId);
    }

    const skillPath = path.join(SKILLS_DIR, `${skillId}.md`);
    if (!fs.existsSync(skillPath)) {
      return null;
    }

    const content = fs.readFileSync(skillPath, 'utf8');
    const skill = this._parseSkillContent(content, skillId);
    
    this._cache.set(skillId, skill);
    this._setupWatcher(skillId, skillPath);

    return skill;
  }

  _parseSkillContent(content, skillId) {
    let frontMatter = {};
    let prompt = content;

    if (content.startsWith('---')) {
      const frontMatterEnd = content.indexOf('---', 3);
      if (frontMatterEnd !== -1) {
        const frontMatterContent = content.slice(3, frontMatterEnd).trim();
        prompt = content.slice(frontMatterEnd + 3).trim();
        
        frontMatter = this._parseFrontMatter(frontMatterContent);
      }
    }

    return {
      id: skillId,
      prompt,
      metadata: frontMatter
    };
  }

  _parseFrontMatter(content) {
    const metadata = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        
        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
          }
        } else {
          metadata[key] = value;
        }
      }
    }

    return metadata;
  }

  _setupWatcher(skillId, skillPath) {
    if (this._watchers.has(skillId)) {
      return;
    }

    const watcher = fs.watch(skillPath, (eventType) => {
      if (eventType === 'change') {
        this._cache.delete(skillId);
        console.log(`🔄 Skill "${skillId}" reloaded`);
      }
    });

    this._watchers.set(skillId, watcher);
  }

  list() {
    if (!fs.existsSync(SKILLS_DIR)) {
      return [];
    }

    return fs.readdirSync(SKILLS_DIR)
      .filter(file => file.endsWith('.md'))
      .map(file => file.slice(0, -3));
  }

  getSkillForAgent(agentName) {
    const skills = this.list();
    const agentLower = agentName.toLowerCase();
    
    for (const skillId of skills) {
      const skill = this.load(skillId);
      if (skill && skill.metadata) {
        if (skill.metadata.agent && skill.metadata.agent.toLowerCase() === agentLower) {
          return skill;
        }
        if (skillId.toLowerCase().includes(agentLower)) {
          return skill;
        }
      }
    }
    return null;
  }

  loadPrompt(skillId) {
    const skill = this.load(skillId);
    return skill ? skill.prompt : null;
  }
}

module.exports = new SkillLoader();
