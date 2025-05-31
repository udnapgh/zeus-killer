const { contextBridge, ipcRenderer } = require('electron');

// Mengekspos API ke window global dengan nama 'youtubeApi'
contextBridge.exposeInMainWorld('youtubeApi', {
  authorize: () => ipcRenderer.invoke('authorize'),
  checkAuthorization: () => ipcRenderer.invoke('check-authorization'),
  setChannelId: (channelId) => ipcRenderer.invoke('set-channel-id', channelId),
  uploadCredentials: (credentialsData) =>
    ipcRenderer.invoke('upload-credentials', credentialsData),
  getYoutubeContentList: () => ipcRenderer.invoke('youtube-content-list'),
  deleteComments: (commentIds) =>
    ipcRenderer.invoke('delete-comments', commentIds),
});
