const ethers = require('ethers');
const error = "InvalidSignature()";
const selector = ethers.id(error).slice(0, 10);
console.log(`Selector for ${error}: ${selector}`);
