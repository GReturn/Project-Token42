# Token42 Codebase Audit & Action Plan

## Requirements Checklist

### User Registration & Authentication 
- ✅ Connect wallet
- ✅ Identity verification (Soulbound ID - `MockIdentityPrecompile`)
- 🗑️ Change password (Not needed in Web3, authentication is via wallet)

### Profile Creation & Management
- ✅ Name, Bio, Upload profile photo (IPFS via Pinata)
- 1️⃣ ❌ Age, Gender, Interests/Hobbies, Location (Schema lacks some, UI lacks inputs)
- 1️⃣ ❌ Encrypt profile data before storage (Currently plain JSON pinned to public IPFS)
- ✅ Store data in decentralized storage (IPFS)
- ✅ Edit/update profile anytime

### Preference Settings
- 1️⃣ ❌ Set age range
- 1️⃣ ❌ Set distance radius
- 1️⃣ ❌ Select gender preference
- 1️⃣ ❌ Select relationship intent

### Privacy-Preserving Matchmaking System
- ❓ Computes compatibility scores inside a TEE (Agent logic exists to use Ollama embeddings, but TEE hardware execution is not explicitly enforced codebase-wide to my knowledge)
- ❓ Platform must not have access to raw user data (Right now, agent fetches raw bio from IPFS to generate embeddings)
- ✅ Compatibility score is returned (`handleMatchRequest` logic exists)
- 1️⃣ ❌ UI must be considered (Currently, matching UI relies on auto-matching without preference inputs)

### Match Reveal Mechanism
- ✅ Pay a fee to reveal a compatible match (`burnForReveal` in `Token42Messaging`)
- ✅ Smart contracts handle payment automatically
- ✅ The reveal event is recorded on-chain

### Staked Messaging System
- ✅ User A stakes a small amount to send the first message (`stakeForMessage`)
- ✅ The AI must approve compatibility before messaging (`signMatch` in agent)
- ✅ A protocol fee is taken from successful conversations (`claimStake`)

### Safety and Moderation
- ✅ Block harassers (`/report` endpoint and agent logic)
- ✅ Report inappropriate behavior (`/report` LLM evaluation)
- ✅ Smart contracts enforce penalties (slashing via `slashStake`)
- ✅ Harassers lose staked funds

### Date Scheduling with Escrow
- ✅ Both users stake a fixed amount when scheduling a date (`proposeDate`/`acceptDate` in `Token42Escrow`)
- ✅ Escrow pool is locked in smart contracts
- ✅ Successful date -> refund minus protocol fee (`resolveSuccess` via `submitProof`)
- ✅ No-show -> stake slashed (`resolveExpired`)
- ✅ Mutual cancellation -> full refund (`cancelDate`)

### Account Settings & Privacy
- 1️⃣ ❌ Edit profile visibility
- 1️⃣ ❌ Manage notification settings

### Secure Messaging
- ✅ Encrypted (XMTP implemented)
- ✅ Platform cannot read message content (XMTP is peer-to-peer E2EE, though Agent acts as a third party for moderation)

### Wallet & Token Interaction
- ✅ Connect and manage a crypto wallet
- ✅ Approve transactions for staking, messaging, match reveal, escrow
- 1️⃣ ❌ View transaction history (No frontend UI for this yet)

### User Safety Protocol
- ✅ Block other users
- ✅ Cancel date agreements
- ✅ Withdraw escrow funds
- 1️⃣ ❌ Manage privacy settings

### Transparency & Trust
- ✅ Smart contracts must be publicly auditable (Verified on-chain/Standard Hardhat layout)
- ✅ Users can verify staking rules, escrow outcomes, protocol fees
- ❓ System actions deterministic (AI LLM evaluations can be non-deterministic, recommend standardizing prompts or models)

---

## Undocumented Features (Bonus Points)

These features are present in the code but were not explicitly listed in the requirements:

- **Right to be Forgotten (`Token42Profile.sol`):** Users can `burn()` their Soulbound ID to permanently exit the platform.
- **Idle Stake Recovery (`Token42Messaging.sol`):** Senders can reclaim stakes if a recipient is idle for 24h (includes a 20% anti-spam penalty).
- **Mutual Collateral Burn (`Token42Escrow.sol`):** If a date window expires without proof or cancellation, *both* parties lose their stake.
- **Identity Revocation:** Admins can `revoke` malicious users' profiles on-chain.
- **Messaging Session Rescue (`App.tsx`):** Advanced XMTP V3 tools to clear local DBs and revoke excess installations.
- **In-App Token Faucet:** Users can claim test `rUSD` directly within the app UI.
- **AI Moderation:** Agent logic for monitoring group chats and slashing for verified violations.

---

## Technical Areas of Concern & Where to Look

### 1. The Frontend UI (`frontend/src/App.tsx` & `frontend/src/components/`)
**Judge's Feedback:** "Improve the UI to look more like a dating app because it currently looks like a wallet."
- **Current State:** The UI uses generic `GlassCard` and `StatusBadge` elements, likely lacking a polished Tinder/Bumble-like swiping or discovery interface.
- **Action Needed:** Need to completely revamp the visual identity. Add a card-based swipe or carousel layout for the Matchmaking UI, warm gradients, and an inviting onboarding flow. 

### 2. Profile Storage & Encryption (`frontend/src/utils/storage.ts`)
**Requirement Failure:** Data is not encrypted on IPFS.
- **Current State:** `uploadToIPFS` uses `pinJSONToIPFS` via Pinata. The data (bio, name, etc.) is stored in plaintext JSON.
- **Action Needed:** Implement Lit Protocol or simple Web WebCrypto API (AES-GCM) encryption before calling Pinata, storing the ciphertext on IPFS.

### 3. Matching & Preferences UI (`App.tsx` & Data Models)
**Requirement Failure:** No preferences/customizability.
- **Current State:** The `UserProfile` struct lacks strictly defined fields for Age, Gender, Preferences. The matching agent `index.ts` only generates embeddings purely from the generic `bio`.
- **Action Needed:** Extend `UserProfile` in `frontend/src/utils/storage.ts`, update the form in the UI, and modify `agent/src/index.ts` to hard-filter based on Age/Gender preferences before running semantic similarity.

---

## 3-Day Prioritization Plan (The "Clutch" Strategy)

### Day 1: Visual Overhaul & Onboarding Experience
*Goal: Fix the biggest judge complaint first.*
1. **Color Palette & CSS:** Update `App.css` and component styling. Move away from clinical "Web3" blues/dark themes toward inviting dating themes (e.g., vibrant warm gradients, soft whites, modern rounded cards).
2. **Onboarding Flow:** Create a step-by-step wizard for Profile Creation.
    - Step 1: Basic Info (Name, Age, Gender).
    - Step 2: Fun personality questions (e.g., "Two truths and a lie", "Ideal first date").
    - Step 3: Preferences (Age range, Distance).
3. **Data Model Update:** Update `storage.ts` to support these new fields. *(Skip actual encryption until Day 2 to ensure UI works visually first).*

### Day 2: Core User Journey Implementation (Match & Discover)
*Goal: Make the app "feel" like a dating app.*
1. **Discovery UI:** Replace the generic list match view with a Card Stack UI. Show photos prominently, blur them if the "Reveal" fee hasn't been paid.
2. **Agent Filters:** Update `agent/src/index.ts` to respect user preferences (Age, Gender) before returning the AI compatibility matches.
3. **Encryption (If time permits):** Add a simple envelope encryption layer before uploading to Pinata to satisfy the privacy requirement.

### Day 3: Polish, Gameify, & Escrow Review
*Goal: "Introduce fun things to do on the app."*
1. **Interactive Escrow:** Create a clean modal for the Date Escrow features. Make proposing a date feel like sending a literal invitation, and submitting the proof (PoRLModal) feel like unlocking an achievement.
2. **Transaction History:** Add a simple "Activity" tab where users can see their stakes and refunds to satisfy the missing "View transaction history" requirement.
3. **Final Testing:** Rehearse the entire flow (Wallet -> Soulbound Mint -> Profile Creation -> AI Match -> Stake to Message -> Date Escrow) end-to-end to ensure smart contracts don't brick the UI.
