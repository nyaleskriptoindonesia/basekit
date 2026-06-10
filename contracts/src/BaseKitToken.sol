// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title BaseKitToken
 * @notice ERC-20 token with linear bonding curve for fair-launch.
 *         Deployed via minimal proxy clone from BaseKitRegistry.
 *         Buy/sell directly from the curve — no DEX, no LP.
 *         Creator fee (0–10%) taken on every buy. Platform fee (0.5%) on buy/sell.
 */
contract BaseKitToken {

    /* ------------------------------------------------------------------ */
    /*  ERC-20 Basics                                                       */
    /* ------------------------------------------------------------------ */
    string public name;
    string public symbol;
    uint8  public decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /* ------------------------------------------------------------------ */
    /*  Bonding Curve State                                                  */
    /* ------------------------------------------------------------------ */
    uint256 public startMarketCap;   // wei ETH
    uint256 public endMarketCap;     // wei ETH
    uint256 public sold;             // tokens currently sold

    address public creator;
    uint256 public creatorFeeBps;   // bps (0–1000)
    uint256 public creatorWithdrawn;

    address public registry;         // BaseKitRegistry
    bool    public initialized;

    /* ------------------------------------------------------------------ */
    /*  Errors                                                              */
    /* ------------------------------------------------------------------ */
    error InsufficientBalance();
    error ZeroAmount();
    error SlippageExceeded();
    error AlreadyInitialized();
    error RegistryOnly();

    modifier onlyRegistry() {
        if (msg.sender != registry) revert RegistryOnly();
        _;
    }

    /* ------------------------------------------------------------------ */
    /*  Init (replaces constructor for clone pattern)                       */
    /* ------------------------------------------------------------------ */
    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        uint256 _startMarketCap,
        uint256 _endMarketCap,
        uint256 _creatorFeeBps,
        address _creator
    ) public {
        if (initialized) revert AlreadyInitialized();
        initialized = true;

        name            = _name;
        symbol          = _symbol;
        totalSupply     = _totalSupply;
        startMarketCap  = _startMarketCap;
        endMarketCap    = _endMarketCap;
        creatorFeeBps   = _creatorFeeBps;
        creator         = _creator;
        registry        = msg.sender; // factory/registry is deployer for clones

        // Mint entire supply to this contract
        balanceOf[address(this)] = _totalSupply;
        emit Transfer(address(0), address(this), _totalSupply);
    }

    /* ------------------------------------------------------------------ */
    /*  ERC-20                                                              */
    /* ------------------------------------------------------------------ */
    function _transfer(address from, address to, uint256 value) internal {
        if (balanceOf[from] < value) revert InsufficientBalance();
        unchecked { balanceOf[from] -= value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (balanceOf[from] < value) revert InsufficientBalance();
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /* ------------------------------------------------------------------ */
    /*  Bonding Curve Math                                                   */
    /* ------------------------------------------------------------------ */

    function getPrice() public view returns (uint256 pricePerToken) {
        if (sold >= totalSupply) {
            return endMarketCap * 1e18 / totalSupply;
        }
        uint256 slope = (endMarketCap - startMarketCap) * 1e18 / totalSupply;
        uint256 base  = startMarketCap * 1e18 / totalSupply;
        return base + (slope * sold) / totalSupply;
    }

    function getMarketCap() public view returns (uint256) {
        return getPrice() * totalSupply / 1e18;
    }

    /**
     * @notice Simulate buy of `amount` tokens — returns (cost, creatorFee, platformFee, total)
     */
    function simulateBuy(uint256 amount) public view returns (
        uint256 cost,
        uint256 creatorFee,
        uint256 platformFee,
        uint256 totalCharged
    ) {
        if (amount == 0) return (0, 0, 0, 0);
        uint256 p0    = startMarketCap * 1e18 / totalSupply;
        uint256 slope = (endMarketCap - startMarketCap) * 1e18 / totalSupply;
        uint256 s0    = sold;
        uint256 s1    = s0 + amount;

        // Cost = ∫(p0 + slope*t/totalSupply) dt from s0 to s1
        //      = amount*p0 + slope*amount*(s0+s1)/(2*totalSupply)
        cost = amount * p0
             + (slope * amount * (s0 + s1)) / (2 * totalSupply);

        uint256 pf = _platformFeeBps();
        creatorFee  = (cost * creatorFeeBps)  / 10000;
        platformFee = (cost * pf)              / 10000;
        totalCharged = cost + creatorFee + platformFee;
    }

    /**
     * @notice Simulate sell of `amount` tokens — returns (returnAmt, creatorFee, platformFee, netReturn)
     */
    function simulateSell(uint256 amount) public view returns (
        uint256 returnAmt,
        uint256 creatorFee,
        uint256 platformFee,
        uint256 netReturn
    ) {
        if (amount == 0) return (0, 0, 0, 0);
        uint256 p0    = startMarketCap * 1e18 / totalSupply;
        uint256 slope = (endMarketCap - startMarketCap) * 1e18 / totalSupply;
        uint256 s0    = sold;
        uint256 s1    = s0 - amount;

        // Return = ∫(p0 + slope*t/totalSupply) dt from s1 to s0
        //        = amount*p0 + slope*amount*(s0+s1)/(2*totalSupply)
        returnAmt = amount * p0
                  + (slope * amount * (s0 + s1)) / (2 * totalSupply);

        uint256 pf = _platformFeeBps();
        creatorFee  = (returnAmt * creatorFeeBps)  / 10000;
        platformFee = (returnAmt * pf)              / 10000;
        netReturn   = returnAmt - creatorFee - platformFee;
    }

    function _platformFeeBps() internal view returns (uint256) {
        return IRegistry(registry).PLATFORM_FEE_BPS();
    }

    /* ------------------------------------------------------------------ */
    /*  Buy / Sell                                                           */
    /* ------------------------------------------------------------------ */

    event Bought(address indexed buyer, uint256 amount, uint256 cost, uint256 creatorFee, uint256 platformFee);
    event Sold(address indexed seller, uint256 amount, uint256 returnAmt, uint256 creatorFee, uint256 platformFee);

    /**
     * @notice Buy tokens from bonding curve. Send ETH to cover cost + fees.
     *         msg.value must be >= totalCharged. Excess refunded.
     */
    function buy() external payable {
        (uint256 cost, uint256 cFee, uint256 pFee,) = simulateBuy(msg.value);
        if (cost == 0) revert ZeroAmount();

        // Binary search: find exact amount that fits in msg.value budget
        uint256 lo = 1;
        uint256 hi = totalSupply - sold;
        uint256 amount = hi;

        for (uint256 i = 0; i < 80; i++) {
            uint256 mid = (lo + hi) / 2;
            (uint256 c,,,) = simulateBuy(mid);
            if (c + (c * creatorFeeBps) / 10000 + (c * _platformFeeBps()) / 10000 <= msg.value) {
                amount = mid;
                lo = mid + 1;
            } else {
                hi = mid;
            }
            if (lo >= hi) break;
        }

        (uint256 finalCost, uint256 finalCfee, uint256 finalPfee,) = simulateBuy(amount);
        uint256 totalCharged = finalCost + finalCfee + finalPfee;
        uint256 refund = msg.value - totalCharged;

        _transfer(address(this), msg.sender, amount);
        sold += amount;

        // Notify registry for fee accounting
        IRegistry(registry).notifyFee(creator, finalCfee, finalPfee);

        if (refund > 0) payable(msg.sender).transfer(refund);
        emit Bought(msg.sender, amount, finalCost, finalCfee, finalPfee);
    }

    /**
     * @notice Sell tokens back to bonding curve.
     * @param amount       Amount to sell.
     * @param minReturn   Minimum net ETH return (slippage protection).
     */
    function sell(uint256 amount, uint256 minReturn) external {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        if (amount == 0) revert ZeroAmount();

        (uint256 ret,, uint256 pFee, uint256 net) = simulateSell(amount);
        if (net < minReturn) revert SlippageExceeded();

        _transfer(msg.sender, address(this), amount);
        sold -= amount;

        IRegistry(registry).notifyFee(creator, 0, pFee);

        payable(msg.sender).transfer(net);
        emit Sold(msg.sender, amount, ret, 0, pFee);
    }

    /* ------------------------------------------------------------------ */
    /*  Creator Withdraw                                                     */
    /* ------------------------------------------------------------------ */

    function withdrawCreator() external {
        require(msg.sender == creator, "not creator");
        uint256 owed = IRegistry(registry).creatorBalance(address(this), creator) - creatorWithdrawn;
        if (owed == 0) return;
        creatorWithdrawn += owed;
        payable(creator).transfer(owed);
    }

    /* ------------------------------------------------------------------ */
    /*  Bonding Curve Data                                                   */
    /* ------------------------------------------------------------------ */

    function getBondingData() external view returns (
        uint256 startMc,
        uint256 endMc,
        uint256 _totalSupply,
        uint256 _sold,
        uint256 price,
        uint256 mc,
        uint256 creatorFee,
        address _creator
    ) {
        return (
            startMarketCap,
            endMarketCap,
            totalSupply,
            sold,
            getPrice(),
            getMarketCap(),
            creatorFeeBps,
            creator
        );
    }

    receive() external payable {}
}

/* ---------------------------------------------------------------------- */
/*  Registry Interface                                                     */
/* ---------------------------------------------------------------------- */
interface IRegistry {
    function PLATFORM_FEE_BPS() external view returns (uint256);
    function creatorBalance(address token, address creator) external view returns (uint256);
    function notifyFee(address creator, uint256 creatorFee, uint256 platformFee) external;
}
