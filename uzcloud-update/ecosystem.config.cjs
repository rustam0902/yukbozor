const fs = require('fs');
const path = require('path');

// Load .env file manually for Node.js < 20
const envPath = path.join('/home/uz-user/yukbozor', '.env');
const env = { NODE_ENV: 'production' };

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        env[key] = value;
      }
    }
  });
}

module.exports = {
  apps: [{
    name: 'yukbozor',
    script: 'npx',
    args: 'tsx server/index.ts',
    cwd: '/home/uz-user/yukbozor',
    env: env,
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
