// PM2-конфиг для админки. Запуск: pm2 start ecosystem.config.cjs --env production
// Секреты задаются в admin/.env (не здесь и не в git).
module.exports = {
  apps: [
    {
      name: 'trust-admin',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: './logs/admin-out.log',
      error_file: './logs/admin-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
