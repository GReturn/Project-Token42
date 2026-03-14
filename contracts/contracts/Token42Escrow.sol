// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IToken42Profile {
    function hasProfile(address user) external view returns (bool);
}

/**
 * @title Token42Escrow
 * @dev "Proof of Real Life" (PoRL) date escrow and verification system.
 */
contract Token42Escrow {
    IERC20 public immutable rUSD;
    IToken42Profile public immutable profileContract;
    address public owner;

    uint256 public escrowAmount = 10 * 10 ** 18; // 10 rUSD
    uint256 public dateWindow = 24 hours;
    uint256 public treasuryFeeBps = 500; // 5% for success
    uint256 public penaltyFeeBps = 2000; // 20% for no-shows

    enum EscrowStatus { None, Proposed, Active, Resolved, Slashed, Cancelled }

    struct DateEscrow {
        address userA;
        address userB;
        uint256 startTime;
        uint256 amountA;
        uint256 amountB;
        bool proofA; // Has User A submitted User B's signature?
        bool proofB; // Has User B submitted User A's signature?
        EscrowStatus status;
    }

    mapping(bytes32 => DateEscrow) public dates;

    // --- Custom Errors ---
    error NotOwner();
    error NotInDate();
    error InvalidStatus();
    error WindowNotExpired();
    error WindowExpired();
    error TransferFailed();
    error MissingProfile();
    error InvalidAddress();
    error InvalidSignature();

    // --- Events ---
    event DateProposed(bytes32 indexed dateId, address indexed proposer, address indexed recipient);
    event DateAccepted(bytes32 indexed dateId, address indexed recipient);
    event ProofSubmitted(bytes32 indexed dateId, address indexed submitter);
    event DateResolved(bytes32 indexed dateId, EscrowStatus status, uint256 treasuryAmount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _rUSD, address _profileContract) {
        if (_rUSD == address(0) || _profileContract == address(0)) revert InvalidAddress();
        rUSD = IERC20(_rUSD);
        profileContract = IToken42Profile(_profileContract);
        owner = msg.sender;
    }

    /**
     * @dev Propose a date to another user.
     */
    function proposeDate(address recipient) external {
        if (!profileContract.hasProfile(msg.sender)) revert MissingProfile();
        if (!profileContract.hasProfile(recipient)) revert MissingProfile();
        
        bytes32 dateId = _getDateId(msg.sender, recipient);
        if (dates[dateId].status != EscrowStatus.None && dates[dateId].status != EscrowStatus.Resolved && dates[dateId].status != EscrowStatus.Cancelled) {
            revert InvalidStatus();
        }

        if (!rUSD.transferFrom(msg.sender, address(this), escrowAmount)) revert TransferFailed();

        dates[dateId] = DateEscrow({
            userA: msg.sender,
            userB: recipient,
            startTime: 0,
            amountA: escrowAmount,
            amountB: 0,
            proofA: false,
            proofB: false,
            status: EscrowStatus.Proposed
        });

        emit DateProposed(dateId, msg.sender, recipient);
    }

    /**
     * @dev Recipient accepts the date and stakes.
     */
    function acceptDate(address proposer) external {
        bytes32 dateId = _getDateId(proposer, msg.sender);
        DateEscrow storage date = dates[dateId];
        
        if (date.status != EscrowStatus.Proposed) revert InvalidStatus();
        if (date.userB != msg.sender) revert NotInDate();

        if (!rUSD.transferFrom(msg.sender, address(this), escrowAmount)) revert TransferFailed();

        date.amountB = escrowAmount;
        date.startTime = block.timestamp;
        date.status = EscrowStatus.Active;

        emit DateAccepted(dateId, msg.sender);
    }

    /**
     * @dev Submit proof of meeting (the other user's signature).
     */
    function submitProof(address partner, bytes calldata signature) external {
        bytes32 dateId = _getDateId(msg.sender, partner);
        DateEscrow storage date = dates[dateId];
        
        if (date.status != EscrowStatus.Active) revert InvalidStatus();
        if (block.timestamp > date.startTime + dateWindow) revert WindowExpired();

        // Verify that 'partner' signed the dateId
        bytes32 messageHash = keccak256(abi.encodePacked(dateId, msg.sender));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        address signer = _recover(ethSignedHash, signature);
        if (signer != partner) revert InvalidSignature();

        if (msg.sender == date.userA) {
            date.proofA = true;
        } else {
            date.proofB = true;
        }

        emit ProofSubmitted(dateId, msg.sender);

        // If both submitted, resolve immediately
        if (date.proofA && date.proofB) {
            _resolveSuccess(dateId);
        }
    }

    /**
     * @dev Resolve the escrow after the window expires if not already resolved.
     */
    function resolveExpired(address partner) external {
        bytes32 dateId = _getDateId(msg.sender, partner);
        DateEscrow storage date = dates[dateId];
        
        if (date.status != EscrowStatus.Active) revert InvalidStatus();
        if (block.timestamp <= date.startTime + dateWindow) revert WindowNotExpired();

        if (date.proofA && !date.proofB) {
            // User B flaked
            _resolveSlashed(dateId, date.userA, date.userB);
        } else if (date.proofB && !date.proofA) {
            // User A flaked
            _resolveSlashed(dateId, date.userB, date.userA);
        } else {
            // Neither or Both (Both handled in submitProof, but just in case of race)
            _resolveCancelled(dateId);
        }
    }

    function _resolveSuccess(bytes32 dateId) internal {
        DateEscrow storage date = dates[dateId];
        date.status = EscrowStatus.Resolved;

        uint256 totalPool = date.amountA + date.amountB;
        uint256 fee = (totalPool * treasuryFeeBps) / 10000;
        uint256 returnAmount = (totalPool - fee) / 2;

        rUSD.transfer(owner, fee);
        rUSD.transfer(date.userA, returnAmount);
        rUSD.transfer(date.userB, returnAmount);

        emit DateResolved(dateId, EscrowStatus.Resolved, fee);
    }

    function _resolveSlashed(bytes32 dateId, address winner, address flaker) internal {
        DateEscrow storage date = dates[dateId];
        date.status = EscrowStatus.Slashed;

        uint256 flakerStake = (flaker == date.userA) ? date.amountA : date.amountB;
        uint256 winnerStake = (winner == date.userA) ? date.amountA : date.amountB;
        
        uint256 penalty = (flakerStake * penaltyFeeBps) / 10000;
        uint256 toWinner = winnerStake + (flakerStake - penalty);

        rUSD.transfer(owner, penalty);
        rUSD.transfer(winner, toWinner);

        emit DateResolved(dateId, EscrowStatus.Slashed, penalty);
    }

    function _resolveCancelled(bytes32 dateId) internal {
        DateEscrow storage date = dates[dateId];
        date.status = EscrowStatus.Cancelled;

        rUSD.transfer(date.userA, date.amountA);
        rUSD.transfer(date.userB, date.amountB);

        emit DateResolved(dateId, EscrowStatus.Cancelled, 0);
    }

    function _getDateId(address u1, address u2) internal pure returns (bytes32) {
        return u1 < u2 ? keccak256(abi.encodePacked(u1, u2)) : keccak256(abi.encodePacked(u2, u1));
    }

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }
}
