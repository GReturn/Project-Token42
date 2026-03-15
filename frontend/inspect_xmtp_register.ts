import { Client, createBackend } from '@xmtp/browser-sdk';
import { ethers } from 'ethers';

async function main() {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;
  
  const xmtpSigner = {
    type: 'EOA' as const,
    getIdentifier: async () => ({
      identifier: address,
      identifierKind: 0 as any
    }),
    signMessage: async (message: string) => {
      const sig = await wallet.signMessage(message);
      return ethers.getBytes(sig);
    }
  };

  try {
     const backend = await createBackend({ env: "dev" });
     const client = await Client.create(xmtpSigner as any, { 
       env: "dev",
       dbPath: null // In-memory to simulate first startup
     } as any);

     console.log("Inbox ID:", client.inboxId);
     console.log("isRegistered:", client.isRegistered);
     
     if (!client.isRegistered) {
         console.log("Triggering registration...");
         // Is there a register method?
         const proto = Object.getPrototypeOf(client);
         console.log("Proto methods:", Object.getOwnPropertyNames(proto).filter(n => typeof (client as any)[n] === 'function'));
     }
  } catch (e) {
     console.error(e);
  }
}

main();
