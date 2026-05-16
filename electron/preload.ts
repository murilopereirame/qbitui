import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

interface SavedCredentials {
  host: string;
  username: string;
  password: string;
}

interface PendingFile {
  name: string;
  data: string; // base64
}

const api = {
  getCredentials: () => ipcRenderer.invoke("credentials:get") as Promise<SavedCredentials | null>,
  setCredentials: (credentials: SavedCredentials) => ipcRenderer.invoke("credentials:set", credentials) as Promise<boolean>,
  clearCredentials: () => ipcRenderer.invoke("credentials:clear") as Promise<boolean>,
  getLogs: () => ipcRenderer.invoke("logs:get") as Promise<string[]>,
  getMagnetHandlerStatus: () => ipcRenderer.invoke("handlers:magnet:status") as Promise<boolean>,
  setMagnetHandler: (enable: boolean) => ipcRenderer.invoke("handlers:magnet:set", enable) as Promise<boolean>,
  onOpenUrl: (callback: (url: string) => void) => {
    const handler = (_event: IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("open-url", handler);
    return () => ipcRenderer.removeListener("open-url", handler);
  },
  onOpenFile: (callback: (file: PendingFile) => void) => {
    const handler = (_event: IpcRendererEvent, file: PendingFile) => callback(file);
    ipcRenderer.on("open-file", handler);
    return () => ipcRenderer.removeListener("open-file", handler);
  },
};

contextBridge.exposeInMainWorld("qbitui", api);

