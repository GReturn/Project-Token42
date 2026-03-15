/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PINATA_JWT: string
  readonly VITE_PROFILE_CONTRACT_ADDRESS?: string
  readonly VITE_MESSAGING_CONTRACT_ADDRESS?: string
  readonly VITE_ESCROW_CONTRACT_ADDRESS?: string
  readonly VITE_RUSD_CONTRACT_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
