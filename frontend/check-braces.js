const fs = require('fs');
const content = fs.readFileSync('d:\\_src\\blockchain\\token42\\frontend\\src\\App.css', 'utf8');
const openCount = (content.match(/\{/g) || []).length;
const closeCount = (content.match(/\}/g) || []).length;
console.log(`Open: ${openCount}, Close: ${closeCount}`);
if (openCount !== closeCount) {
    console.log("❌ Brace Mismatch!");
} else {
    console.log("✅ Braces Balance!");
}
