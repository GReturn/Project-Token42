// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @dev Interface for the Polkadot Identity Precompile (0x...901)
 *      The `is_verified` call checks if an account has a valid identity
 *      on the People Chain with a judgment of 'Reasonable' or 'KnownGood'.
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
        uint256 id;   // id == 0 means no profile (saves a storage slot)
        string cid;
    }

    uint256 private _nextTokenId;
    mapping(address => Profile) private _profiles;
    mapping(uint256 => address) private _owners;
    mapping(address => bool) public isAdmin;

    address public owner;

    IIdentity public immutable IDENTITY_PRECOMPILE;

    // --- Custom Errors ---
    error NotOwner();
    error NotAdmin();
    error NotVerified();
    error PrecompileFailed();
    error ProfileAlreadyExists();
    error NoProfileFound();
    error EmptyCID();
    error InvalidAddress();
    error AlreadyAdmin();
    error NotAnAdmin();
    error CannotRemoveOwner();
    error TokenDoesNotExist();
    error NonTransferable();
    error ApprovalsDisabled();
    error CannotRevokeSelf();

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
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAdmin() {
        if (!isAdmin[msg.sender] && msg.sender != owner) revert NotAdmin();
        _;
    }

    modifier onlyVerified() {
        try IDENTITY_PRECOMPILE.is_verified(msg.sender) returns (bool verified) {
            if (!verified) revert NotVerified();
        } catch {
            revert PrecompileFailed();
        }
        _;
    }

    constructor(address _identityPrecompile) {
        if (_identityPrecompile == address(0)) revert InvalidAddress();
        IDENTITY_PRECOMPILE = IIdentity(_identityPrecompile);
        owner = msg.sender;
        isAdmin[msg.sender] = true;
        _nextTokenId = 1; // Start at 1 to avoid ambiguity with legacy indexers
    }

    // --- ERC-721 Standard Read Functions ---

    function balanceOf(address account) public view returns (uint256) {
        return _profiles[account].id != 0 ? 1 : 0;
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
        return tokenOwner;
    }

    function hasProfile(address user) public view returns (bool) {
        return _profiles[user].id != 0;
    }

    /**
     * @dev Standard metadata URI.
     */
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
        return string(abi.encodePacked("ipfs://", _profiles[tokenOwner].cid));
    }

    // --- Core Logic ---

    /**
     * @dev Mint a new soulbound profile.
     */
    function mintProfile(string memory cid) public onlyVerified {
        if (_profiles[msg.sender].id != 0) revert ProfileAlreadyExists();
        if (bytes(cid).length == 0) revert EmptyCID();

        uint256 tokenId = _nextTokenId++;
        
        _profiles[msg.sender] = Profile({
            id: tokenId,
            cid: cid
        });
        _owners[tokenId] = msg.sender;

        emit Transfer(address(0), msg.sender, tokenId);
        emit ProfileMinted(msg.sender, tokenId, cid);
    }

    /**
     * @dev Update profile metadata.
     */
    function updateProfile(string memory newCid) public onlyVerified {
        Profile storage profile = _profiles[msg.sender];
        if (profile.id == 0) revert NoProfileFound();
        if (bytes(newCid).length == 0) revert EmptyCID();

        profile.cid = newCid;
        emit ProfileUpdated(msg.sender, newCid);
    }

    /**
     * @dev User-driven removal (Right to be Forgotten).
     */
    function burn() public {
        if (_profiles[msg.sender].id == 0) revert NoProfileFound();
        _removeProfile(msg.sender);
    }

    /**
     * @dev Admin-driven removal (Identity Revocation).
     */
    function revoke(address user) public onlyAdmin {
        if (user == owner) revert CannotRevokeSelf();
        if (_profiles[user].id == 0) revert NoProfileFound();
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
        Profile storage profile = _profiles[user];
        if (profile.id == 0) revert NoProfileFound();
        return profile.cid;
    }

    // --- Governance ---

    function addAdmin(address account) public onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (isAdmin[account]) revert AlreadyAdmin();
        isAdmin[account] = true;
        emit AdminAdded(account);
    }

    function removeAdmin(address account) public onlyOwner {
        if (account == owner) revert CannotRemoveOwner();
        if (!isAdmin[account]) revert NotAnAdmin();
        isAdmin[account] = false;
        emit AdminRemoved(account);
    }

    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        isAdmin[owner] = false; // Revoke admin from old owner
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        isAdmin[newOwner] = true; // Auto-admin new owner
    }


    // --- ERC-721 Soulbound Blockers ---

    function transferFrom(address, address, uint256) public pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure {
        revert NonTransferable();
    }

    function approve(address, uint256) public pure {
        revert ApprovalsDisabled();
    }

    function setApprovalForAll(address, bool) public pure {
        revert ApprovalsDisabled();
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
            interfaceId == 0x5b5e139f;   // ERC-721 Metadata
            // interfaceId == 0x80ac58cd; // Removed full ERC-721 support as it is an SBT
    }
}
