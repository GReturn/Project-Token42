// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockIdentityPrecompile
 * @dev Simulates the Polkadot Identity Precompile (0x...901) for environments
 *      where the real precompile is not available.
 */
contract MockIdentityPrecompile {
    /**
     * @dev Simple verification mock. Returns true for any account.
     *      In a real scenario, this would check if the account has a 'Reasonable'
     *      or 'KnownGood' judgment on the People Chain.
     */
    function is_verified(address account) external pure returns (bool) {
        // For hackathon/demo purposes, we verify everyone.
        return account != address(0);
    }
}
