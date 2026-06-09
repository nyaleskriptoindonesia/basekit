# BaseKit

**Token Launchpad on Base Network**

Launch your ERC-20 token on Base in 60 seconds. No coding required.

## Quick Start

### Backend (VPS)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

### Frontend (Vercel)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run build
# Deploy to Vercel
```

## Environment Variables

### Backend (.env)
```
PORT=3001
DATABASE_URL=./basekit.db
FACTORY_PRIVATE_KEY=<your deployer private key>
FACTORY_ADDRESS=<deployed factory contract address>
BASE_RPC_URL=https://mainnet.base.org
CORS_ORIGIN=https://your-frontend.vercel.app
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your WalletConnect project ID>
```

## Architecture

- **Frontend**: Next.js 14 + Tailwind + wagmi/viem
- **Backend**: Express.js + SQLite + viem
- **Network**: Base Mainnet

## Deploy

### Backend (VPS)
```bash
# SSH to your VPS
cd /opt/basekit/backend
npm install
pm2 start server.js --name basekit
```

### Frontend (Vercel)
```bash
vercel --prod
```
