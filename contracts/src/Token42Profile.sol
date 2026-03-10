// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IIdentity
 * @dev Interface for the Polkadot Identity Precompile (0x...901)
 */
interface IIdentity {
    /**
     * @dev Checks if an account has been verified as a real human.
     * @param account The address to check.
     * @return True if verified, false otherwise.
     */
    function is_verified(address account) external view returns (bool);
}

/**
 * @title Token42Profile
 * @dev Soulbound Token (SBT) for Token42 user profiles.
 * Requires verification from the Polkadot Identity Precompile.
 */
contract Token42Profile is ERC721, Ownable {
    IIdentity public constant IDENTITY_PRECOMPILE =
        IIdentity(address(0x0000000000000000000000000000000000000901));

    uint256 private _nextTokenId;
    mapping(uint256 => string) private _tokenCIDs;
    mapping(address => uint256) private _userTokenId;
    mapping(address => bool) private _hasProfile;

    event ProfileMinted(
        address indexed user,
        uint256 indexed tokenId,
        string cid
    );

    constructor() ERC721("Token42 Profile", "T42P") Ownable(msg.sender) {}

    /**
     * @dev Mint a new profile. User must be verified by the Identity Precompile.
     * @param cid The IPFS CID for the user's profile metadata.
     */
    function mintProfile(string memory cid) public {
        require(!_hasProfile[msg.sender], "Profile already exists");

        // Polkadot Identity Precompile check
        // In a test environment without the precompile, this will fail unless mocked.
        try IDENTITY_PRECOMPILE.is_verified(msg.sender) returns (
            bool verified
        ) {
            require(verified, "User not verified as human");
        } catch {
            // Fallback for environments where the precompile doesn't exist (like local testing)
            // In production, this should revert.
            // For hackathon completeness, we might allow it if we're in a specific test mode.
            revert("Identity Precompile not found or failed");
        }
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _tokenCIDs[tokenId] = cid;
        _userTokenId[msg.sender] = tokenId;
        _hasProfile[msg.sender] = true;

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
     * @dev Overriding transfer to make it Soulbound (non-transferable).
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("SBT: Profiles are non-transferable");
        }
        return super._update(to, tokenId, auth);
    }
}
