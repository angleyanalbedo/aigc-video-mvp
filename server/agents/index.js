const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');
const imageAgent = require('./imageAgent');
const assetAgent = require('./assetAgent');
const { VideoOrchestrator, STATES } = require('./orchestrator');
const { memoryManager, vectorStore, embeddingService } = require('./memory');
const skillLoader = require('./skills/skillLoader');
const masterAgent = require('./masterAgent');
const IntentParser = require('./intent/intentParser');
const TaskPlanner = require('./planner/taskPlanner');
const ToolExecutor = require('./executor/toolExecutor');

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
  IntentParser,
  TaskPlanner,
  ToolExecutor
};
