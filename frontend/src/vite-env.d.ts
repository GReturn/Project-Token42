/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PINATA_JWT: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
