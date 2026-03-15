const fs = require('fs');

const filePath = 'd:\\_src\\blockchain\\token42\\frontend\\src\\App.css';
let content = fs.readFileSync(filePath, 'utf8');

const anchorRegex = /\.match-avatar\s*\{\s*width:\s*56px;\s*height:\s*56px;\s*border-radius:\s*50%;\s*/;
const insertAfter = `\n  flex-shrink: 0;\n  background: linear-gradient(135deg, var(--primary), var(--accent));\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-weight: 800;\n  font-size: 1.2rem;\n  color: #000;\n}\n\n.match-info {\n  flex: 1;\n  min-width: 0;\n}\n\n.match-info h3 {\n  font-size: 1rem;\n  font-weight: 700;\n  margin: 0 0 0.3rem;\n  font-family: ui-monospace, monospace;\n}\n\n.match-info p {\n  font-size: 0.9rem;\n  color: var(--text-muted);\n  margin: 0;\n  line-height: 1.5;\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.match-score-ring {\n  width: 60px;\n  height: 60px;\n  flex-shrink: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  position: relative;\n}\n\n.match-score-ring svg {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  transform: rotate(-90deg);\n}\n\n.match-score-ring .score-text {\n  font-size: 0.85rem;\n  font-weight: 800;\n  color: var(--accent);\n}\n\n.match-actions {\n  margin-top: 1.25rem;\n  display: flex;\n  gap: 0.75rem;\n}\n`;

if (anchorRegex.test(content)) {
    content = content.replace(anchorRegex, (match) => { return match.trim() + insertAfter; });
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("✅ CSS Rewritten successfully with regex!");
} else {
    console.log("❌ Anchor not found with regex!");
    // output first 10 chars of content for debugging
    console.log("Content start:", content.slice(0, 100));
}
