const { expect } = require("chai");
const hre = require("hardhat");

describe("Token42Profile", function () {
    let profile;
    let owner, user1;

    beforeEach(async function () {
        [owner, user1] = await hre.ethers.getSigners();
        const ProfileFactory = await hre.ethers.getContractFactory("Token42Profile");
        profile = await ProfileFactory.deploy();
        await profile.waitForDeployment();
    });

    it("should set the deployer as owner", async function () {
        expect(await profile.owner()).to.equal(owner.address);
    });

    it("should have the correct name and symbol", async function () {
        expect(await profile.name()).to.equal("Token42 Profile");
        expect(await profile.symbol()).to.equal("T42P");
    });

    it("should revert transferFrom (soulbound)", async function () {
        await expect(
            profile.transferFrom(owner.address, user1.address, 0)
        ).to.be.revertedWith("SBT: Profiles are non-transferable");
    });

    it("should report no profile initially", async function () {
        expect(await profile.hasProfile(user1.address)).to.equal(false);
    });
});
