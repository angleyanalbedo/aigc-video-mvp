const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');
const { VideoOrchestrator, STATES } = require('./orchestrator');

module.exports = {
  scriptAgent,
  videoAgent,
  clipAgent,
  orchestrator: new VideoOrchestrator(),
  VideoOrchestrator,
  STATES
};
