import { Client } from 'ssh2';
import { createReadStream, createWriteStream } from 'fs';

const CONFIG = {
  host: '43.156.81.44',
  port: 22,
  username: 'ubuntu',
  password: 'comet-79@-quantum',
};
const REMOTE_BASE = '/home/ubuntu/basekit-frontend';
const LOCAL_TAR = '/tmp/basekit-frontend.tar.gz';
const API_URL = 'http://43.156.81.44:3001';
const WC_PROJECT_ID = '580d8bcc3535aeb83c7a32817de32d8e';

const conn = new Client();

const ssh = (conn, cmd) => new Promise((resolve, reject) => {
  conn.exec(cmd, (err, stream) => {
    if (err) { reject(err); return; }
    let out = '', errOut = '';
    stream.on('data', (d) => { out += d; });
    stream.stderr.on('data', (d) => { errOut += d; });
    stream.on('close', () => {
      if (errOut && !out.trim()) reject(new Error(errOut));
      else resolve(out);
    });
  });
});

conn.on('ready', async () => {
  console.log('SSH connected');

  try {
    // Prepare remote dir
    await ssh(conn, `mkdir -p ${REMOTE_BASE} && echo "dir ready"`);
    console.log('Remote dir ready');

    // Upload tar via SFTP
    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) { reject(err); return; }
        sftp.fastPut(LOCAL_TAR, `${REMOTE_BASE}/frontend.tar.gz`, (e) => {
          if (e) reject(e);
          else { console.log('Tar uploaded!'); resolve(); }
        });
      });
    });

    // Extract
    console.log('Extracting...');
    let out = await ssh(conn, `cd ${REMOTE_BASE} && tar -xzf frontend.tar.gz && echo "extracted"`);
    console.log('Extracted:', out.trim());

    // Write .env.local
    const envLocal = `NEXT_PUBLIC_API_URL=${API_URL}\nNEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${WC_PROJECT_ID}\n`;
    out = await ssh(conn, `cat > ${REMOTE_BASE}/.env.local << 'ENVEOF'\n${envLocal}ENVEOF\ncat ${REMOTE_BASE}/.env.local`);
    console.log('.env.local:\n', out.trim());

    // Install deps
    console.log('Installing deps...');
    out = await ssh(conn, `cd ${REMOTE_BASE} && npm install 2>&1 | tail -5`);
    console.log(out.trim().split('\n').slice(-3).join('\n'));

    // Build
    console.log('Building...');
    out = await ssh(conn, `cd ${REMOTE_BASE} && npm run build 2>&1 | tail -15`);
    console.log(out.trim().split('\n').slice(-8).join('\n'));

    // Start with serve
    console.log('Starting preview server...');
    await ssh(conn, `npm install -g serve 2>&1 | tail -2`);
    await ssh(conn, `pm2 delete basekit-fe 2>/dev/null; echo "cleaned"`);
    out = await ssh(conn, `cd ${REMOTE_BASE} && pm2 start npx -- serve -s .next -l 3000 --name basekit-fe 2>&1`);
    console.log('PM2:', out.trim().split('\n').slice(-4).join('\n'));

    await new Promise(r => setTimeout(r, 5000));
    out = await ssh(conn, 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/');
    console.log('HTTP status:', out.trim());

    console.log('\n✅ Frontend preview: http://43.156.81.44:3000');
    console.log('✅ Backend API: http://43.156.81.44:3001');

  } catch (err) {
    console.error('\nError:', err.message);
  } finally {
    conn.end();
  }
});

conn.on('error', (err) => {
  console.error('SSH error:', err);
  process.exit(1);
});

conn.connect(CONFIG);
