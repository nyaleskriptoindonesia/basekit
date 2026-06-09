import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const conn = new Client();
const config = {
  host: '43.156.81.44',
  port: 22,
  username: 'ubuntu',
  password: 'comet-79@-quantum',
};

const files = [
  'package.json',
  'server.js',
];

const remoteDir = '/home/ubuntu/basekit';

conn.on('ready', () => {
  console.log('Connected to VPS');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }

    const upload = (i) => {
      if (i >= files.length) {
        console.log('All files uploaded!');
        conn.end();
        return;
      }
      const local = join(__dirname, files[i]);
      const remote = `${remoteDir}/${files[i]}`;
      sftp.fastPut(local, remote, (e) => {
        if (e) { console.error(`Upload error ${files[i]}:`, e); conn.end(); return; }
        console.log(`Uploaded: ${files[i]} → ${remote}`);
        upload(i + 1);
      });
    };
    upload(0);
  });
});

conn.on('error', (err) => {
  console.error('SSH error:', err);
  process.exit(1);
});

conn.connect(config);
