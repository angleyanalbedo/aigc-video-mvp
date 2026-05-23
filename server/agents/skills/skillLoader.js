const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../skills');

class SkillLoader {
  constructor() {
    this._cache = new Map();
    this._watchers = new Map();
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
