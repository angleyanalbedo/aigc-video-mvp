const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');
const imageAgent = require('./imageAgent');
const assetAgent = require('./assetAgent');
const { VideoOrchestrator, STATES } = require('./orchestrator');

module.exports = {
  scriptAgent,
  videoAgent,
  clipAgent,
  imageAgent,
  assetAgent,
  orchestrator: new VideoOrchestrator(),
  VideoOrchestrator,
  STATES
};
