const { ethers } = require('ethers');

const addr1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Checksummed
const addr1_lower = addr1.toLowerCase();

const addr2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Checksummed
const addr2_lower = addr2.toLowerCase();

// Scenario 1: Both Lowercase
const hash_lower = ethers.solidityPackedKeccak256(["address", "address"], [addr1_lower, addr2_lower]);

// Scenario 2: Both Checksummed
const hash_check = ethers.solidityPackedKeccak256(["address", "address"], [addr1, addr2]);

console.log("Hash Lowercase:", hash_lower);
console.log("Hash Checksummed:", hash_check);
console.log("Match:", hash_lower === hash_check ? "YES" : "NO");

if (hash_lower !== hash_check) {
    console.log("⚠️ ADDRESS CASING MATTERS IN SOLIDITY PACKED!");
} else {
    console.log("✅ Address casing DOES NOT matter.");
}
