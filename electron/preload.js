const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  runModel: (modelId, options) => ipcRenderer.invoke('run-model', modelId, options),
  initializeP2P: () => ipcRenderer.invoke('initialize-p2p'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
  getBalance: () => ipcRenderer.invoke('get-balance'),
  shareModel: (modelId) => ipcRenderer.invoke('share-model', modelId),
  getNetworkStats: () => ipcRenderer.invoke('get-network-stats'),
  sendMessage: (modelId, message, features) => ipcRenderer.invoke('send-message', modelId, message, features),
  detectRuntimes: () => ipcRenderer.invoke('detect-runtimes'),
  downloadModel: (modelId) => ipcRenderer.invoke('download-model', modelId),
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getPeerHealth: () => ipcRenderer.invoke('get-peer-health'),
  getModelIndex: () => ipcRenderer.invoke('get-model-index'),
  pinPeer: (peer) => ipcRenderer.invoke('pin-peer', peer),
  unpinPeer: (peer) => ipcRenderer.invoke('unpin-peer', peer),
  getPreferredPeer: (modelId) => ipcRenderer.invoke('get-preferred-peer', modelId),
  clearPreferredPeer: (modelId) => ipcRenderer.invoke('clear-preferred-peer', modelId),
  getCapabilities: () => ipcRenderer.invoke('get-capabilities'),
  clearCapabilities: () => ipcRenderer.invoke('clear-capabilities'),
  uploadFile: (file) => ipcRenderer.invoke('upload-file', file),
  recordVoice: () => ipcRenderer.invoke('record-voice'),
  uploadDocument: (file) => ipcRenderer.invoke('upload-document', file),
  uploadImage: (file) => ipcRenderer.invoke('upload-image', file),
  uploadVideo: (file) => ipcRenderer.invoke('upload-video', file),
  uploadAudio: (file) => ipcRenderer.invoke('upload-audio', file),
  activateThinkingMode: () => ipcRenderer.invoke('activate-thinking-mode'),
  activateSearchMode: () => ipcRenderer.invoke('activate-search-mode'),
});
