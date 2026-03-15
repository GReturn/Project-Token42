const fs = require('fs');
const path = require('path');

async function sync() {
    console.log("Starting address sync...");

    const addressPath = path.join(__dirname, '../deployed-addresses.json');
    if (!fs.existsSync(addressPath)) {
        console.error("❌ Error: deployed-addresses.json not found! Please run deployment first.");
        process.exit(1);
    }

    const addresses = JSON.parse(fs.readFileSync(addressPath, 'utf-8'));

    const frontendEnvPath = path.join(__dirname, '../frontend/.env');
    const agentEnvPath = path.join(__dirname, '../agent/.env');

    // 1. Sync to Frontend (.env) with VITE_ prefixes
    let frontendEnv = "";
    if (fs.existsSync(frontendEnvPath)) {
        frontendEnv = fs.readFileSync(frontendEnvPath, 'utf-8');
    }

    const frontendVars = {
        VITE_PROFILE_CONTRACT_ADDRESS: addresses.Token42Profile,
        VITE_MESSAGING_CONTRACT_ADDRESS: addresses.Token42Messaging,
        VITE_ESCROW_CONTRACT_ADDRESS: addresses.Token42Escrow,
        VITE_RUSD_CONTRACT_ADDRESS: addresses.MockRUSD
    };

    frontendEnv = updateEnvContent(frontendEnv, frontendVars);
    fs.writeFileSync(frontendEnvPath, frontendEnv);
    console.log("✅ Sync completed for: frontend/.env");

    // 2. Sync to Agent (.env)
    let agentEnv = "";
    if (fs.existsSync(agentEnvPath)) {
        agentEnv = fs.readFileSync(agentEnvPath, 'utf-8');
    }

    const agentVars = {
        MESSAGING_CONTRACT_ADDRESS: addresses.Token42Messaging
    };

    agentEnv = updateEnvContent(agentEnv, agentVars);
    fs.writeFileSync(agentEnvPath, agentEnv);
    console.log("✅ Sync completed for: agent/.env");
}

function updateEnvContent(content, vars) {
    let lines = content.split('\n');
    const updatedKeys = new Set();

    // Update existing keys
    lines = lines.map(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            if (vars[key] !== undefined) {
                updatedKeys.add(key);
                return `${key}="${vars[key]}"`;
            }
        }
        return line;
    });

    // Append new keys
    for (const [key, value] of Object.entries(vars)) {
        if (!updatedKeys.has(key)) {
            lines.push(`${key}="${value}"`);
        }
    }

    return lines.join('\n').trim() + '\n';
}

sync().catch(console.error);
