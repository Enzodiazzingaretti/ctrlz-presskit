#!/usr/bin/env node
/* Genera las variables de entorno del panel.
   Uso:  node scripts/hash-password.js
   La contraseña no se guarda en ningún archivo ni sale de tu máquina. */

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Contraseña para el panel: ', (password) => {
  rl.close();

  const pw = String(password || '').trim();
  if (pw.length < 10) {
    console.error('\nUsá al menos 10 caracteres.');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32);
  const hash = 'scrypt$' + salt.toString('base64') + '$' + key.toString('base64');
  const secret = crypto.randomBytes(32).toString('base64url');

  console.log('\nPegá estas variables en Vercel → Settings → Environment Variables:\n');
  console.log('ADMIN_PASSWORD_HASH');
  console.log(hash + '\n');
  console.log('SESSION_SECRET');
  console.log(secret + '\n');
  console.log('GITHUB_TOKEN');
  console.log('<fine-grained token con Contents: Read and write sobre este repo>\n');
  console.log('Después redeployá el proyecto para que tomen efecto.');
});
