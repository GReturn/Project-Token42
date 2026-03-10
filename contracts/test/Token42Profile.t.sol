// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Token42Profile} from "../src/Token42Profile.sol";

contract MockIdentity {
    mapping(address => bool) public verified;

    function setVerified(address account, bool status) external {
        verified[account] = status;
    }

    function is_verified(address account) external view returns (bool) {
        return verified[account];
    }
}

contract Token42ProfileTest is Test {
    Token42Profile public profile;
    MockIdentity public mockIdentity;
    address public user = address(0x123);

    function setUp() public {
        profile = new Token42Profile();
        mockIdentity = new MockIdentity();

        // Use etch to put the mock identity at the precompile address
        vm.etch(
            address(0x0000000000000000000000000000000000000901),
            address(mockIdentity).code
        );
    }

    function test_MintProfile_Success() public {
        // Set verification status at the precompile address
        MockIdentity(address(0x0000000000000000000000000000000000000901))
            .setVerified(user, true);

        vm.prank(user);
        profile.mintProfile("ipfs://QmProfile123");

        assertEq(profile.balanceOf(user), 1);
        assertEq(profile.getProfileCID(user), "ipfs://QmProfile123");
    }

    function test_RevertIf_NotVerified() public {
        // De-verify user
        MockIdentity(address(0x0000000000000000000000000000000000000901))
            .setVerified(user, false);

        vm.prank(user);
        vm.expectRevert("User not verified as human");
        profile.mintProfile("ipfs://QmProfile123");
    }

    function test_RevertIf_DoubleMint() public {
        MockIdentity(address(0x0000000000000000000000000000000000000901))
            .setVerified(user, true);

        vm.startPrank(user);
        profile.mintProfile("ipfs://QmProfile123");

        vm.expectRevert("Profile already exists");
        profile.mintProfile("ipfs://QmProfile456");
        vm.stopPrank();
    }

    function test_IsSoulbound() public {
        MockIdentity(address(0x0000000000000000000000000000000000000901))
            .setVerified(user, true);

        vm.prank(user);
        profile.mintProfile("ipfs://QmProfile123");

        vm.expectRevert("SBT: Profiles are non-transferable");
        vm.prank(user);
        profile.transferFrom(user, address(0x456), 0);
    }
}
