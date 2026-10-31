const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "hengzhang",
  Object.freeze({
    revealData: () => ipcRenderer.invoke("hengzhang:reveal-data"),
    openHomepage: () => ipcRenderer.invoke("hengzhang:open-homepage"),
    updateStatus: () => ipcRenderer.invoke("hengzhang:updates:status"),
    checkUpdates: () => ipcRenderer.invoke("hengzhang:updates:check"),
    setAutomaticUpdates: (value) =>
      ipcRenderer.invoke("hengzhang:updates:automatic", value),
    dismissUpdate: () => ipcRenderer.invoke("hengzhang:updates:dismiss"),
    openUpdateDownload: () => ipcRenderer.invoke("hengzhang:updates:download"),
    onUpdateState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("hengzhang:update-state", listener);
      return () =>
        ipcRenderer.removeListener("hengzhang:update-state", listener);
    },
    onShowUpdates: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("hengzhang:show-updates", listener);
      return () =>
        ipcRenderer.removeListener("hengzhang:show-updates", listener);
    },
  }),
);
