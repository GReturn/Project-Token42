const ethers = require("ethers");
const errors = [
  "NotOwner()",
  "NotAdmin()",
  "InvalidSignature()",
  "ScoreTooLow()",
  "StakeTransferFailed()",
  "ClaimTransferFailed()",
  "SlashTransferFailed()",
  "NoActiveStake()",
  "NotRecipient()",
  "InvalidAddress()",
  "AlreadyAdmin()",
  "NotAnAdmin()",
  "CannotRemoveOwner()",
  "MissingProfile()",
  "RevealTransferFailed()"
];

const functions = [
  "stakeForMessage(address,uint256,bytes)"
];

errors.forEach(err => {
  console.log(`${err}: ${ethers.id(err).slice(0, 10)}`);
});

functions.forEach(f => {
    const iface = new ethers.Interface([`function ${f}`]);
    console.log(`${f}: ${iface.getFunction(f.split("(")[0]).selector}`);
});
