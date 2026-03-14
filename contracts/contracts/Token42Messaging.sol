// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IERC20
 * @dev Minimal ERC-20 interface for rUSD interaction.
 */
interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IToken42Profile {
    function hasProfile(address user) external view returns (bool);
}

/**
 * @title Token42Messaging
 * @dev Staked messaging with AI-verified matches and anti-spam slashing.
 *      Minimal implementation — no OpenZeppelin.
 *
 * Key features:
 *   - Senders stake rUSD to message (anti-spam)
 *   - AI Agent signs match intent off-chain
 *   - Recipients claim stakes by replying
 *   - AI Agent can slash stakes for harassment
 */
contract Token42Messaging {
    IERC20 public immutable rUSD;
    IToken42Profile public immutable profileContract;
    address public owner;
    
    mapping(address => bool) public isAdmin;
    mapping(address => uint256) public nonces;

    uint256 public stakeAmount = 1 * 10 ** 18; // 1 rUSD
    uint256 public minMatchScore = 80;
    uint256 public protocolFeeBps = 1000; // 10% Protocol Fee
    uint256 public revealAmount = 5 * 10 ** 18; // 5 rUSD to reveal

    struct MessageRequest {
        address sender;
        address recipient;
        uint256 stake;
        bool active;
    }

    mapping(bytes32 => MessageRequest) public matches;

    // --- Custom Errors ---
    error NotOwner();
    error NotAdmin();
    error InvalidSignature();
    error ScoreTooLow();
    error StakeTransferFailed();
    error ClaimTransferFailed();
    error SlashTransferFailed();
    error NoActiveStake();
    error NotRecipient();
    error InvalidAddress();
    error AlreadyAdmin();
    error NotAnAdmin();
    error CannotRemoveOwner();
    error MissingProfile();
    error RevealTransferFailed();

    // --- Events ---
    event MessageStaked(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 nonce
    );
    event MessageClaimed(
        address indexed recipient,
        address indexed sender,
        uint256 amount,
        uint256 fee
    );
    event StakeSlashed(
        address indexed sender,
        address indexed recipient,
        address indexed reviewer,
        uint256 amount
    );
    event RevealPurchased(
        address indexed sender,
        address indexed recipient,
        uint256 amount
    );
    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);
    event StakeAmountUpdated(uint256 newAmount);
    event MinMatchScoreUpdated(uint256 newScore);
    event ProtocolFeeUpdated(uint256 newBps);
    event RevealAmountUpdated(uint256 newAmount);

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender] && msg.sender != owner) revert NotAdmin();
        _;
    }

    constructor(address _rUSD, address _profileContract, address _aiAgent) {
        if (_rUSD == address(0) || _profileContract == address(0) || _aiAgent == address(0)) revert InvalidAddress();
        rUSD = IERC20(_rUSD);
        profileContract = IToken42Profile(_profileContract);
        owner = msg.sender;
        isAdmin[_aiAgent] = true;
        isAdmin[msg.sender] = true;
    }

    /**
     * @dev Add a new admin (e.g., another AI agent instance or human reviewer).
     */
    function addAdmin(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (isAdmin[account]) revert AlreadyAdmin();
        isAdmin[account] = true;
        emit AdminAdded(account);
    }

    /**
     * @dev Remove an admin.
     */
    function removeAdmin(address account) external onlyOwner {
        if (account == owner) revert CannotRemoveOwner();
        if (!isAdmin[account]) revert NotAnAdmin();
        isAdmin[account] = false;
        emit AdminRemoved(account);
    }

    /**
     * @dev Update the stake amount.
     */
    function setStakeAmount(uint256 _amount) external onlyAdmin {
        stakeAmount = _amount;
        emit StakeAmountUpdated(_amount);
    }

    /**
     * @dev Update the reveal amount.
     */
    function setRevealAmount(uint256 _amount) external onlyAdmin {
        revealAmount = _amount;
        emit RevealAmountUpdated(_amount);
    }

    /**
     * @dev Update the minimum match score.
     */
    function setMinMatchScore(uint256 _score) external onlyAdmin {
        minMatchScore = _score;
        emit MinMatchScoreUpdated(_score);
    }

    /**
     * @dev Update the protocol fee in basis points (100 BPS = 1%).
     *      Max fee capped at 20% (2000 BPS) for safety.
     */
    function setProtocolFee(uint256 _bps) external onlyAdmin {
        if (_bps > 2000) revert InvalidAddress(); // Reuse error for simplicity or add a specific one
        protocolFeeBps = _bps;
        emit ProtocolFeeUpdated(_bps);
    }

    /**
     * @dev Stake rUSD to message a recipient.
     *      Requires a valid ECDSA signature from an Admin (typically the AI Agent).
     *      Includes a nonce for replay protection.
     */
    function stakeForMessage(
        address recipient,
        uint256 matchScore,
        bytes calldata signature
    ) external {
        if (!profileContract.hasProfile(msg.sender)) revert MissingProfile();
        if (!profileContract.hasProfile(recipient)) revert MissingProfile();
        if (matchScore < minMatchScore) revert ScoreTooLow();

        uint256 currentNonce = nonces[msg.sender];
        
        // Verify AI Agent / Admin signature (EIP-191)
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, recipient, matchScore, currentNonce)
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        address signer = _recover(ethSignedHash, signature);
        if (!isAdmin[signer]) revert InvalidSignature();

        // Increment nonce for replay protection
        nonces[msg.sender]++;

        // Transfer rUSD stake
        if (!rUSD.transferFrom(msg.sender, address(this), stakeAmount)) {
            revert StakeTransferFailed();
        }

        bytes32 matchId = keccak256(abi.encodePacked(msg.sender, recipient));
        matches[matchId] = MessageRequest({
            sender: msg.sender,
            recipient: recipient,
            stake: stakeAmount,
            active: true
        });

        emit MessageStaked(msg.sender, recipient, stakeAmount, currentNonce);
    }

    /**
     * @dev Recipient claims the stake by replying.
     */
    function claimStake(address sender) external {
        bytes32 matchId = keccak256(abi.encodePacked(sender, msg.sender));
        MessageRequest storage req = matches[matchId];

        if (!req.active) revert NoActiveStake();
        if (req.recipient != msg.sender) revert NotRecipient();

        req.active = false;
        
        uint256 fee = (req.stake * protocolFeeBps) / 10000;
        uint256 recipientAmount = req.stake - fee;

        if (fee > 0) {
            if (!rUSD.transfer(owner, fee)) revert ClaimTransferFailed();
        }

        if (!rUSD.transfer(msg.sender, recipientAmount)) {
            revert ClaimTransferFailed();
        }

        emit MessageClaimed(msg.sender, sender, recipientAmount, fee);
    }

    /**
     * @dev Purchase a reveal for a specific recipient. 
     *      Signals high intent by burning/paying rUSD to the treasury.
     */
    function burnForReveal(address recipient) external {
        if (!profileContract.hasProfile(msg.sender)) revert MissingProfile();
        if (!profileContract.hasProfile(recipient)) revert MissingProfile();

        if (!rUSD.transferFrom(msg.sender, owner, revealAmount)) {
            revert RevealTransferFailed();
        }

        emit RevealPurchased(msg.sender, recipient, revealAmount);
    }

    /**
     * @dev Slash a sender's stake for harassment.
     *      Only an Admin can trigger this.
     */
    function slashStake(address sender, address recipient) external onlyAdmin {
        bytes32 matchId = keccak256(abi.encodePacked(sender, recipient));
        MessageRequest storage req = matches[matchId];

        if (!req.active) revert NoActiveStake();

        req.active = false;
        // Slashed stakes go to the owner (governance treasury)
        if (!rUSD.transfer(owner, req.stake)) {
            revert SlashTransferFailed();
        }

        emit StakeSlashed(sender, recipient, msg.sender, req.stake);
    }

    // --- Internal ECDSA Recovery ---

    function _recover(
        bytes32 hash,
        bytes memory sig
    ) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();

        return ecrecover(hash, v, r, s);
    }
}
