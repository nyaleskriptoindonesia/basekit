/**
 * BaseKit v3 Deploy Script (ESM)
 * Deploys BaseKitRegistry + BaseKitToken master copy to Base mainnet
 */
import { createWalletClient, http, encodeDeployData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && key.trim() && !key.startsWith('#')) {
      env[key.trim()] = vals.join('=').trim();
    }
  });
}

const PRIVATE_KEY = env.FACTORY_PRIVATE_KEY;
const RPC_URL = env.BASE_RPC_URL || 'https://mainnet.base.org';

if (!PRIVATE_KEY) {
  console.error('FACTORY_PRIVATE_KEY not set in .env');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
console.log('Deployer:', account.address);

const client = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

const contractsDir = path.join(__dirname, 'contracts/out');

async function deploy() {
  // Read artifacts
  const registryArtifact = JSON.parse(
    fs.readFileSync(path.join(contractsDir, 'BaseKitRegistry.sol/BaseKitRegistry.json'), 'utf8')
  );
  const tokenArtifact = JSON.parse(
    fs.readFileSync(path.join(contractsDir, 'BaseKitToken.sol/BaseKitToken.json'), 'utf8')
  );

  console.log('\n=== BaseKit v3 Deploy ===\n');

  // 1. Deploy Registry
  console.log('[1/3] Deploying BaseKitRegistry...');
  const regHash = await client.deployContract({
    abi: registryArtifact.abi,
    bytecode: registryArtifact.bytecode.object,
    args: [account.address],
  });
  const regRcpt = await client.waitForTransactionReceipt({ hash: regHash });
  const registryAddr = regRcpt.contractAddress;
  console.log('  Registry:', registryAddr);
  console.log('  TX:', regHash);

  // 2. Deploy Token Master
  console.log('\n[2/3] Deploying BaseKitToken (master copy)...');
  const tokHash = await client.deployContract({
    abi: tokenArtifact.abi,
    bytecode: tokenArtifact.bytecode.object,
  });
  const tokRcpt = await client.waitForTransactionReceipt({ hash: tokHash });
  const tokenMasterAddr = tokRcpt.contractAddress;
  console.log('  Token Master:', tokenMasterAddr);
  console.log('  TX:', tokHash);

  // 3. Set token master on registry
  console.log('\n[3/3] Setting token master on registry...');
  const setHash = await client.writeContract({
    address: registryAddr,
    abi: registryArtifact.abi,
    functionName: 'setTokenMaster',
    args: [tokenMasterAddr],
  });
  await client.waitForTransactionReceipt({ hash: setHash });
  console.log('  TX:', setHash);

  // Save addresses
  const deployed = {
    registry: registryAddr,
    tokenMaster: tokenMasterAddr,
    deployer: account.address,
    registryTx: regHash,
    tokenMasterTx: tokHash,
    setMasterTx: setHash,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, 'deployed-v3.json'),
    JSON.stringify(deployed, null, 2)
  );

  console.log('\n=== Deployed ===');
  console.log('Registry:', registryAddr);
  console.log('Token Master:', tokenMasterAddr);
  console.log('\nUpdate your .env:');
  console.log(`FACTORY_ADDRESS=${registryAddr}`);
  console.log(`TOKEN_MASTER_ADDRESS=${tokenMasterAddr}`);
}

deploy().catch(err => {
  console.error('Deploy failed:', err);
  process.exit(1);
});
