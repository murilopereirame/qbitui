import { contextBridge, ipcRenderer } from "electron";

interface SavedCredentials {
  host: string;
  username: string;
  password: string;
}

const api = {
  getCredentials: () => ipcRenderer.invoke("credentials:get") as Promise<SavedCredentials | null>,
  setCredentials: (credentials: SavedCredentials) => ipcRenderer.invoke("credentials:set", credentials) as Promise<boolean>,
  clearCredentials: () => ipcRenderer.invoke("credentials:clear") as Promise<boolean>,
};

contextBridge.exposeInMainWorld("qbitui", api);
