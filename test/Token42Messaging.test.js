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

    async function createSignature(senderAddr, recipientAddr, matchScore, nonce) {
        const messageHash = hre.ethers.solidityPackedKeccak256(
            ["address", "address", "uint256", "uint256"],
            [senderAddr, recipientAddr, matchScore, nonce]
        );
        return await aiAgent.signMessage(hre.ethers.getBytes(messageHash));
    }

    it("should stake for a message with valid AI signature and nonce", async function () {
        const nonce = await messaging.nonces(sender.address);
        const signature = await createSignature(sender.address, recipient.address, 85, nonce);

        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        const matchId = hre.ethers.solidityPackedKeccak256(
            ["address", "address"],
            [sender.address, recipient.address]
        );

        const match = await messaging.matches(matchId);
        expect(match.sender).to.equal(sender.address);
        expect(match.active).to.equal(true);
        expect(await messaging.nonces(sender.address)).to.equal(nonce + 1n);
    });

    it("should prevent signature replay", async function () {
        const nonce = await messaging.nonces(sender.address);
        const signature = await createSignature(sender.address, recipient.address, 85, nonce);

        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);
        
        // Attempt to reuse same signature
        await expect(
            messaging.connect(sender).stakeForMessage(recipient.address, 85, signature)
        ).to.be.revertedWithCustomError(messaging, "InvalidSignature");
    });

    it("should reject low match scores", async function () {
        const nonce = await messaging.nonces(sender.address);
        const signature = await createSignature(sender.address, recipient.address, 50, nonce);

        await expect(
            messaging.connect(sender).stakeForMessage(recipient.address, 50, signature)
        ).to.be.revertedWithCustomError(messaging, "ScoreTooLow");
    });

    it("should allow recipient to claim stake", async function () {
        const nonce = await messaging.nonces(sender.address);
        const signature = await createSignature(sender.address, recipient.address, 85, nonce);
        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        const initialBalance = await mockRUSD.balanceOf(recipient.address);
        await messaging.connect(recipient).claimStake(sender.address);

        expect(await mockRUSD.balanceOf(recipient.address)).to.equal(initialBalance + stakeAmount);
    });

    it("should allow any Admin to slash stake", async function () {
        const nonce = await messaging.nonces(sender.address);
        const signature = await createSignature(sender.address, recipient.address, 85, nonce);
        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        const ownerBalance = await mockRUSD.balanceOf(owner.address);
        // aiAgent is an admin by default from constructor
        await messaging.connect(aiAgent).slashStake(sender.address, recipient.address);

        expect(await mockRUSD.balanceOf(owner.address)).to.equal(ownerBalance + stakeAmount);
    });

    it("should reject slash from non-Admin", async function () {
        const nonce = await messaging.nonces(sender.address);
        const signature = await createSignature(sender.address, recipient.address, 85, nonce);
        await messaging.connect(sender).stakeForMessage(recipient.address, 85, signature);

        await expect(
            messaging.connect(sender).slashStake(sender.address, recipient.address)
        ).to.be.revertedWithCustomError(messaging, "NotAdmin");
    });

    it("should allow owner to add/remove admins", async function () {
        const [_, __, ___, ____, newAdmin] = await hre.ethers.getSigners();
        
        await messaging.addAdmin(newAdmin.address);
        expect(await messaging.isAdmin(newAdmin.address)).to.be.true;

        await messaging.removeAdmin(newAdmin.address);
        expect(await messaging.isAdmin(newAdmin.address)).to.be.false;
    });

    it("should allow admins to update parameters", async function () {
        const newStake = hre.ethers.parseEther("2");
        await messaging.connect(aiAgent).setStakeAmount(newStake);
        expect(await messaging.stakeAmount()).to.equal(newStake);

        await messaging.connect(aiAgent).setMinMatchScore(90);
        expect(await messaging.minMatchScore()).to.equal(90);
    });
});
