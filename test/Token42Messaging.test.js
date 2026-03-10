const { expect } = require("chai");
const hre = require("hardhat");

describe("Token42Messaging", function () {
    let messaging, mockRUSD;
    let owner, sender, recipient, aiAgent;
    const stakeAmount = hre.ethers.parseEther("1");

    beforeEach(async function () {
        [owner, sender, recipient, aiAgent] = await hre.ethers.getSigners();

        // Deploy a mock ERC-20 for rUSD
        const MockTokenFactory = await hre.ethers.getContractFactory("MockRUSD");
        mockRUSD = await MockTokenFactory.deploy();
        await mockRUSD.waitForDeployment();

        // Deploy Token42Messaging
        const MessagingFactory = await hre.ethers.getContractFactory("Token42Messaging");
        messaging = await MessagingFactory.deploy(
            await mockRUSD.getAddress(),
            aiAgent.address
        );
        await messaging.waitForDeployment();

        // Fund sender with rUSD and approve
        await mockRUSD.transfer(sender.address, hre.ethers.parseEther("100"));
        await mockRUSD
            .connect(sender)
            .approve(await messaging.getAddress(), hre.ethers.parseEther("100"));
    });

    async function createSignature(senderAddr, recipientAddr, matchScore) {
        const messageHash = hre.ethers.solidityPackedKeccak256(
            ["address", "address", "uint256"],
            [senderAddr, recipientAddr, matchScore]
        );
        return await aiAgent.signMessage(hre.ethers.getBytes(messageHash));
    }

    it("should stake for a message with valid AI signature", async function () {
        const signature = await createSignature(sender.address, recipient.address, 85);

        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        const matchId = hre.ethers.solidityPackedKeccak256(
            ["address", "address"],
            [sender.address, recipient.address]
        );

        const match = await messaging.matches(matchId);
        expect(match.sender).to.equal(sender.address);
        expect(match.active).to.equal(true);
        expect(await mockRUSD.balanceOf(await messaging.getAddress())).to.equal(stakeAmount);
    });

    it("should reject low match scores", async function () {
        const signature = await createSignature(sender.address, recipient.address, 50);

        await expect(
            messaging.connect(sender).stakeForMessage(recipient.address, 50, signature)
        ).to.be.revertedWith("Match score too low for staking");
    });

    it("should allow recipient to claim stake", async function () {
        const signature = await createSignature(sender.address, recipient.address, 85);
        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        const initialBalance = await mockRUSD.balanceOf(recipient.address);
        await messaging.connect(recipient).claimStake(sender.address);

        expect(await mockRUSD.balanceOf(recipient.address)).to.equal(initialBalance + stakeAmount);
    });

    it("should allow AI Agent to slash stake", async function () {
        const signature = await createSignature(sender.address, recipient.address, 85);
        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        const ownerBalance = await mockRUSD.balanceOf(owner.address);
        await messaging.connect(aiAgent).slashStake(sender.address, recipient.address);

        expect(await mockRUSD.balanceOf(owner.address)).to.equal(ownerBalance + stakeAmount);
    });

    it("should reject slash from non-AI Agent", async function () {
        const signature = await createSignature(sender.address, recipient.address, 85);
        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        await expect(
            messaging.connect(sender).slashStake(sender.address, recipient.address)
        ).to.be.revertedWith("Only AI Agent can slash");
    });
});
