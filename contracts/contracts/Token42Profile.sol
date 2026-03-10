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
 *      Minimal ERC-721 implementation — no OpenZeppelin.
 *      Keeps bytecode under PolkaVM's 100KB limit.
 *
 * Key features:
 *   - One profile per verified human (Identity Precompile check)
 *   - Non-transferable (soulbound)
 *   - IPFS CID storage for profile metadata
 */
contract Token42Profile {
    // --- ERC-721 Storage ---
    string public name = "Token42 Profile";
    string public symbol = "T42P";

    uint256 private _nextTokenId;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => string) private _tokenCIDs;
    mapping(address => uint256) private _userTokenId;
    mapping(address => bool) private _hasProfile;

    address public owner;

    IIdentity public constant IDENTITY_PRECOMPILE =
        IIdentity(address(0x0000000000000000000000000000000000000901));

    // --- Events ---
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );
    event ProfileMinted(
        address indexed user,
        uint256 indexed tokenId,
        string cid
    );

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // --- ERC-721 Read Functions ---

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Token does not exist");
        return tokenOwner;
    }

    function hasProfile(address user) public view returns (bool) {
        return _hasProfile[user];
    }

    // --- Core Logic ---

    /**
     * @dev Mint a new soulbound profile.
     *      User must be verified by the Identity Precompile.
     * @param cid IPFS CID for profile metadata.
     */
    function mintProfile(string memory cid) public {
        require(!_hasProfile[msg.sender], "Profile already exists");

        // Polkadot Identity Precompile check
        try IDENTITY_PRECOMPILE.is_verified(msg.sender) returns (
            bool verified
        ) {
            require(verified, "User not verified as human");
        } catch {
            revert("Identity Precompile not found or failed");
        }
        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] = 1;
        _tokenCIDs[tokenId] = cid;
        _userTokenId[msg.sender] = tokenId;
        _hasProfile[msg.sender] = true;

        emit Transfer(address(0), msg.sender, tokenId);
        emit ProfileMinted(msg.sender, tokenId, cid);
    }

    /**
     * @dev Get the profile CID for a user.
     */
    function getProfileCID(address user) public view returns (string memory) {
        require(_hasProfile[user], "User has no profile");
        return _tokenCIDs[_userTokenId[user]];
    }

    /**
     * @dev Soulbound: transfers are disabled.
     */
    function transferFrom(address, address, uint256) public pure {
        revert("SBT: Profiles are non-transferable");
    }
}
