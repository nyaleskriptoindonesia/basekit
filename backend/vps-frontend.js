import { Client } from 'ssh2';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG = {
  host: '43.156.81.44',
  port: 22,
  username: 'ubuntu',
  password: 'comet-79@-quantum',
};

const FRONTEND_DIR = join(__dirname, '..', 'frontend');
const REMOTE_BASE = '/home/ubuntu/basekit-frontend';
const API_URL = 'http://43.156.81.44:3001';

function getAllFiles(dir, base = '') {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = join(base, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      files.push(...getAllFiles(full, rel));
    } else {
      files.push({ full, rel });
    }
  }
  return files;
}

const conn = new Client();

conn.on('ready', async () => {
  console.log('SSH connected');

  try {
    // Write .env.local
    const envLocal = `NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=580d8bcc3535aeb83c7a32817de32d8e
`;
    await sshCmd(`mkdir -p ${REMOTE_BASE}`);
    await sshCmd(`cat > ${REMOTE_BASE}/.env.local << 'EOF'\n${envLocal}EOF`);
    console.log('.env.local written');

    // Get all files
    const files = getAllFiles(FRONTEND_DIR);
    console.log(`Found ${files.length} files to upload`);

    // Upload each file
    for (const { full, rel } of files) {
      const remotePath = `${REMOTE_BASE}/${rel}`;
      const dirPath = remotePath.substring(0, remotePath.lastIndexOf('/'));
      await sshCmd(`mkdir -p ${dirPath}`);
      const content = readFileSync(full);
      // Use base64 to avoid shell escaping issues
      const b64 = content.toString('base64');
      await sshCmd(`echo '${b64}' | base64 -d > ${remotePath}`);
      process.stdout.write('.');
    }
    console.log('\nAll files uploaded!');

    // Install deps and build on VPS
    console.log('Installing deps...');
    let out = await sshCmd(`cd ${REMOTE_BASE} && npm install 2>&1 | tail -5`);
    console.log('npm install:', out.trim().split('\n').slice(-2).join('\n'));

    // Build
    console.log('Building...');
    out = await sshCmd(`cd ${REMOTE_BASE} && npm run build 2>&1 | tail -10`);
    console.log('build:', out.trim().split('\n').slice(-5).join('\n'));

    // Start with serve or pm2
    console.log('Installing serve...');
    await sshCmd(`npm install -g serve 2>&1 | tail -2`);
    await sshCmd(`pm2 delete basekit-fe 2>/dev/null; echo "clean"`);
    out = await sshCmd(`cd ${REMOTE_BASE} && pm2 start npx -- serve -s .next -l 3000 --name basekit-fe 2>&1`);
    console.log('Serve started:', out.trim().split('\n').slice(-3).join('\n'));

    await new Promise(r => setTimeout(r, 3000));
    out = await sshCmd('curl -s http://localhost:3000 | head -3');
    console.log('Preview test:', out.trim().substring(0, 80));

    console.log('\n✅ Frontend preview ready at: http://43.156.81.44:3000');

  } catch (err) {
    console.error('\nError:', err.message);
  } finally {
    conn.end();
  }
});

function sshCmd(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { reject(err); return; }
      let out = '', errOut = '';
      stream.on('data', (d) => { out += d; });
      stream.stderr.on('data', (d) => { errOut += d; });
      stream.on('close', () => {
        if (errOut && !out) reject(new Error(errOut));
        else resolve(out);
      });
    });
  });
}

conn.on('error', (err) => {
  console.error('SSH error:', err);
  process.exit(1);
});

conn.connect(CONFIG);
