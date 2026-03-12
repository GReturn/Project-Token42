// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IIdentity
 * @dev Interface for the Polkadot Identity Precompile (0x...901)
 */
interface IIdentity {
    function is_verified(address account) external view returns (bool);
}

/**
 * @title Token42Profile
 * @dev Soulbound profile token for Token42.
 *      Optimized for PolkaVM and gas efficiency.
 */
contract Token42Profile {
    // --- ERC-721 Metadata ---
    string public constant name = "Token42 Profile";
    string public constant symbol = "T42P";

    // --- Storage Optimization: Profile Struct ---
    struct Profile {
        uint256 id;
        string cid;
        bool active;
    }

    uint256 private _nextTokenId;
    mapping(address => Profile) private _profiles;
    mapping(uint256 => address) private _owners;
    mapping(address => bool) public isAdmin;

    address public owner;

    IIdentity public constant IDENTITY_PRECOMPILE =
        IIdentity(address(0x0000000000000000000000000000000000000901));

    // --- Events ---
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event ProfileMinted(address indexed user, uint256 indexed tokenId, string cid);
    event ProfileUpdated(address indexed user, string newCid);
    event ProfileRevoked(address indexed user, uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AdminAdded(address indexed account);
    event AdminRemoved(address indexed account);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] || msg.sender == owner, "Not admin");
        _;
    }

    modifier onlyVerified() {
        try IDENTITY_PRECOMPILE.is_verified(msg.sender) returns (bool verified) {
            require(verified, "User not verified as human");
        } catch {
            revert("Identity Precompile failed");
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        isAdmin[msg.sender] = true;
    }

    // --- ERC-721 Standard Read Functions ---

    function balanceOf(address account) public view returns (uint256) {
        return _profiles[account].active ? 1 : 0;
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }

    function hasProfile(address user) public view returns (bool) {
        return _profiles[user].active;
    }

    /**
     * @dev Standard metadata URI.
     */
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return string(abi.encodePacked("ipfs://", _profiles[tokenOwner].cid));
    }

    // --- Core Logic ---

    /**
     * @dev Mint a new soulbound profile.
     */
    function mintProfile(string memory cid) public onlyVerified {
        require(!_profiles[msg.sender].active, "Profile already exists");
        require(bytes(cid).length > 0, "Empty CID");

        uint256 tokenId = _nextTokenId++;
        
        _profiles[msg.sender] = Profile({
            id: tokenId,
            cid: cid,
            active: true
        });
        _owners[tokenId] = msg.sender;

        emit Transfer(address(0), msg.sender, tokenId);
        emit ProfileMinted(msg.sender, tokenId, cid);
    }

    /**
     * @dev Update profile metadata.
     */
    function updateProfile(string memory newCid) public onlyVerified {
        require(_profiles[msg.sender].active, "No profile found");
        require(bytes(newCid).length > 0, "Empty CID");

        _profiles[msg.sender].cid = newCid;
        emit ProfileUpdated(msg.sender, newCid);
    }

    /**
     * @dev User-driven removal (Right to be Forgotten).
     */
    function burn() public {
        require(_profiles[msg.sender].active, "No profile found");
        _removeProfile(msg.sender);
    }

    /**
     * @dev Admin-driven removal (Identity Revocation).
     */
    function revoke(address user) public onlyAdmin {
        require(_profiles[user].active, "User has no active profile");
        _removeProfile(user);
    }

    function _removeProfile(address user) internal {
        uint256 tokenId = _profiles[user].id;
        delete _owners[tokenId];
        delete _profiles[user];
        emit Transfer(user, address(0), tokenId);
        emit ProfileRevoked(user, tokenId);
    }

    /**
     * @dev Get the profile CID for a user (Legacy compat).
     */
    function getProfileCID(address user) public view returns (string memory) {
        require(_profiles[user].active, "User has no profile");
        return _profiles[user].cid;
    }

    // --- Governance ---

    function addAdmin(address account) public onlyOwner {
        require(account != address(0), "Zero address");
        isAdmin[account] = true;
        emit AdminAdded(account);
    }

    function removeAdmin(address account) public onlyOwner {
        require(account != owner, "Cannot remove owner");
        isAdmin[account] = false;
        emit AdminRemoved(account);
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        isAdmin[newOwner] = true; // Auto-admin new owner
    }


    // --- ERC-721 Soulbound Blockers ---

    function transferFrom(address, address, uint256) public pure {
        revert("SBT: Non-transferable");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("SBT: Non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure {
        revert("SBT: Non-transferable");
    }

    function approve(address, uint256) public pure {
        revert("SBT: Approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure {
        revert("SBT: Approvals disabled");
    }

    function getApproved(uint256) public pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) public pure returns (bool) {
        return false;
    }

    // --- ERC-165 Support ---

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721
            interfaceId == 0x5b5e139f;   // ERC-721 Metadata
    }
}
