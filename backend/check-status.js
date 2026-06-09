import { Client } from 'ssh2';

const CONFIG = {
  host: '43.156.81.44',
  port: 22,
  username: 'ubuntu',
  password: 'comet-79@-quantum',
};

const conn = new Client();
conn.on('ready', async () => {
  try {
    const ssh = (cmd) => new Promise((resolve, reject) => {
      conn.exec(cmd, (err, stream) => {
        if (err) { reject(err); return; }
        let out = '';
        stream.on('data', d => { out += d; });
        stream.on('close', () => resolve(out));
      });
    });

    // Check PM2 logs
    const logs = await ssh('pm2 logs basekit-fe --lines 20 --nostream 2>&1');
    console.log('PM2 logs:', logs.substring(0, 1000));

    // Check if port 3000 is listening
    const netstat = await ssh('ss -tlnp | grep 3000 2>&1');
    console.log('Port 3000:', netstat.trim() || 'not listening');

    // Try serve directly
    const checkServe = await ssh('cd /home/ubuntu/basekit-frontend && ls .next/');
    console.log('.next contents:', checkServe.trim());

    // Check serve process
    const serveCheck = await ssh('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/');
    console.log('Local curl:', serveCheck.trim());

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.end();
  }
});
conn.connect(CONFIG);
