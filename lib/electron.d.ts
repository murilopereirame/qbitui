export interface SavedCredentials {
  host: string;
  username: string;
  password: string;
}

declare global {
  interface Window {
    qbitui?: {
      getCredentials: () => Promise<SavedCredentials | null>;
      setCredentials: (credentials: SavedCredentials) => Promise<boolean>;
      clearCredentials: () => Promise<boolean>;
    };
  }
}

export {};
