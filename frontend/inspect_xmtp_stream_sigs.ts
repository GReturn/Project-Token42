import * as fs from 'fs';

const path = 'd:\\_src\\blockchain\\token42\\frontend\\node_modules\\@xmtp\\browser-sdk\\dist\\index.d.ts';
const content = fs.readFileSync(path, 'utf-8');

const lines = content.split('\n');
const results: string[] = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('stream(') || lines[i].includes('streamMessages') || lines[i].includes('streamAllMessages')) {
    results.push(`${i + 1}: ${lines[i].trim()}`);
  }
}

console.log("=== Stream Signatures ===");
console.log(results.join('\n'));
