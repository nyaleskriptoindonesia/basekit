// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/* ---------------------------------------------------------------------- */
/*  BaseKitToken Interface                                                   */
/* ---------------------------------------------------------------------- */
interface IBaseKitToken {
    function initialize(
        string calldata name,
        string calldata symbol,
        uint256 totalSupply,
        uint256 startMc,
        uint256 endMc,
        uint256 creatorFeeBps,
        address creator
    ) external;
}

/* ---------------------------------------------------------------------- */
/*  BaseKitRegistry                                                          */
/* ---------------------------------------------------------------------- */

/**
 * @title BaseKitRegistry
 * @notice Platform registry + fee collector for BaseKit launchpad.
 *         Creators deploy tokens via clone factory, paying 0.5 ETH creation fee.
 *         0.5% platform fee on every buy/sell accumulates here.
 *         Platform owner withdraws fees.
 */
contract BaseKitRegistry {

    /* ------------------------------------------------------------------ */
    /*  Constants                                                            */
    /* ------------------------------------------------------------------ */
    uint256 public constant PLATFORM_FEE_BPS = 50;   // 0.5%
    uint256 public constant CREATION_FEE       = 0.5 ether;

    /* ------------------------------------------------------------------ */
    /*  State                                                                 */
    /* ------------------------------------------------------------------ */
    address public owner;
    address public tokenMaster;  // deployed BaseKitToken (master copy)
    bool    public paused;

    address[] public allTokens;
    mapping(address => bool) public isToken;

    // Fee accounting: token -> creator -> ETH balance
    mapping(address => mapping(address => uint256)) public creatorBalances;

    // Platform ETH balance (0.5% on buy/sell)
    uint256 public platformBalance;

    /* ------------------------------------------------------------------ */
    /*  Events                                                                 */
    /* ------------------------------------------------------------------ */
    event TokenCreated(address indexed token, address indexed creator, string name, string symbol);
    event CreatorFeeAccrued(address indexed token, address indexed creator, uint256 amount);
    event PlatformFeeReceived(address indexed token, uint256 amount);
    event CreatorWithdrew(address indexed token, address indexed creator, uint256 amount);
    event PlatformWithdrew(address indexed recipient, uint256 amount);
    event TokenMasterSet(address indexed master);

    /* ------------------------------------------------------------------ */
    /*  Errors                                                                */
    /* ------------------------------------------------------------------ */
    error Unauthorized();
    error Paused();
    error ZeroAmount();
    error InsufficientBalance();

    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier whenNotPaused() { if (paused) revert Paused(); _; }

    /* ------------------------------------------------------------------ */
    /*  Constructor                                                           */
    /* ------------------------------------------------------------------ */
    constructor(address _owner) { owner = _owner; }

    /* ------------------------------------------------------------------ */
    /*  Owner                                                                 */
    /* ------------------------------------------------------------------ */
    function setTokenMaster(address _master) external onlyOwner {
        tokenMaster = _master;
        emit TokenMasterSet(_master);
    }

    function pause() external onlyOwner    { paused = true; }
    function unpause() external onlyOwner  { paused = false; }

    function withdrawPlatform(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (platformBalance < amount) revert InsufficientBalance();
        platformBalance -= amount;
        payable(owner).transfer(amount);
        emit PlatformWithdrew(owner, amount);
    }

    /* ------------------------------------------------------------------ */
    /*  Token Creation                                                        */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Create a new BaseKit token via minimal proxy clone.
     *         Caller pays CREATION_FEE (0.5 ETH).
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 totalSupply,
        uint256 startMc,    // ETH wei
        uint256 endMc,      // ETH wei
        uint256 creatorFeeBps // bps 0-1000
    ) external payable whenNotPaused returns (address token) {
        if (msg.value < CREATION_FEE) revert ZeroAmount();
        if (tokenMaster == address(0)) revert Unauthorized();

        token = _clone(tokenMaster);
        IBaseKitToken(token).initialize(
            name, symbol, totalSupply, startMc, endMc, creatorFeeBps, msg.sender
        );

        isToken[token] = true;
        allTokens.push(token);

        if (msg.value > CREATION_FEE) {
            payable(msg.sender).transfer(msg.value - CREATION_FEE);
        }

        emit TokenCreated(token, msg.sender, name, symbol);
    }

    /* ------------------------------------------------------------------ */
    /*  Fee Accounting (called by tokens on buy/sell)                        */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Called by token on every buy. Records creator + platform fees.
     */
    function notifyFee(
        address creator,
        uint256 creatorFee,
        uint256 platformFee
    ) external {
        if (!isToken[msg.sender]) revert Unauthorized();
        if (creatorFee > 0) creatorBalances[msg.sender][creator] += creatorFee;
        if (platformFee > 0) platformBalance += platformFee;
        if (creatorFee > 0) emit CreatorFeeAccrued(msg.sender, creator, creatorFee);
        if (platformFee > 0) emit PlatformFeeReceived(msg.sender, platformFee);
    }

    /* ------------------------------------------------------------------ */
    /*  Views                                                                 */
    /* ------------------------------------------------------------------ */
    function getTokenCount() external view returns (uint256) { return allTokens.length; }

    function getAllTokens() external view returns (address[] memory) { return allTokens; }

    /* ------------------------------------------------------------------ */
    /*  Minimal Proxy Clone                                                   */
    /* ------------------------------------------------------------------ */
    function _clone(address target) internal returns (address instance) {
        bytes20 targetBytes = bytes20(target);
        assembly {
            let mem := mload(0x40)
            mstore(mem, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73)
            mstore(add(mem, 0x14), targetBytes)
            mstore(add(mem, 0x28), 0x5af43d82803e903d91602b57fd5bf3)
            instance := create(0, mem, 0x37)
        }
    }
}
