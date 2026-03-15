import * as fs from 'fs';

const path = 'd:\\_src\\blockchain\\token42\\frontend\\node_modules\\@xmtp\\wasm-bindings\\dist\\bindings_wasm.d.ts';
const content = fs.readFileSync(path, 'utf-8');

const lines = content.split('\n');
const results: string[] = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('CreateGroupOptions') || lines[i].includes('CreateDmOptions')) {
    // Print the containing block (usually a few lines up and down)
    results.push(`--- Line ${i + 1} ---`);
    for (let j = Math.max(0, i - 1); j < Math.min(lines.length, i + 10); j++) {
       results.push(`${j + 1}: ${lines[j]}`);
    }
  }
}

console.log("=== Options Signatures ===");
console.log(results.join('\n'));
