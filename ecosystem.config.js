module.exports = {
  apps: [
    {
      name: 'appmissao-backend',
      cwd: __dirname,
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        BASE_URL: 'https://cardapyia.com/',
        JWT_SECRET: 'lanchonete_bot_2024_jwt_secret_key_a8f9d2e1c4b7x9m3n6p8q2w5e7r9t1y4u6i8o0p3s5d7f9g2h4j6k8l1z3x5c7v9b2n4m6',
        JWT_EXPIRES_IN: '24h',
        DB_HOST: '69.62.88.115',
        DB_USER: 'wdscdfrdesdfrdfd',
        DB_PASSWORD: '719732Monica10@',
        DB_NAME: 'app',
        DB_PORT: 3306,
        MP_ACCESS_TOKEN: 'APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        MP_WEBHOOK_URL: 'https://api.seudominio.com/api/payments/mp/webhook',
        R2_ACCOUNT_ID: '5e23ea0ee33b534c24ef31372b96f4ec',
        R2_ACCESS_KEY_ID: '63efabdfcf8804068945dbcb7c61bcb8',
        R2_SECRET_ACCESS_KEY: 'd3443e434f900b585fbcba6550097af3b511d6568b643f652dd424fcfcdaa01b',
        R2_BUCKET: 'hanggu',
        R2_PUBLIC_BASE_URL: 'https://pub-8637875f54d2420cb2ddc40c5d2ab2b0.r2.dev',
        PAYMENT_DEPOSIT_PERCENT: 30,
        PAYMENT_SECOND_PERCENT: 75
      }
    },
    {
      name: 'appmissao-sftp-watch',
      cwd: __dirname,
      script: 'scripts/sftp-watch.js',
      env: {
        SFTP_HOST: '69.62.88.115',
        SFTP_PORT: 22,
        SFTP_USER: 'root',
        SFTP_PASSWORD: 'Monica100@irisMAR100@',
        SFTP_REMOTE_BASE: '/root/appmissao'
      }
    }
  ]
};