# XMTP V3 (MLS) Upgrade Guide

This guide documents the process and technical requirements for upgrading Token42 from XMTP V2 to XMTP V3 (MLS).

## Overview
XMTP V3 introduces **Messaging Layer Security (MLS)**, providing stronger group security, better scalability, and decentralized identity management.

## Key Changes: AI Agent (Node.js)

The AI Agent uses `@xmtp/node-sdk`.

### 1. Signer Interface
V3 requires a stricter `Signer` interface. Unlike V2, which accepted a simple Ethers signer, V3 requires a wrapped object that explicitly defines the identity type and kind.

```typescript
const xmtpSigner = {
    type: 'EOA',
    getIdentifier: async () => ({
        identifier: wallet.address,
        identifierKind: 0 // 0 = Ethereum/EVM
    }),
    getChainId: () => BigInt(CHAIN_ID),
    signMessage: async (message: string) => {
        const signature = await wallet.signMessage(message);
        return ethers.getBytes(signature); // Must return Uint8Array
    }
};
```

### 2. Client Initialization
Initialization requires setting a `dbPath` for the local MLS database.

```typescript
const client = await Client.create(xmtpSigner, {
    env: "dev",
    dbPath: "./xmtp.db"
});
```

## Key Changes: Frontend (Browser)

The Frontend uses `@xmtp/browser-sdk`.

### 1. Vite Configuration
V3 uses WebAssembly and top-level await. You **must** update `vite.config.ts`:

```typescript
// vite.config.ts
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    topLevelAwait(), // Required for Wasm bindings
    // ...other plugins
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
})
```

### 2. Message Encoding
In the Browser SDK, `encodeText` is asynchronous. You must await it before sending.

```typescript
const encoded = await encodeText("Hello World");
await conversation.send(encoded);
```

### 3. Identity & Streaming
V3 uses **Inbox IDs** instead of just addresses. When streaming messages, check `message.senderInboxId`.

```typescript
for await (const message of stream) {
  if (message.senderInboxId === client.inboxId) continue;
  // Handle incoming message...
}
```

## Troubleshooting

### `10/10 installations` Error
Each Inbox ID is limited to 10 active installations. In development, you may hit this limit if you frequently restart the agent without a persistent database.

**Solution**: Initialize the client with `disableAutoRegister: true`, call `client.revokeAllOtherInstallations()`, and then `client.register()`.

```typescript
const options = { env: "dev", dbPath: "./xmtp.db", disableAutoRegister: true };
const client = await Client.create(signer, options);
await client.revokeAllOtherInstallations();
await client.register();
```

## Resources
- [XMTP Documentation](https://docs.xmtp.org/)
- [XMTP Browser SDK GitHub](https://github.com/xmtp/xmtp-js/tree/main/packages/browser-sdk)
- [XMTP Node SDK GitHub](https://github.com/xmtp/xmtp-js/tree/main/packages/node-sdk)
