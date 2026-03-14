import { ethers } from 'ethers';
import { STORAGE_CONFIG } from '../config/storage';

export interface UserProfile {
  name?: string;
  bio: string;
  interests?: string[];
  location?: string;
  avatar?: string;
  timestamp: number;
  creator: string;
}

/**
 * Uploads a JSON object (profile metadata) to IPFS via Pinata API.
 * @param address The wallet address of the user (used for metadata only now).
 * @param data The JSON object to upload.
 * @returns The CID of the uploaded content.
 */
export async function uploadToIPFS(address: string, data: UserProfile): Promise<string> {
  if (!STORAGE_CONFIG.PINATA_JWT) {
    throw new Error('Please configure VITE_PINATA_JWT in your frontend/.env file');
  }

  // Pinata's pinJSONToIPFS expects a specific body format
  const body = {
    pinataOptions: {
      cidVersion: 0
    },
    pinataMetadata: {
      name: `Token42_Profile_${address.slice(0, 6)}`,
      keyvalues: {
        address: address
      }
    },
    pinataContent: data
  };

  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STORAGE_CONFIG.PINATA_JWT}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Pinata Error: ${errorText}`);
      throw new Error(`Pinata returned ${response.status}`);
    }

    const result = await response.json();
    return result.IpfsHash; // Pinata returns IpfsHash instead of Hash
  } catch (error) {
    console.error("IPFS Upload Failed:", error);
    throw new Error('Upload to Pinata failed');
  }
}

/**
 * Fetches profile metadata from IPFS with local caching.
 * @param cid The CID of the content to fetch.
 * @returns The UserProfile object.
 */
export async function fetchFromIPFS(cid: string): Promise<UserProfile> {
  // Check localStorage cache first
  const cacheKey = `ipfs_json_${cid}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn("Failed to parse cached IPFS metadata, fetching fresh...");
    }
  }

  try {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.status}`);
    }
    const data = await response.json();
    
    // Save to cache
    localStorage.setItem(cacheKey, JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error("IPFS Fetch Failed:", error);
    throw new Error('Failed to fetch profile from IPFS');
  }
}

/**
 * Fetches an image from IPFS with local caching using Data URLs.
 * @param cid The CID of the image to fetch.
 * @returns A promise resolving to the Data URL of the image.
 */
export async function fetchImageFromIPFS(cid: string): Promise<string> {
  const cacheKey = `ipfs_img_${cid}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached && !cached.startsWith('blob:')) return cached;


  try {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    
    const rawBlob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        try {
          localStorage.setItem(cacheKey, base64data);
        } catch (e) {
          console.warn("Storage full, could not cache image");
        }
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(rawBlob);
    });
  } catch (error) {
    console.error("IPFS Image Fetch Failed:", error);
    return `https://gateway.pinata.cloud/ipfs/${cid}`; // Fallback to direct URL
  }
}
