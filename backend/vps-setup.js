import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG = {
  host: '43.156.81.44',
  port: 22,
  username: 'ubuntu',
  password: 'comet-79@-quantum',
};

const conn = new Client();

const cmd = (command) => new Promise((resolve, reject) => {
  conn.exec(command, (err, stream) => {
    if (err) { reject(err); return; }
    let out = '', errOut = '';
    stream.on('data', (d) => { out += d; });
    stream.stderr.on('data', (d) => { errOut += d; });
    stream.on('close', (code) => {
      if (code !== 0 && errOut) reject(new Error(errOut));
      else resolve(out);
    });
  });
});

conn.on('ready', async () => {
  console.log('SSH connected');

  try {
    // Check Node version
    let out = await cmd('node --version 2>&1; echo "EXIT:$?"');
    console.log('Node version:', out.trim().split('\n')[0]);

    // Check if pm2 exists
    out = await cmd('which pm2 2>&1; echo "pm2 exit: $?"');
    const hasPM2 = !out.includes('no pm2') && !out.includes('not found');
    console.log('PM2:', hasPM2 ? 'found' : 'not found');

    // Create basekit dir
    await cmd('mkdir -p /home/ubuntu/basekit');
    console.log('Dir ready');

    // Write .env
    await cmd(`cat > /home/ubuntu/basekit/.env << 'ENVEOF'
PORT=3001
DATABASE_URL=/home/ubuntu/basekit/basekit.db
FACTORY_PRIVATE_KEY=
FACTORY_ADDRESS=
BASE_RPC_URL=https://mainnet.base.org
CORS_ORIGIN=*
ENVEOF`);
    console.log('.env written');

    // Write package.json
    const pkgJson = readFileSync('/home/ubuntu/basekit/backend/package.json', 'utf8');
    await cmd(`cat > /home/ubuntu/basekit/package.json << 'PKGEOF'\n${pkgJson}\nPKGEOF`);
    console.log('package.json written');

    // Write server.js
    const serverJs = readFileSync('/home/ubuntu/basekit/backend/server.js', 'utf8');
    await cmd(`cat > /home/ubuntu/basekit/server.js << 'SRVEOF'\n${serverJs}\nSRVEOF`);
    console.log('server.js written');

    // Install deps
    console.log('Installing npm packages...');
    out = await cmd('cd /home/ubuntu/basekit && npm install 2>&1 | tail -5');
    console.log('npm install output:', out.trim().split('\n').slice(-3).join('\n'));

    // Install PM2 if needed
    if (!hasPM2) {
      console.log('Installing PM2...');
      out = await cmd('npm install -g pm2 2>&1 | tail -3');
      console.log('PM2 install:', out.trim().split('\n').slice(-2).join('\n'));
    }

    // Stop existing pm2 process
    await cmd('pm2 delete basekit 2>/dev/null; echo "cleaned"');
    console.log('Starting BaseKit API...');
    out = await cmd('cd /home/ubuntu/basekit && pm2 start server.js --name basekit 2>&1');
    console.log('PM2 start output:', out.trim());

    // Wait then check status
    await new Promise(r => setTimeout(r, 4000));
    out = await cmd('pm2 status basekit 2>&1');
    console.log('PM2 status:', out.trim());

    // Test API
    out = await cmd('curl -s http://localhost:3001/api/status 2>&1');
    console.log('API status:', out.trim());

    console.log('\n✅ VPS Backend setup complete!');
    console.log('📍 API URL: http://43.156.81.44:3001');
    console.log('\n⚠️  Factory contract NOT deployed yet — wallet has 0 BASE.');
    console.log('   Fund wallet 0x8e177ba77576ddd2bc11f5ba98d0f311d4fc9c83 with BASE tokens,');
    console.log('   then run:\n   cd /home/ubuntu/basekit && forge create src/BaseKitFactory.sol:BaseKitFactory --rpc-url https://mainnet.base.org --private-key YOUR_KEY --broadcast');

  } catch (err) {
    console.error('Setup error:', err.message);
  } finally {
    conn.end();
  }
});

conn.on('error', (err) => {
  console.error('SSH error:', err);
  process.exit(1);
});

conn.connect(CONFIG);
