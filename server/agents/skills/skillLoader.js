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
    const llm = this._getLLM();
    
    if (context.schema) {
      return await llm.generateStructuredText({
        system: prompt,
        prompt: context.prompt || '',
        schema: context.schema
      });
    }
    
    return await llm.generateText({
      system: prompt,
      prompt: context.prompt || ''
    });
  }

  _getLLM() {
    const { generateText, generateStructuredText } = require('../tools/llm');
    return { generateText, generateStructuredText };
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

  getSkillForAgent(agentName) {
    const allSkills = this.list();
    const matched = allSkills.filter(s => s.agentName === agentName);
    if (matched.length === 0) return null;
    return this.load(matched[0].id);
  }

  loadPromptForAgent(agentName) {
    const skill = this.getSkillForAgent(agentName);
    return skill ? skill.prompt : null;
  }

  list() {
    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
    return files.map(filename => {
      const filePath = path.join(SKILLS_DIR, filename);
      const stat = fs.statSync(filePath);
      const parsed = this._parseFilename(filename);
      return {
        filename,
        id: parsed.id,
        agentName: parsed.agentName,
        skillName: parsed.skillName,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
    });
  }

  load(skillId) {
    if (this._cache.has(skillId)) {
      const cached = this._cache.get(skillId);
      return cached;
    }

    const filename = this._findFile(skillId);
    if (!filename) return null;

    const filePath = path.join(SKILLS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = this._parseContent(content);

    const result = {
      id: skillId,
      filename,
      ...parsed,
      rawContent: content
    };

    this._cache.set(skillId, result);
    return result;
  }

  loadPrompt(skillId) {
    const skill = this.load(skillId);
    if (!skill) return null;
    return skill.prompt;
  }

  save(skillId, content) {
    const filename = this._findFile(skillId) || `${skillId}.md`;
    const filePath = path.join(SKILLS_DIR, filename);

    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    this._cache.delete(skillId);

    return {
      id: skillId,
      filename,
      size: Buffer.byteLength(content),
      modifiedAt: new Date().toISOString()
    };
  }

  watch(skillId, callback) {
    const filename = this._findFile(skillId);
    if (!filename) return;

    const filePath = path.join(SKILLS_DIR, filename);

    if (this._watchers.has(skillId)) {
      this._watchers.get(skillId).close();
    }

    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        this._cache.delete(skillId);
        const updated = this.load(skillId);
        if (callback) callback(updated);
      }
    });

    this._watchers.set(skillId, watcher);
  }

  stopWatch(skillId) {
    if (this._watchers.has(skillId)) {
      this._watchers.get(skillId).close();
      this._watchers.delete(skillId);
    }
  }

  stopAllWatches() {
    for (const [id] of this._watchers) {
      this.stopWatch(id);
    }
  }

  _parseFilename(filename) {
    const baseName = filename.replace('.md', '');
    const parts = baseName.split('_');

    if (parts.length >= 2) {
      return {
        id: baseName,
        agentName: parts[0],
        skillName: parts.slice(1).join('_')
      };
    }

    return {
      id: baseName,
      agentName: baseName,
      skillName: baseName
    };
  }

  _parseContent(content) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    let metadata = {};
    let prompt = content;

    if (frontmatterMatch) {
      metadata = this._parseFrontmatter(frontmatterMatch[1]);
      prompt = content.slice(frontmatterMatch[0].length);
    }

    return {
      metadata,
      prompt: prompt.trim()
    };
  }

  _parseFrontmatter(text) {
    const metadata = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        if (value.startsWith('[') && value.endsWith(']')) {
          metadata[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else if (value === 'true') {
          metadata[key] = true;
        } else if (value === 'false') {
          metadata[key] = false;
        } else if (!isNaN(value)) {
          metadata[key] = Number(value);
        } else {
          metadata[key] = value;
        }
      }
    }

    return metadata;
  }

  _findFile(skillId) {
    if (!fs.existsSync(SKILLS_DIR)) return null;

    const files = fs.readdirSync(SKILLS_DIR);
    const exactMatch = files.find(f => f === `${skillId}.md`);
    if (exactMatch) return exactMatch;

    const partialMatch = files.find(f => f.replace('.md', '') === skillId);
    if (partialMatch) return partialMatch;

    return null;
  }
}

module.exports = new SkillLoader();
