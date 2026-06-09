import { Client } from 'ssh2';

const VPS_HOST = '43.156.81.44';
const VPS_USER = 'ubuntu';
const VPS_PASS = 'I love coding123';

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to VPS');
  conn.exec('cat /home/ubuntu/basekit/.env 2>/dev/null || cat /home/ubuntu/basekit/backend/.env 2>/dev/null', (err, stream) => {
    if (err) { console.error('exec error:', err); conn.end(); return; }
    let data = '';
    stream.on('data', d => { data += d.toString(); });
    stream.stderr.on('data', d => { process.stderr.write(d.toString()); });
    stream.on('close', () => {
      console.log(data);
      conn.end();
    });
  });
}).on('error', err => {
  console.error('SSH connection error:', err.message);
}).connect({
  host: VPS_HOST,
  port: 22,
  username: VPS_USER,
  password: VPS_PASS,
  // Accept any host key
  readyTimeout: 15000,
  debug: (msg) => { /* suppress debug output */ }
});
