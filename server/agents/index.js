const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');
const imageAgent = require('./imageAgent');
const assetAgent = require('./assetAgent');
const { VideoOrchestrator, STATES } = require('./orchestrator');
const { memoryManager, vectorStore, embeddingService } = require('./memory');
const skillLoader = require('./skills/skillLoader');
const masterAgent = require('./masterAgent');
const { getToolDescriptions, executeTool, getToolNames } = require('./tools/toolRegistry');
const { runToolLoop } = require('./toolLoop');

module.exports = {
  scriptAgent,
  videoAgent,
  clipAgent,
  imageAgent,
  assetAgent,
  orchestrator: new VideoOrchestrator(),
  VideoOrchestrator,
  STATES,
  memoryManager,
  vectorStore,
  embeddingService,
  skillLoader,
  masterAgent,
  toolRegistry: { getToolDescriptions, executeTool, getToolNames },
  runToolLoop
};
