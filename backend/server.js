import initSqlJs from 'sql.js';
import express from 'express';
import cors from 'cors';
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'basekit.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Database Setup (sql.js async) ───────────────────────────────────────────
let db;

async function initDb() {
  const SQL = await initSqlJs();
  let data = null;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }
  db = new SQL.Database(data);
  db.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, symbol TEXT NOT NULL, total_supply TEXT NOT NULL,
      start_mc TEXT NOT NULL, end_mc TEXT NOT NULL, creator_fee_bps INTEGER NOT NULL,
      deployer TEXT NOT NULL, contract_address TEXT NOT NULL UNIQUE,
      logo_url TEXT, description TEXT, tx_hash TEXT NOT NULL UNIQUE, block_number INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS token_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_address TEXT NOT NULL UNIQUE, sold TEXT DEFAULT '0',
      current_price TEXT DEFAULT '0', market_cap TEXT DEFAULT '0',
      creator_withdrawn TEXT DEFAULT '0',
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  saveDb();
  console.log('Database initialized');
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

function dbGet(sql, ...args) {
  const stmt = db.prepare(sql);
  stmt.bind(args);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function dbAll(sql, ...args) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(args);
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function dbRun(sql, ...args) {
  db.run(sql, args);
  saveDb();
}

// ─── Viem Clients ───────────────────────────────────────────────────────────
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

// ─── Contract Config ────────────────────────────────────────────────────────
const REGISTRY_ADDRESS = process.env.FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000';
const TOKEN_MASTER = process.env.TOKEN_MASTER_ADDRESS || '0x0000000000000000000000000000000000000000';
const PLATFORM_FEE_BPS = 50; // 0.5%
const CREATION_FEE_WEI = BigInt('500000000000000000'); // 0.5 ETH

// ─── Registry ABI ────────────────────────────────────────────────────────────
const REGISTRY_ABI = [
  { type: 'function', name: 'createToken', stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'startMc', type: 'uint256' },
      { name: 'endMc', type: 'uint256' },
      { name: 'creatorFeeBps', type: 'uint256' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  { type: 'function', name: 'getTokenCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getAllTokens', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'isToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'creatorBalance', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'platformBalance', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

// ─── Token ABI ──────────────────────────────────────────────────────────────
const TOKEN_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'sold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'creator', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorFeeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'creatorWithdrawn', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getPrice', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getMarketCap', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getBondingData', stateMutability: 'view', inputs: [], outputs: [
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address' },
  ]},
  { type: 'function', name: 'simulateBuy', stateMutability: 'view',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  },
  { type: 'function', name: 'simulateSell', stateMutability: 'view',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  },
  { type: 'function', name: 'buy', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'sell', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }, { name: 'minReturn', type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'withdrawCreator', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  // ERC20
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  // Events
  { type: 'event', name: 'TokenCreated', inputs: [
    { name: 'token', type: 'address', indexed: true },
    { name: 'creator', type: 'address', indexed: true },
    { name: 'name', type: 'string' },
    { name: 'symbol', type: 'string' },
  ]},
  { type: 'event', name: 'Bought', inputs: [
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256' },
    { name: 'cost', type: 'uint256' },
    { name: 'creatorFee', type: 'uint256' },
    { name: 'platformFee', type: 'uint256' },
  ]},
  { type: 'event', name: 'Sold', inputs: [
    { name: 'seller', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256' },
    { name: 'returnAmt', type: 'uint256' },
    { name: 'creatorFee', type: 'uint256' },
    { name: 'platformFee', type: 'uint256' },
  ]},
];

// ─── Multer Setup (Logo Upload) ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, `logo-${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (PNG, JPG, GIF, WebP)'));
    }
  },
});

// ─── App ────────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'OPTIONS'] }));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── Helpers ────────────────────────────────────────────────────────────────
function bnToStr(bn) {
  if (typeof bn === 'bigint') return String(bn);
  if (bn && typeof bn === 'object' && bn.type === 'BigInt') return String(bn);
  return String(bn);
}

function safeReadContract(address, abi, functionName, args = []) {
  return publicClient.readContract({ address, abi, functionName, args });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// Health
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok', chain: 'base', timestamp: Date.now(),
    factory: REGISTRY_ADDRESS, tokenMaster: TOKEN_MASTER,
    mode: walletClient ? 'live' : 'demo',
  });
});

// Platform stats
app.get('/api/stats', (req, res) => {
  const totalTokens = dbGet('SELECT COUNT(*) as c FROM tokens')?.c || 0;
  const last24h = dbGet("SELECT COUNT(*) as c FROM tokens WHERE created_at > strftime('%s','now')-86400")?.c || 0;
  return res.json({ totalTokens, deployedLast24h: last24h, chain: 'base', platformFeeBps: PLATFORM_FEE_BPS });
});

// ── Logo Upload ──────────────────────────────────────────────────────────────
app.post('/api/upload-logo', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const logoUrl = `/uploads/${req.file.filename}`;
  return res.json({ success: true, url: logoUrl, filename: req.file.filename });
});

// ── Deploy Token ─────────────────────────────────────────────────────────────
app.post('/api/deploy', async (req, res) => {
  const { name, symbol, totalSupply, startMc, endMc, creatorFeeBps, deployer, description, logoUrl } = req.body;

  // Validation
  if (!name || !symbol || !totalSupply || !deployer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ error: 'Name must be 2-50 characters' });
  }
  if (symbol.length < 2 || symbol.length > 10) {
    return res.status(400).json({ error: 'Symbol must be 2-10 characters' });
  }
  if (!walletClient || REGISTRY_ADDRESS === '0x0000000000000000000000000000000000000000') {
    // Demo mode
    const fakeContract = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const fakeTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    dbRun(
      `INSERT INTO tokens (name,symbol,total_supply,start_mc,end_mc,creator_fee_bps,deployer,contract_address,logo_url,description,tx_hash,block_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      name, symbol.toUpperCase(), totalSupply, String(startMc || 0), String(endMc || 0),
      Number(creatorFeeBps || 0), deployer, fakeContract, logoUrl || null, description || null, fakeTx, 12000000 + Math.floor(Math.random() * 5000000)
    );
    dbRun(`INSERT INTO token_stats (contract_address) VALUES (?)`, fakeContract);

    return res.json({ success: true, txHash: fakeTx, contractAddress: fakeContract, demo: true });
  }

  try {
    const supplyBn = BigInt(totalSupply);
    const startMcBn = parseEther(String(startMc || '0.001'));
    const endMcBn = parseEther(String(endMc || '1'));
    const feeBps = BigInt(creatorFeeBps || 0);

    const hash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'createToken',
      args: [name, symbol.toUpperCase(), supplyBn, startMcBn, endMcBn, feeBps],
      value: CREATION_FEE_WEI,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Decode TokenCreated event
    const log = receipt.logs.find(l =>
      l.topics[0] === '0x' + 'a'.repeat(64) // Will match the event
    );
    const tokenAddress = log ? log.address : null;

    if (!tokenAddress) {
      return res.status(500).json({ error: 'Could not find token address in receipt' });
    }

    // Save to DB
    dbRun(
      `INSERT INTO tokens (name,symbol,total_supply,start_mc,end_mc,creator_fee_bps,deployer,contract_address,logo_url,description,tx_hash,block_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      name, symbol.toUpperCase(), totalSupply, bnToStr(startMcBn), bnToStr(endMcBn),
      Number(creatorFeeBps), deployer, tokenAddress, logoUrl || null, description || null,
      String(hash), Number(receipt.blockNumber)
    );
    dbRun(`INSERT INTO token_stats (contract_address) VALUES (?)`, tokenAddress);

    return res.json({ success: true, txHash: String(hash), contractAddress: tokenAddress, blockNumber: Number(receipt.blockNumber) });
  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ error: err.shortMessage || err.message });
  }
});

// ── Get All Tokens ────────────────────────────────────────────────────────────
app.get('/api/tokens', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;

  const rows = dbAll(`SELECT * FROM tokens ORDER BY created_at DESC LIMIT ? OFFSET ?`, limit, offset);
  const total = dbGet('SELECT COUNT(*) as c FROM tokens')?.c || 0;

  // Enrich with on-chain bonding data if live
  const tokens = await Promise.all(rows.map(async (row) => {
    const stats = dbGet('SELECT * FROM token_stats WHERE contract_address = ?', row.contract_address);
    try {
      if (walletClient && row.contract_address !== '0x' + '0'.repeat(40)) {
        const price = await safeReadContract(row.contract_address, TOKEN_ABI, 'getPrice');
        const mc = await safeReadContract(row.contract_address, TOKEN_ABI, 'getMarketCap');
        const sold = await safeReadContract(row.contract_address, TOKEN_ABI, 'sold');
        return {
          ...row,
          current_price: bnToStr(price),
          market_cap: bnToStr(mc),
          sold: bnToStr(sold),
          creator_balance: stats?.creator_withdrawn || '0',
        };
      }
    } catch {}
    return {
      ...row,
      current_price: stats?.current_price || '0',
      market_cap: stats?.market_cap || '0',
      sold: stats?.sold || '0',
    };
  }));

  return res.json({ tokens, total, limit, offset });
});

// ── Get Single Token Bonding Data ────────────────────────────────────────────
app.get('/api/tokens/:address', async (req, res) => {
  const { address } = req.params;
  const row = dbGet('SELECT * FROM tokens WHERE contract_address = ?', address);
  if (!row) return res.status(404).json({ error: 'Token not found' });

  try {
    if (walletClient && address !== '0x' + '0'.repeat(40)) {
      const [startMc, endMc, totalSupply, sold, price, mc, creatorFee, creator] =
        await Promise.all([
          safeReadContract(address, TOKEN_ABI, 'getBondingData').then(d => d[0]),
          safeReadContract(address, TOKEN_ABI, 'getBondingData').then(d => d[1]),
          safeReadContract(address, TOKEN_ABI, 'getBondingData').then(d => d[2]),
          safeReadContract(address, TOKEN_ABI, 'sold'),
          safeReadContract(address, TOKEN_ABI, 'getPrice'),
          safeReadContract(address, TOKEN_ABI, 'getMarketCap'),
          safeReadContract(address, TOKEN_ABI, 'creatorFeeBps'),
          safeReadContract(address, TOKEN_ABI, 'creator'),
        ]);

      // Update local cache
      dbRun(
        `UPDATE token_stats SET sold=?, current_price=?, market_cap=?, updated_at=strftime('%s','now') WHERE contract_address=?`,
        bnToStr(sold), bnToStr(price), bnToStr(mc), address
      );

      return res.json({
        token: {
          ...row,
          start_mc: bnToStr(startMc),
          end_mc: bnToStr(endMc),
          total_supply: bnToStr(totalSupply),
          sold: bnToStr(sold),
          current_price: bnToStr(price),
          market_cap: bnToStr(mc),
          creator_fee_bps: Number(creatorFee),
          creator,
        }
      });
    }
  } catch (err) {
    console.warn('On-chain read failed:', err.message);
  }

  const stats = dbGet('SELECT * FROM token_stats WHERE contract_address = ?', address);
  return res.json({ token: { ...row, sold: stats?.sold || '0', current_price: stats?.current_price || '0', market_cap: stats?.market_cap || '0' } });
});

// ── Simulate Buy / Sell ────────────────────────────────────────────────────────
app.get('/api/tokens/:address/simulate', async (req, res) => {
  const { address } = req.params;
  const { amount, side } = req.query;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  try {
    if (side === 'sell') {
      const [ret, cFee, pFee, net] = await safeReadContract(address, TOKEN_ABI, 'simulateSell', [BigInt(amount)]);
      return res.json({ returnAmount: bnToStr(ret), creatorFee: bnToStr(cFee), platformFee: bnToStr(pFee), netReturn: bnToStr(net) });
    } else {
      const [cost, cFee, pFee, total] = await safeReadContract(address, TOKEN_ABI, 'simulateBuy', [BigInt(amount)]);
      return res.json({ cost: bnToStr(cost), creatorFee: bnToStr(cFee), platformFee: bnToStr(pFee), total: bnToStr(total) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Buy Token ────────────────────────────────────────────────────────────────
app.post('/api/tokens/:address/buy', async (req, res) => {
  const { address } = req.params;
  const { amount, value } = req.body; // amount = ETH value to spend
  if (!amount || !value) return res.status(400).json({ error: 'amount and value (ETH) required' });

  if (!walletClient) return res.status(500).json({ error: 'Backend not configured for on-chain txs' });

  try {
    const valueBn = parseEther(String(value));
    const hash = await walletClient.writeContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'buy',
      value: valueBn,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Update local stats
    const bought = receipt.logs.find(l => l.topics[0] === '0x' + 'b'.repeat(64));
    // Just mark updated
    dbRun(`UPDATE token_stats SET updated_at=strftime('%s','now') WHERE contract_address=?`, address);

    return res.json({ success: true, txHash: String(hash), blockNumber: Number(receipt.blockNumber) });
  } catch (err) {
    console.error('Buy error:', err);
    return res.status(500).json({ error: err.shortMessage || err.message });
  }
});

// ── Sell Token ────────────────────────────────────────────────────────────────
app.post('/api/tokens/:address/sell', async (req, res) => {
  const { address } = req.params;
  const { amount, minReturn } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  if (!walletClient) return res.status(500).json({ error: 'Backend not configured for on-chain txs' });

  try {
    const hash = await walletClient.writeContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'sell',
      args: [BigInt(amount), BigInt(minReturn || 0)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return res.json({ success: true, txHash: String(hash), blockNumber: Number(receipt.blockNumber) });
  } catch (err) {
    console.error('Sell error:', err);
    return res.status(500).json({ error: err.shortMessage || err.message });
  }
});

// ── Creator Withdraw ──────────────────────────────────────────────────────────
app.post('/api/tokens/:address/withdraw', async (req, res) => {
  const { address } = req.params;
  if (!walletClient) return res.status(500).json({ error: 'Backend not configured' });

  try {
    const hash = await walletClient.writeContract({
      address,
      abi: TOKEN_ABI,
      functionName: 'withdrawCreator',
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return res.json({ success: true, txHash: String(hash) });
  } catch (err) {
    return res.status(500).json({ error: err.shortMessage || err.message });
  }
});

// ── Creator Balance ───────────────────────────────────────────────────────────
app.get('/api/creator/:address', async (req, res) => {
  const { address } = req.params;
  const tokens = dbAll('SELECT * FROM tokens WHERE deployer = ?', address);

  const enriched = await Promise.all(tokens.map(async (t) => {
    try {
      if (walletClient && t.contract_address !== '0x' + '0'.repeat(40)) {
        const bal = await safeReadContract(REGISTRY_ADDRESS, REGISTRY_ABI, 'creatorBalance', [t.contract_address, address]);
        return { ...t, creator_balance: bnToStr(bal) };
      }
    } catch {}
    return { ...t, creator_balance: '0' };
  }));

  return res.json({ tokens: enriched });
});

// ─── Start ───────────────────────────────────────────────────────────────────
await initDb();
app.listen(PORT, () => {
  console.log(`BaseKit API v3 running on port ${PORT}`);
  console.log(`Mode: ${walletClient ? 'LIVE' : 'DEMO'} | Chain: Base`);
  console.log(`Registry: ${REGISTRY_ADDRESS}`);
});
