const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');
const imageAgent = require('./imageAgent');
const { VideoOrchestrator, STATES } = require('./orchestrator');

module.exports = {
  scriptAgent,
  videoAgent,
  clipAgent,
  imageAgent,
  orchestrator: new VideoOrchestrator(),
  VideoOrchestrator,
  STATES
};
