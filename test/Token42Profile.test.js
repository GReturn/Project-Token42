const { expect } = require("chai");
const hre = require("hardhat");

describe("Token42Profile", function () {
    let profile;
    let owner, user1, user2;
    const mockCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

    beforeEach(async function () {
        [owner, user1, user2] = await hre.ethers.getSigners();
        const ProfileFactory = await hre.ethers.getContractFactory("Token42Profile");
        profile = await ProfileFactory.deploy();
        await profile.waitForDeployment();

        // Standard precompile mock for all tests
        const mockBytecode = "0x600160005260206000f3"; 
        await hre.network.provider.send("hardhat_setCode", [
            "0x0000000000000000000000000000000000000901",
            mockBytecode,
        ]);
    });

    describe("Metadata & Compliance", function () {
        it("should have correct name and symbol", async function () {
            expect(await profile.name()).to.equal("Token42 Profile");
            expect(await profile.symbol()).to.equal("T42P");
        });

        it("should support ERC-165 and Metadata interfaces but not full ERC-721", async function () {
            expect(await profile.supportsInterface("0x80ac58cd")).to.equal(false); // ERC-721 (Removed)
            expect(await profile.supportsInterface("0x5b5e139f")).to.equal(true);  // Metadata
            expect(await profile.supportsInterface("0x01ffc9a7")).to.equal(true);  // ERC-165
        });
    });

    describe("Minting & Identity", function () {
        it("should allow minting and return correct tokenURI", async function () {
            await profile.connect(user1).mintProfile(mockCID);
            expect(await profile.hasProfile(user1.address)).to.equal(true);
            expect(await profile.tokenURI(1)).to.equal("ipfs://" + mockCID);
        });

        it("should allow updating profile", async function () {
            await profile.connect(user1).mintProfile(mockCID);
            const newCID = "QmNewCID...";
            await profile.connect(user1).updateProfile(newCID);
            expect(await profile.getProfileCID(user1.address)).to.equal(newCID);
        });

        it("should fail if minting twice", async function () {
            await profile.connect(user1).mintProfile(mockCID);
            await expect(profile.connect(user1).mintProfile(mockCID))
                .to.be.revertedWithCustomError(profile, "ProfileAlreadyExists");
        });
    });

    describe("Soulbound Properties", function () {
        it("should revert on transferFrom", async function () {
            await expect(profile.transferFrom(owner.address, user1.address, 1))
                .to.be.revertedWithCustomError(profile, "NonTransferable");
        });

        it("should revert on approve", async function () {
            await expect(profile.approve(user1.address, 1))
                .to.be.revertedWithCustomError(profile, "ApprovalsDisabled");
        });

        it("should revert on safeTransferFrom", async function () {
            await expect(profile["safeTransferFrom(address,address,uint256)"](owner.address, user1.address, 1))
                .to.be.revertedWithCustomError(profile, "NonTransferable");
        });
    });

    describe("Ownership & Administration", function () {
        it("should allow owner to add an admin", async function () {
            await profile.addAdmin(user1.address);
            expect(await profile.isAdmin(user1.address)).to.equal(true);
        });

        it("should fail if adding an already admin", async function () {
            await profile.addAdmin(user1.address);
            await expect(profile.addAdmin(user1.address))
                .to.be.revertedWithCustomError(profile, "AlreadyAdmin");
        });

        it("should allow added admin to call revoke", async function () {
            await profile.addAdmin(user1.address);
            await profile.connect(user2).mintProfile(mockCID);
            await expect(profile.connect(user1).revoke(user2.address))
                .to.emit(profile, "ProfileRevoked");
        });

        it("should allow owner to remove an admin", async function () {
            await profile.addAdmin(user1.address);
            await profile.removeAdmin(user1.address);
            expect(await profile.isAdmin(user1.address)).to.equal(false);
        });

        it("should fail if removing non-admin", async function () {
            await expect(profile.removeAdmin(user1.address))
                .to.be.revertedWithCustomError(profile, "NotAnAdmin");
        });

        it("should prevent non-owners from adding admins", async function () {
            await expect(profile.connect(user1).addAdmin(user2.address))
                .to.be.revertedWithCustomError(profile, "NotOwner");
        });

        it("should prevent non-admins from revoking", async function () {
            await expect(profile.connect(user2).revoke(user1.address))
                .to.be.revertedWithCustomError(profile, "NotAdmin");
        });

        it("should prevent owner from revoking self", async function () {
            await expect(profile.revoke(owner.address))
                .to.be.revertedWithCustomError(profile, "CannotRevokeSelf");
        });

        it("should allow ownership transfer and update admin status", async function () {
            await profile.transferOwnership(user1.address);
            expect(await profile.owner()).to.equal(user1.address);
            expect(await profile.isAdmin(user1.address)).to.equal(true);
            expect(await profile.isAdmin(owner.address)).to.equal(false); // Check old owner
        });
    });
});
