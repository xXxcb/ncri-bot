module.exports = {
  apps: [
    {
      name: 'ncri-bot',
      script: 'serve.js',
      cron_restart: '10 7 * * 1-5',
      autorestart: false,
      max_restarts: 3,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        HEADLESS: 'true',
      },
    },
  ],
};
