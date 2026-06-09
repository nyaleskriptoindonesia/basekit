import { Client } from 'ssh2';

const CONFIG = {
  host: '43.156.81.44',
  port: 22,
  username: 'ubuntu',
  password: 'comet-79@-quantum',
};
const REMOTE_DIR = '/home/ubuntu/basekit-frontend';

const conn = new Client();
conn.on('ready', async () => {
  const ssh = (cmd) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { reject(err); return; }
      let out = '', errOut = '';
      stream.on('data', d => { out += d; });
      stream.stderr.on('data', d => { errOut += d; });
      stream.on('close', () => {
        if (errOut && !out.trim()) reject(new Error(errOut));
        else resolve(out);
      });
    });
  });

  try {
    // Delete old process
    await ssh('pm2 delete basekit-fe 2>/dev/null; echo "cleaned"');

    // Start with next start via pm2
    const startCmd = `cd ${REMOTE_DIR} && pm2 start npm --name "basekit-fe" -- start --prefix ${REMOTE_DIR} 2>&1`;
    let out = await ssh(startCmd);
    console.log('PM2 start:', out.trim().split('\n').slice(-5).join('\n'));

    await new Promise(r => setTimeout(r, 8000));

    // Check status
    out = await ssh('pm2 status basekit-fe 2>&1');
    console.log('Status:', out.trim());

    out = await ssh('curl -s -o /dev/null -w "HTTP:%{http_code}" http://localhost:3000/ 2>&1');
    console.log('HTTP test:', out.trim());

    out = await ssh('ss -tlnp | grep 3000');
    console.log('Port 3000:', out.trim() || 'still not listening');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.end();
  }
});
conn.on('error', err => { console.error('SSH error:', err); process.exit(1); });
conn.connect(CONFIG);
