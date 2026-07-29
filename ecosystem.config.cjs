module.exports = {
  apps: [
    {
      name: 'yukbozor',
      cwd: '/home/uz-user/yukbozor',
      script: '/home/uz-user/yukbozor/dist/index.cjs',
      instances: 1,
      exec_mode: 'fork',
      env_file: '/home/uz-user/yukbozor/.env',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
        AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || ''
      },
      error_file: '/home/uz-user/.pm2/logs/yukbozor-error.log',
      out_file: '/home/uz-user/.pm2/logs/yukbozor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '1G',
      restart_delay: 3000,
      autorestart: true,
      watch: false
    }
  ]
};
