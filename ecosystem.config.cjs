module.exports = {
  apps: [
    {
      name: 'dollybot-scanner',
      script: './src/scanner/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: './.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/scanner-error.log',
      out_file: './logs/scanner-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'dollybot-evaluation',
      script: './src/evaluation/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: './.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/evaluation-error.log',
      out_file: './logs/evaluation-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'dollybot-api',
      script: './src/api/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: './.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
