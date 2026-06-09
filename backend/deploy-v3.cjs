/**
 * BaseKit v3 Real Deploy Script
 * Deploys Registry + TokenMaster, then configures everything
 * Run: node deploy-v3.cjs <private_key>
 */
import { createWalletClient, http, 0 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PK = process.argv[2] || process.env.FACTORY_PRIVATE_KEY;

if (!PK) {
  console.error('Usage: node deploy-v3.cjs <private_key>');
  console.error('   or: FACTORY_PRIVATE_KEY=<key> node deploy-v3.cjs');
  process.exit(1);
}

const RPC = 'https://mainnet.base.org';
const account = privateKeyToAccount(PK);
console.log('Deployer:', account.address);

const client = createWalletClient({ account, chain: base, transport: http(RPC) });

// Read artifacts
const regArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'contracts/out/BaseKitRegistry.sol/BaseKitRegistry.json'))
);
const tokArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'contracts/out/BaseKitToken.sol/BaseKitToken.json'))
);

async function deploy() {
  console.log('\n=== Deploying BaseKit v3 ===\n');

  // 1. Deploy Registry
  console.log('[1/3] Deploying BaseKitRegistry...');
  const regHash = await client.deployContract({
    abi: regArtifact.abi,
    bytecode: regArtifact.bytecode.object,
    args: [account.address],
  });
  const regRcpt = await client.waitForTransactionReceipt({ hash: regHash });
  const registry = regRcpt.contractAddress;
  console.log('  Registry:', registry);
  console.log('  TX:', regHash);

  // 2. Deploy Token Master
  console.log('\n[2/3] Deploying BaseKitToken (master copy)...');
  const tokHash = await client.deployContract({
    abi: tokArtifact.abi,
    bytecode: tokArtifact.bytecode.object,
  });
  const tokRcpt = await client.waitForTransactionReceipt({ hash: tokHash });
  const tokenMaster = tokRcpt.contractAddress;
  console.log('  Token Master:', tokenMaster);
  console.log('  TX:', tokHash);

  // 3. Set token master on registry
  console.log('\n[3/3] Configuring registry...');
  const setHash = await client.writeContract({
    address: registry,
    abi: regArtifact.abi,
    functionName: 'setTokenMaster',
    args: [tokenMaster],
  });
  const setRcpt = await client.waitForTransactionReceipt({ hash: setHash });
  console.log('  TX:', setHash);

  // Save deployed addresses
  const deployed = {
    registry,
    tokenMaster,
    deployer: account.address,
    registryTx: regHash,
    tokenMasterTx: tokHash,
    setMasterTx: setHash,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(__dirname, 'deployed-v3.json'), JSON.stringify(deployed, null, 2));

  console.log('\n✅ DEPLOYED SUCCESSFULLY');
  console.log('Registry:', registry);
  console.log('TokenMaster:', tokenMaster);
  console.log('\nUpdate .env on VPS:');
  console.log(`FACTORY_ADDRESS=${registry}`);
  console.log(`TOKEN_MASTER_ADDRESS=${tokenMaster}`);

  return deployed;
}

deploy().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
