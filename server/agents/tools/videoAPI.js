const { videoProvider } = require('../../services/providers');

async function createVideoTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5, imageUrl = null }) {
  return videoProvider.createTask({ prompt, resolution, ratio, duration, imageUrl });
}

async function getVideoStatus(taskId) {
  return videoProvider.getStatus(taskId);
}

async function waitForVideo(taskId, maxAttempts = 40) {
  return videoProvider.waitForCompletion(taskId, maxAttempts);
}

module.exports = {
  createVideoTask,
  getVideoStatus,
  waitForVideo,
  VIDEO_EP: videoProvider.videoEp || 'mock-video-ep'
};
