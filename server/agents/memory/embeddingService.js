const path = require('path');
const fs = require('fs');

const EMBEDDING_DIM = 128;
const ONNX_MODEL_DIR = path.join(__dirname, '../../data/onnx_models');
const ONNX_MODEL_PATH = path.join(ONNX_MODEL_DIR, 'model.onnx');

let onnxSession = null;
let onnxAvailable = false;

try {
  require('onnxruntime-node');
  onnxAvailable = true;
} catch {
  onnxAvailable = false;
}

class EmbeddingService {
  constructor() {
    this.dim = EMBEDDING_DIM;
    this.useOnnx = false;
    this._initOnnx();
  }

  async _initOnnx() {
    if (!onnxAvailable) {
      console.log('📐 EmbeddingService: onnxruntime-node 未安装，使用本地哈希嵌入');
      return;
    }

    if (!fs.existsSync(ONNX_MODEL_PATH)) {
      console.log('📐 EmbeddingService: ONNX 模型文件未找到，使用本地哈希嵌入');
      console.log(`   提示: 将 ONNX 模型放置到 ${ONNX_MODEL_PATH} 可启用语义向量`);
      return;
    }

    try {
      const ort = require('onnxruntime-node');
      onnxSession = await ort.InferenceSession.create(ONNX_MODEL_PATH, {
        executionProviders: ['cpu']
      });
      this.useOnnx = true;
      console.log('✅ EmbeddingService: ONNX 模型加载成功，使用语义向量嵌入');
    } catch (err) {
      console.warn('⚠️ EmbeddingService: ONNX 模型加载失败，降级为哈希嵌入:', err.message);
    }
  }

  async embed(text) {
    if (this.useOnnx && onnxSession) {
      return this._embedOnnx(text);
    }
    return this._embedHash(text);
  }

  async _embedOnnx(text) {
    try {
      const ort = require('onnxruntime-node');
      const tokens = this._simpleTokenize(text);
      const ids = new BigInt64Array(tokens.length);
      const mask = new BigInt64Array(tokens.length);
      const typeIds = new BigInt64Array(tokens.length);

      for (let i = 0; i < tokens.length; i++) {
        ids[i] = BigInt(this._hashToken(tokens[i]));
        mask[i] = 1n;
        typeIds[i] = 0n;
      }

      const inputIds = new ort.Tensor('int64', ids, [1, tokens.length]);
      const attentionMask = new ort.Tensor('int64', mask, [1, tokens.length]);
      const tokenTypeIds = new ort.Tensor('int64', typeIds, [1, tokens.length]);

      const output = await onnxSession.run({
        input_ids: inputIds,
        attention_mask: attentionMask,
        token_type_ids: tokenTypeIds
      });

      const lastHidden = output['last_hidden_state'] || output[Object.keys(output)[0]];
      if (lastHidden && lastHidden.data) {
        return this._meanPool(lastHidden.data, tokens.length, lastHidden.dims[2]);
      }

      return this._embedHash(text);
    } catch (err) {
      console.warn('⚠️ ONNX 推理失败，降级哈希嵌入:', err.message);
      return this._embedHash(text);
    }
  }

  _meanPool(data, seqLen, hiddenDim) {
    const result = new Float32Array(this.dim);
    const step = Math.max(1, Math.floor(hiddenDim / this.dim));

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < this.dim; j++) {
        const srcIdx = i * hiddenDim + j * step;
        if (srcIdx < data.length) {
          result[j] += data[srcIdx] / seqLen;
        }
      }
    }

    return this._normalize(result);
  }

  _embedHash(text) {
    const vector = new Float32Array(this.dim);
    const normalized = text.toLowerCase().trim();

    const trigrams = this._extractTrigrams(normalized);
    for (const tri of trigrams) {
      const hash = this._fnv1aHash(tri);
      const idx = Math.abs(hash) % this.dim;
      vector[idx] += 1.0;
    }

    const words = normalized.split(/\s+/);
    for (const word of words) {
      if (word.length < 2) continue;
      const hash = this._fnv1aHash(word);
      const idx = Math.abs(hash) % this.dim;
      vector[idx] += 0.5;
      const idx2 = Math.abs(hash >> 8) % this.dim;
      vector[idx2] += 0.3;
    }

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      vector[charCode % this.dim] += 0.1;
    }

    return this._normalize(vector);
  }

  _extractTrigrams(text) {
    const trigrams = [];
    for (let i = 0; i <= text.length - 3; i++) {
      trigrams.push(text.substring(i, i + 3));
    }
    return trigrams;
  }

  _fnv1aHash(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  _hashToken(token) {
    return this._fnv1aHash(token) % 30000;
  }

  _simpleTokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  _normalize(vector) {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) return vector;
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
    return vector;
  }

  static cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  vectorToBuffer(vector) {
    const buffer = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatLE(vector[i], i * 4);
    }
    return buffer;
  }

  bufferToVector(buffer) {
    const vector = new Float32Array(buffer.length / 4);
    for (let i = 0; i < vector.length; i++) {
      vector[i] = buffer.readFloatLE(i * 4);
    }
    return vector;
  }

  getDimension() {
    return this.dim;
  }

  isOnnxActive() {
    return this.useOnnx;
  }
}

module.exports = new EmbeddingService();
