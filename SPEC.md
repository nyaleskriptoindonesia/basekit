# BaseKit — Clanker-Style Launchpad on Base

## Overview
A fair-launch token platform where creators deploy ERC-20 tokens with a linear bonding curve. No presales, no LP lock — just deploy, curve does the rest. Platform takes a creation fee.

## Fee Structure

| Fee | Amount | Recipient |
|-----|--------|-----------|
| **Platform creation fee** | 0.5 ETH | BaseKit treasury |
| **Creator fee** | 0–10% (set by creator) | Token creator |
| **Platform buy/sell fee** | 0.5% | BaseKit treasury |

## Token Lifecycle

1. **Creator deploys** → pays 0.5 ETH platform fee, sets bonding curve params
2. **Curve starts** → initial price = start market cap
3. **Buyers buy** → price rises along curve, creator accrues fees
4. **Creator withdraws** → pulls accumulated ETH
5. **Trading open** → anyone can buy/sell via curve

## Bonding Curve Model

**Linear Curve:**
```
slope = (endMarketCap - startMarketCap) / totalSupply
currentPrice(sold) = startMarketCap + (sold × slope)
```
- startMarketCap: starting valuation (e.g., $200)
- endMarketCap: fully diluted valuation (e.g., $50,000)
- Platform fee + creator fee taken from buy amount

**Buy Math (bonding curve integral):**
```
cost = integral price over bought supply
     = sold × startPrice + (sold² × slope) / 2
fee = cost × (platformFee + creatorFee)
total = cost + fee
```

**Sell Math:**
```
return = sold × currentPrice × (1 - platformFee - creatorFee)
```

## Smart Contracts

### BaseKitRegistry.sol
Platform-wide registry and fee collector.
- Owner: BaseKit team
- Stores: platformFee (0.5%), creationFee (0.5 ETH)
- Methods: createToken(), withdrawFees(), setFees()
- Events: TokenCreated(address indexed token, address indexed creator, BondingParams)

### BaseKitToken.sol
Individual token with bonding curve + creator fee.
- Constructor: name, symbol, totalSupply, startMarketCap, endMarketCap, creatorFee, registry
- State: sold, creator, creatorFee, virtualEth, virtualTokens, bondParams
- Methods: buy(), sell(), withdrawCreator(), getPrice()
- Events: Bought(address buyer, uint256 amount, uint256 cost), Sold(address seller, uint256 amount, uint256 return)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/status | Platform status, stats |
| GET | /api/tokens | All deployed tokens |
| POST | /api/deploy | Create new token (creator deploys via factory) |
| GET | /api/tokens/:address | Token bonding curve data |
| POST | /api/tokens/:address/buy | Buy tokens |
| POST | /api/tokens/:address/sell | Sell tokens |
| GET | /api/creator/:address | Creator's tokens + withdrawn amounts |

## Deployment Flow (Creator)

1. Creator fills form: name, symbol, supply, startMc, endMc, creatorFee
2. Frontend calls POST /api/deploy
3. Backend deploys BaseKitToken via factory, sends 0.5 ETH creation fee
4. Returns: tx hash, contract address
5. Token listed on platform

## Buy Flow

1. User selects token, enters amount
2. Frontend calls GET /api/tokens/:address → current price
3. User confirms buy
4. Frontend calls POST /api/tokens/:address/buy (via backend walletClient)
5. Backend executes buy() on-chain
6. Returns: tx hash, tokens bought

## Design Language (BaseKit branding)

Colors: Dark #0a0a0a, accent orange #FF6B00, blue #5855FF
Font: Inter
Dark glassmorphic UI, card grids, gradient accents

## Frontend Pages

1. **/** — Home: hero, how it works, featured tokens, CTA
2. **/launch** — Creator deploy form
3. **/token/[address]** — Token detail + bonding curve chart + buy/sell

## Backend Architecture

- Express + better-sqlite3 + viem
- WalletClient (server-side private key) executes all on-chain txs
- No user wallet signing required for buy/sell — backend handles
- Frontend only reads chain state + calls API
