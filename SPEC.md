# BaseKit — Token Launchpad on Base Network

## 1. Concept & Vision

**BaseKit** adalah launchpad minimal untuk launch token di Base network — terinspirasi Clanker tapi dengan UI yang lebih bersih dan mudah dipahami. Siapa pun bisa deploy token ERC-20 dengan beberapa klik, tanpa perlu tahu coding. Feel: product tool, bukan实验.

Tagline: *"Launch your token in 60 seconds."*

---

## 2. Design Language

### Aesthetic
Dark theme, dense SaaS product feel. Fokus pada clarity dan speed — user harus langsung paham apa yang harus dilakukan.

### Color Palette
- **Background:** `#0a0a0a` (near black)
- **Surface:** `#111111` (card bg)
- **Border:** `#1a1a1a` (subtle)
- **Primary accent:** `#0052FF` (Base blue — `#0052FF`)
- **Secondary accent:** `#FF6B00` (orange for highlights/warnings)
- **Text primary:** `#FFFFFF`
- **Text secondary:** `#888888`
- **Success:** `#00D26A`
- **Error:** `#FF4757`

### Typography
- **Font:** `Inter` via Google Fonts
- **Heading:** Inter 700, 32px / 24px / 18px
- **Body:** Inter 400, 14px
- **Mono (addresses, hashes):** `JetBrains Mono`, 12px

### Layout
- Single-page app dengan sections:
  1. **Hero** — headline + CTA
  2. **Launch Form** — form utama untuk create token
  3. **Recent Tokens** — list token yang baru dibuat
  4. **How it Works** — 3-step explainer
  5. **Footer**

### Motion
- Subtle fade-in on scroll (Intersection Observer)
- Button hover: scale 1.02, 150ms ease
- Form focus: border glow with primary color

---

## 3. Layout & Structure

### Page Flow
```
┌─────────────────────────────────────────┐
│  Navbar: Logo + "Launch Token" button    │
├─────────────────────────────────────────┤
│  Hero: "Launch your token on Base       │
│         in 60 seconds" + CTA            │
├─────────────────────────────────────────┤
│  Launch Form Card:                      │
│  - Token Name (input)                   │
│  - Token Symbol (input)                 │
│  - Initial Supply (input)               │
│  - Description (optional textarea)      │
│  - Launch Button                        │
│  - Status/Result area                   │
├─────────────────────────────────────────┤
│  Recent Tokens Table:                   │
│  Name | Symbol | Supply | Deployer | TX │
├─────────────────────────────────────────┤
│  How it Works: 3 columns               │
│  [1. Fill Form] [2. Sign] [3. Done]    │
├─────────────────────────────────────────┤
│  Footer: Base network badge             │
└─────────────────────────────────────────┘
```

### Responsive Strategy
- Mobile-first: single column, form full-width
- Tablet (768px+): form centered max-w-lg
- Desktop (1024px+): hero centered, max-w-2xl form

---

## 4. Features & Interactions

### Core Feature: Launch Token

**Form Fields:**
| Field | Type | Validation | Placeholder |
|-------|------|------------|-------------|
| Token Name | text | Required, 2-50 chars | "My Awesome Token" |
| Token Symbol | text | Required, 2-8 chars, uppercase | "MAT" |
| Initial Supply | number | Required, > 0, max 1B | "1000000" |
| Description | textarea | Optional, max 280 chars | "Describe your token..." |
| Wallet | auto-filled | from connected wallet | "0x1234...abcd" |

**Flow:**
1. User connect wallet (MetaMask/WalletConnect)
2. User fill form
3. User click "Launch Token"
4. Confirm tx in wallet
5. Show tx hash + contract address on success
6. Add to Recent Tokens list

**States:**
- `idle` — form ready
- `connecting` — connecting wallet
- `ready` — wallet connected, form active
- `deploying` — tx pending, button shows spinner + "Deploying..."
- `success` — shows contract address + tx hash, confetti burst
- `error` — shows error message, form re-enabled

### Recent Tokens
- Show last 10 tokens deployed via this launchpad
- Columns: Name, Symbol, Supply, Deployed By (truncated), Time
- Click row → opens BaseScan
- Auto-refresh every 30s

### How It Works
3 steps:
1. **Connect Wallet** — MetaMask or WalletConnect
2. **Fill Details** — Name, symbol, supply
3. **Deploy** — Sign the transaction, get your token

---

## 5. Component Inventory

### Navbar
- Logo: "BaseKit" text + Base blue accent
- Right: "Launch Token" button (scrolls to form)
- Sticky, glassmorphic background

### Hero Section
- H1: large, bold
- Subtext: one-liner penjelasan
- CTA button: "Launch Your Token"

### TokenForm Card
- White-on-dark card, 1px border
- Inputs: dark bg, primary border on focus
- Button: full-width, primary blue, bold
- States: idle / loading / success / error

### RecentTokens Table
- Striped rows, hover highlight
- Truncated addresses with copy button
- Time as relative ("2 min ago")

### StepCard (How it Works)
- Numbered badge
- Icon + title + description

### Footer
- "Powered by Base" badge
- Links: GitHub, Twitter

---

## 6. Technical Approach

### Architecture
```
Browser (Frontend - Vercel)
  └── Next.js 14 (App Router)
        └── wagmi + viem (wallet + contract interaction)
              └── Base RPC

VPS (Backend - Self-hosted)
  └── Node.js API
        ├── POST /api/deploy     — receive signed tx, broadcast
        ├── GET  /api/tokens    — list recent tokens
        └── GET  /api/status    — health check

Database (VPS)
  └── SQLite (tokens cache)
```

### Smart Contract
- Factory contract: `TokenFactory.sol` deployed on Base
- Creates new `ERC20` token per launch
- Uses CREATE2 for deterministic addresses
- Gasless meta-transaction support (optional)

### API Endpoints (VPS Backend)

**POST /api/deploy**
```json
Request:
{
  "name": "My Token",
  "symbol": "MTK",
  "supply": "1000000",
  "deployer": "0x...",
  "signature": "0x..." // optional
}
Response:
{
  "success": true,
  "txHash": "0x...",
  "contractAddress": "0x...",
  "blockNumber": 12345678
}
```

**GET /api/tokens**
```json
Response:
{
  "tokens": [
    {
      "name": "My Token",
      "symbol": "MTK",
      "supply": "1000000",
      "deployer": "0x...",
      "contractAddress": "0x...",
      "txHash": "0x...",
      "timestamp": 1234567890
    }
  ]
}
```

### Environment Variables (VPS)
```
PORT=3001
DATABASE_URL=./basekit.db
PRIVATE_KEY=<factory deployer private key>
BASE_RPC_URL=https://mainnet.base.org
```

### Frontend Stack (Vercel)
- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Wallet:** wagmi v2 + viem
- **State:** React hooks
- **Icons:** Lucide React
- **Animations:** Tailwind animate + CSS transitions

### Backend Stack (VPS)
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **DB:** better-sqlite3
- **RPC:** viem for Base interactions
