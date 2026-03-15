import { Client } from '@xmtp/browser-sdk';

try {
  // Inspect Client prototype to see what properties it defines getter for
  const clientProto = Client.prototype;
  console.log("Client properties:", Object.getOwnPropertyNames(clientProto));
  
  // We cannot easily get the type of 'conversations' without an instance,
  // but we can look at the compiled JS if we list the source or grep.
} catch (e) {
  console.error(e);
}
