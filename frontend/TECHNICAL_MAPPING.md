# Token42 Frontend-to-Backend Functionality Mapping

This document maps the user-friendly UI elements and buttons in the redesigned frontend to their corresponding technical functions and backend interactions.

## 1. Landing Page (`step === 'connect'`)

| UI Element | Label/Icon | Technical Function | Backend/Contract Interaction |
| :--- | :--- | :--- | :--- |
| **Hero Button** | `Connect & Begin` | `connectWallet()` | Triggers wallet connection (e.g., MetaMask). Checks for existing profile via `checkProfile()`. Initializes XMTP client. |

---

## 2. Navigation Bar (Global)

| UI Element | Label/Icon | Technical Function | Purpose |
| :--- | :--- | :--- | :--- |
| **Tab Button** | `Discovery` | `setStep('matching')` | Switches view to potential match discovery. |
| **Tab Button** | `Messages` | `setStep('chat')` | Switches view to active XMTP conversations. |
| **Profile Icon** | `SP` Placeholder | `setStep('profile')` | Navigate to Profile creation/editing. |

---

## 3. Discovery / Matching (`step === 'matching'`)

| UI Element | Label/Icon | Technical Function | Backend/Contract Interaction |
| :--- | :--- | :--- | :--- |
| **Primary Action** | `Find Matches` | `findMatches()` | Calls backend API to fetch curated matches based on AI compatibility scores. |
| **Lock Icon** | `Lock` | `setIsMatchLockModalOpen(true)` | UI safety check. Informs user that profile is incomplete for matching. |
| **Match Card Action**| `Stake to Connect` | `stakeAndMessage(m)` | **Contract:** Calls `stakeTokens` on the Dating contract. **Logic:** Stakes rUSD to initiate a secure connection. |
| **Match Card Action**| `Open Chat` | `setActiveChat(addr)` | UI transition to an already established session. |

---

## 4. Chat & Messaging (`step === 'chat'`)

| UI Element | Label/Icon | Technical Function | Backend/Contract Interaction |
| :--- | :--- | :--- | :--- |
| **Reveal Button** | `Reveal Photos` | `burnForReveal(addr)` | **Logic:** Burns 5 rUSD via token contract to "unblur" the match's metadata/avatar locally. |
| **Meetup Action** | `Ask Out` | `setIsPoRLModalOpen(true)` | Phase 1 of PoRL (Proof of Real Life). |
| **Meetup Action** | `Verify Date` | `checkDateStatus(addr)` | Checks escrow status on contract to confirm if date requirement met. |
| **Overlay Action** | `Claim & Unlock` | `claimStake()` | **Contract:** Triggers `claimEscrow`. Moves tokens from escrow to user wallet after match logic is satisfied. |
| **Menu Action** | `Report User` | `handleReport(addr)` | Flags address in backend/moderation system and blocks local session via `blockedUsers` state. |
| **Message Input** | `Send Arrow` | `sendChat()` | Sends encrypted payload through **XMTP Network**. |

---

## 5. Profile Management (`step === 'profile'`)

| UI Element | Label/Icon | Technical Function | Backend/Contract Interaction |
| :--- | :--- | :--- | :--- |
| **Save Action** | `Save Profile` | `saveProfile()` | **Backend:** Uploads profile metadata (Name, Bio, Interests) to decentralized storage/database and links to wallet address. |
| **Media Upload** | `Upload Photos` | `handleMediaUpload()` | Pinning service (Pinata/IPFS) for avatar images. |

---

> [!NOTE]
> **Technical Key:**
> - `rUSD`: The native reward/staking token used for game-theory dating mechanics.
> - `XMTP`: The decentralized messaging protocol used for all end-to-end encrypted chats.
