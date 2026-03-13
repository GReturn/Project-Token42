export const STORAGE_CONFIG = {
  // Pinata JWT from environment variables
  PINATA_JWT: import.meta.env.VITE_PINATA_JWT || '',
  
  // Public IPFS gateway for retrieval (Pinata gateway is faster but public works too)
  IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/'
};
