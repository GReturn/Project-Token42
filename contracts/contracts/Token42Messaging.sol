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
    address public aiAgent;
    address public owner;
    uint256 public stakeAmount = 1 * 10 ** 18; // 1 rUSD

    struct MessageRequest {
        address sender;
        address recipient;
        uint256 stake;
        bool active;
    }

    mapping(bytes32 => MessageRequest) public matches;

    // --- Events ---
    event MessageStaked(
        address indexed sender,
        address indexed recipient,
        uint256 amount
    );
    event MessageClaimed(
        address indexed recipient,
        address indexed sender,
        uint256 amount
    );
    event StakeSlashed(
        address indexed sender,
        address indexed reviewer,
        uint256 amount
    );

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _rUSD, address _aiAgent) {
        rUSD = IERC20(_rUSD);
        aiAgent = _aiAgent;
        owner = msg.sender;
    }

    /**
     * @dev Update the AI Agent address.
     */
    function setAiAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }

    /**
     * @dev Stake rUSD to message a recipient.
     *      Requires a valid ECDSA signature from the AI Agent.
     */
    function stakeForMessage(
        address recipient,
        uint256 matchScore,
        bytes calldata signature
    ) external {
        // Verify AI Agent signature (EIP-191)
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, recipient, matchScore)
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        address signer = _recover(ethSignedHash, signature);
        require(signer == aiAgent, "Invalid AI Agent signature");
        require(matchScore >= 80, "Match score too low for staking");

        // Transfer rUSD stake
        require(
            rUSD.transferFrom(msg.sender, address(this), stakeAmount),
            "Stake failed"
        );

        bytes32 matchId = keccak256(abi.encodePacked(msg.sender, recipient));
        matches[matchId] = MessageRequest({
            sender: msg.sender,
            recipient: recipient,
            stake: stakeAmount,
            active: true
        });

        emit MessageStaked(msg.sender, recipient, stakeAmount);
    }

    /**
     * @dev Recipient claims the stake by replying.
     */
    function claimStake(address sender) external {
        bytes32 matchId = keccak256(abi.encodePacked(sender, msg.sender));
        MessageRequest storage req = matches[matchId];

        require(req.active, "No active stake found");
        require(req.recipient == msg.sender, "Only recipient can claim");

        req.active = false;
        require(rUSD.transfer(msg.sender, req.stake), "Claim transfer failed");

        emit MessageClaimed(msg.sender, sender, req.stake);
    }

    /**
     * @dev Slash a sender's stake for harassment.
     *      Only the AI Agent (oracle) can trigger this.
     */
    function slashStake(address sender, address recipient) external {
        require(msg.sender == aiAgent, "Only AI Agent can slash");

        bytes32 matchId = keccak256(abi.encodePacked(sender, recipient));
        MessageRequest storage req = matches[matchId];

        require(req.active, "No active stake to slash");

        req.active = false;
        require(rUSD.transfer(owner, req.stake), "Slash transfer failed");

        emit StakeSlashed(sender, msg.sender, req.stake);
    }

    // --- Internal ECDSA Recovery ---

    function _recover(
        bytes32 hash,
        bytes memory sig
    ) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature v value");

        return ecrecover(hash, v, r, s);
    }
}
