// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title Token42Messaging
 * @dev Manages staked messaging and anti-spam protocols using AI verification.
 */
contract Token42Messaging is Ownable {
    using ECDSA for bytes32;

    IERC20 public immutable rUSD;
    address public aiAgent;
    uint256 public stakeAmount = 1 * 10 ** 18; // 1 rUSD default

    struct MessageRequest {
        address sender;
        address recipient;
        uint256 stake;
        bool active;
    }

    mapping(bytes32 => MessageRequest) public matches;

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

    constructor(address _rUSD, address _aiAgent) Ownable(msg.sender) {
        rUSD = IERC20(_rUSD);
        aiAgent = _aiAgent;
    }

    /**
     * @dev Update the AI Agent address.
     */
    function setAiAgent(address _aiAgent) external onlyOwner {
        aiAgent = _aiAgent;
    }

    /**
     * @dev Check and stake for a match. Requires a signature from the AI Agent.
     */
    function stakeForMessage(
        address recipient,
        uint256 matchScore,
        bytes calldata signature
    ) external {
        // Verify AI Agent signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, recipient, matchScore)
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ethSignedMessageHash.recover(signature);
        require(signer == aiAgent, "Invalid AI Agent signature");
        require(matchScore >= 80, "Match score too low for staking");

        // Stake rUSD
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
     * @dev Recipient claims the stake by replying (abstracted as a function call).
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
     * @dev Slashing logic for harassment, triggered by AI Agent (Oracle).
     */
    function slashStake(address sender, address recipient) external {
        require(msg.sender == aiAgent, "Only AI Agent can slash");

        bytes32 matchId = keccak256(abi.encodePacked(sender, recipient));
        MessageRequest storage req = matches[matchId];

        require(req.active, "No active stake to slash");

        req.active = false;
        // In a real scenario, slashed funds might go to a treasury or the victim.
        require(rUSD.transfer(owner(), req.stake), "Slash transfer failed");

        emit StakeSlashed(sender, msg.sender, req.stake);
    }
}
