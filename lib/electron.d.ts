export interface SavedCredentials {
  host: string;
  username: string;
  password: string;
}

export interface PendingFile {
  name: string;
  data: string; // base64-encoded file content
}

declare global {
  interface Window {
    qbitui?: {
      getCredentials: () => Promise<SavedCredentials | null>;
      setCredentials: (credentials: SavedCredentials) => Promise<boolean>;
      clearCredentials: () => Promise<boolean>;
      getLogs: () => Promise<string[]>;
      getMagnetHandlerStatus: () => Promise<boolean>;
      setMagnetHandler: (enable: boolean) => Promise<boolean>;
      onOpenUrl: (callback: (url: string) => void) => () => void;
      onOpenFile: (callback: (file: PendingFile) => void) => () => void;
    };
  }
}

export {};
