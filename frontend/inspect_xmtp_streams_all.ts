import * as fs from 'fs';

const path = 'd:\\_src\\blockchain\\token42\\frontend\\node_modules\\@xmtp\\browser-sdk\\dist\\index.d.ts';
const content = fs.readFileSync(path, 'utf-8');

const lines = content.split('\n');
const results: string[] = [];

let recording = false;
let currentBlock = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('declare class') || line.includes('interface')) {
    currentBlock = line.trim();
  }
  if (line.includes('stream')) {
    results.push(`Line ${i + 1} [${currentBlock}]: ${line.trim()}`);
  }
}

console.log("=== All Stream References ===");
console.log(results.join('\n'));
