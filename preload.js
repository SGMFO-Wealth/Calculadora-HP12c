'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hp12c', {
  ready: () => ipcRenderer.send('hp:ready'),
  onSettings: cb => ipcRenderer.on('hp:settings', (_e, s) => cb(s)),
  onMenu: cb => ipcRenderer.on('hp:menu', (_e, cmd, arg) => cb(cmd, arg)),
  saveFile: (name, content) => ipcRenderer.invoke('hp:save-file', name, content),
  copyText: text => ipcRenderer.invoke('hp:copy-text', text),
  pasteText: () => ipcRenderer.invoke('hp:paste-text')
});
