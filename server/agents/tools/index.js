const llm = require('./llm');
const videoAPI = require('./videoAPI');
const ttsAPI = require('./ttsAPI');
const searchAPI = require('./searchAPI');
const materialDownloader = require('./materialDownloader');
const workbenchAPI = require('./workbenchAPI');

module.exports = {
  llm,
  videoAPI,
  ttsAPI,
  searchAPI,
  materialDownloader,
  workbenchAPI
};
