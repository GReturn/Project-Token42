# UI Integration Guide: Token42 Identity & Messaging

This guide covers the necessary steps to integrate Token42 identity verification and messaging on the frontend. A robust UI integration is required to complement the on-chain checks.

## 1. Identity Verification Requirements

Since identities are governed by the Polkadot Identity Precompile and the Token42Profile smart contract, the UI must:

- **Check Profile Existence Before Interactions:**
  Call `hasProfile(userAddress)` on the `Token42Profile` contract before allowing a user to see matching or messaging features. If they do not have a profile, direct them to the minting page.

- **Polkadot On-Chain Verification:**
  Before they can mint a `Token42Profile`, they must have a valid on-chain Polkadot Identity (judgment of 'Reasonable' or 'KnownGood'). The UI should guide users to the identity registrar DApp if they are not verified.

## 2. Messaging Pre-Checks

The `Token42Messaging` contract strictly enforces that **both** the sender and recipient have active profiles. The UI should preemptively prevent errors:

- **Prevent Messaging Unregistered Users:**
  Do not allow the current user to trigger a match/message intent with a recipient who does not possess a valid `Token42Profile`. Either filter out such users from the Discovery feed or disable their message button.

- **Handle AI Agent Signatures Gracefully:**
  The AI Agent relies on local/backend inference to generate signatures. Ensure the UI can handle loading states while waiting for the AI Agent to process the embeddings and return a signed match payload (minimum 80% similarity threshold).

## 3. Testnet Configuration (Paseo)

The `Token42Profile` and `Token42Module` rely on a configurable identity precompile address.
- When deploying to Paseo Testnet, ensure the frontend environment variables point to the correct smart contract addresses.
- During local testing, the hardhat scripts use a mocked precompile address. The UI should connect to the local hardhat node when running dev environments.

## 4. Error Handling Additions

The smart contract features custom errors:
- `MissingProfile()`: Thrown if either sender or receiver lacks an on-chain `Token42Profile` during messaging. The UI should map this revert to a user-friendly modal stating "You or the recipient does not have a verified profile."
- `PrecompileFailed()`: Thrown if the Polkadot network node doesn't support the identity precompile.
- `ScoreTooLow()`: Thrown if the AI Agent match score is below the minimum threshold (default 80).

**Please refer to the contract ABI for exact error signatures.**
