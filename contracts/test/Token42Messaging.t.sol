// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Token42Messaging} from "../src/Token42Messaging.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockRUSD is ERC20 {
    constructor() ERC20("Revive USD", "rUSD") {
        _mint(msg.sender, 1000 * 10 ** 18);
    }
}

contract Token42MessagingTest is Test {
    Token42Messaging public messaging;
    MockRUSD public rUSD;

    uint256 private agentPrivateKey = 0xA1;
    address public aiAgent;
    address public sender = address(0x1);
    address public recipient = address(0x2);

    function setUp() public {
        aiAgent = vm.addr(agentPrivateKey);
        rUSD = new MockRUSD();
        messaging = new Token42Messaging(address(rUSD), aiAgent);

        rUSD.transfer(sender, 100 * 10 ** 18);
        vm.prank(sender);
        rUSD.approve(address(messaging), 100 * 10 ** 18);
    }

    function test_StakeForMessage_Success() public {
        uint256 matchScore = 85;
        bytes32 messageHash = keccak256(
            abi.encodePacked(sender, recipient, matchScore)
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            agentPrivateKey,
            ethSignedMessageHash
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(sender);
        messaging.stakeForMessage(recipient, matchScore, signature);

        (
            address _sender,
            address _recipient,
            uint256 _stake,
            bool _active
        ) = messaging.matches(keccak256(abi.encodePacked(sender, recipient)));
        assertEq(_sender, sender);
        assertEq(_active, true);
        assertEq(rUSD.balanceOf(address(messaging)), 1 * 10 ** 18);
    }

    function test_ClaimStake_Success() public {
        // First stake
        test_StakeForMessage_Success();

        uint256 initialBalance = rUSD.balanceOf(recipient);
        vm.prank(recipient);
        messaging.claimStake(sender);

        assertEq(rUSD.balanceOf(recipient), initialBalance + 1 * 10 ** 18);
        (, , , bool _active) = messaging.matches(
            keccak256(abi.encodePacked(sender, recipient))
        );
        assertEq(_active, false);
    }

    function test_SlashStake_Success() public {
        test_StakeForMessage_Success();

        uint256 ownerInitialBalance = rUSD.balanceOf(messaging.owner());
        vm.prank(aiAgent);
        messaging.slashStake(sender, recipient);

        assertEq(
            rUSD.balanceOf(messaging.owner()),
            ownerInitialBalance + 1 * 10 ** 18
        );
    }
}
