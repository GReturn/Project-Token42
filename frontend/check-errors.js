const { ethers } = require("ethers");

const errors = [
  "NotOwner()",
  "NotInDate()",
  "InvalidStatus()",
  "WindowNotExpired()",
  "WindowExpired()",
  "TransferFailed()",
  "MissingProfile()",
  "InvalidAddress()",
  "InvalidSignature()"
];

for (const err of errors) {
  const hash = ethers.id(err).slice(0, 10);
  console.log(`${err} -> ${hash}`);
}
