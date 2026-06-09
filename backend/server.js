import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'basekit.db');

// ─── Database Setup ──────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    supply TEXT NOT NULL,
    deployer TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE,
    block_number INTEGER,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS deploy_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    supply TEXT NOT NULL,
    deployer TEXT NOT NULL,
    description TEXT,
    ip_address TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )
`);

// ─── Viem Clients ────────────────────────────────────────────────────────────
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

const walletClient = process.env.FACTORY_PRIVATE_KEY
  ? createWalletClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
      account: privateKeyToAccount(process.env.FACTORY_PRIVATE_KEY),
    })
  : null;

// ─── Simple ERC20 ABI for factory ───────────────────────────────────────────
const ERC20_ABI = [
  {
    type: 'function',
    name: 'createToken',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'initialSupply', type: 'uint256' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getTokenCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

// ─── App ─────────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    chain: 'base',
    factory: process.env.FACTORY_ADDRESS || 'not configured',
  });
});

// Deploy a new token
app.post('/api/deploy', async (req, res) => {
  const { name, symbol, supply, deployer, description } = req.body;

  // Validation
  if (!name || !symbol || !supply || !deployer) {
    return res.status(400).json({ error: 'Missing required fields: name, symbol, supply, deployer' });
  }

  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ error: 'Token name must be 2-50 characters' });
  }

  if (symbol.length < 2 || symbol.length > 8) {
    return res.status(400).json({ error: 'Token symbol must be 2-8 characters' });
  }

  if (isNaN(supply) || parseFloat(supply) <= 0 || parseFloat(supply) > 1e12) {
    return res.status(400).json({ error: 'Invalid supply amount' });
  }

  const supplyBn = BigInt(supply);

  try {
    // If factory is configured, use it; otherwise simulate for demo
    if (walletClient && process.env.FACTORY_ADDRESS) {
      const hash = await walletClient.writeContract({
        address: process.env.FACTORY_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'createToken',
        args: [name, symbol.toUpperCase(), supplyBn],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Decode TokenCreated event to get the new token address
      const tokenCreatedEvent = receipt.logs.find(log => {
        return log.topics[0] === '0x6e6ae68e7d7d45fbd855c40d1eaafa8de46c5fbec3ee26f1af88730e400bc92c';
      });
      const tokenAddress = tokenCreatedEvent
        ? '0x' + tokenCreatedEvent.topics[1].slice(26)
        : '0xdemo';

      // Save to DB
      const insert = db.prepare(`
        INSERT INTO tokens (name, symbol, supply, deployer, contract_address, tx_hash, block_number, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        name,
        symbol.toUpperCase(),
        supply,
        deployer,
        String(tokenAddress),
        String(hash),
        Number(receipt.blockNumber),
        description || null
      );

      // Save deploy request
      const reqInsert = db.prepare(`
        INSERT INTO deploy_requests (name, symbol, supply, deployer, description, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      reqInsert.run(name, symbol.toUpperCase(), supply, deployer, description || null, req.ip);

      return res.json({
        success: true,
        txHash: String(hash),
        contractAddress: String(tokenAddress),
        blockNumber: Number(receipt.blockNumber),
      });
    } else {
      // Demo mode — simulate deployment
      const fakeContract = '0x' + Array.from({ length: 40 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const fakeTx = '0x' + Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      // Save to DB
      const insert = db.prepare(`
        INSERT INTO tokens (name, symbol, supply, deployer, contract_address, tx_hash, block_number, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        name,
        symbol.toUpperCase(),
        supply,
        deployer,
        fakeContract,
        fakeTx,
        12345678 + Math.floor(Math.random() * 1000000),
        description || null
      );

      const reqInsert = db.prepare(`
        INSERT INTO deploy_requests (name, symbol, supply, deployer, description, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      reqInsert.run(name, symbol.toUpperCase(), supply, deployer, description || null, req.ip);

      return res.json({
        success: true,
        txHash: fakeTx,
        contractAddress: fakeContract,
        blockNumber: 12345678 + Math.floor(Math.random() * 1000000),
        demo: true,
      });
    }
  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ error: err.shortMessage || err.message || 'Deployment failed' });
  }
});

// Get recent tokens
app.get('/api/tokens', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const offset = parseInt(req.query.offset) || 0;

  const tokens = db.prepare(`
    SELECT * FROM tokens
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM tokens').get().count;

  return res.json({ tokens, total, limit, offset });
});

// Get single token by address
app.get('/api/tokens/:address', (req, res) => {
  const token = db.prepare('SELECT * FROM tokens WHERE contract_address = ?').get(req.params.address);
  if (!token) return res.status(404).json({ error: 'Token not found' });
  return res.json({ token });
});

// Get deploy stats
app.get('/api/stats', (req, res) => {
  const totalTokens = db.prepare('SELECT COUNT(*) as count FROM tokens').get().count;
  const recent = db.prepare(`
    SELECT COUNT(*) as count FROM tokens
    WHERE created_at > strftime('%s', 'now') - 86400
  `).get().count;

  return res.json({
    totalTokens,
    deployedLast24h: recent,
    chain: 'base',
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`BaseKit API running on http://localhost:${PORT}`);
  console.log(`Chain: Base | Mode: ${walletClient ? 'live' : 'demo'}`);
});
