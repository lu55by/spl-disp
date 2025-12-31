/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_UPLOAD_PATH_HAIR: string;
  readonly VITE_API_UPLOAD_PATH_BODY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
