#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const zipFile = 'lambda.zip';
const files = [
  'lambda.js',
  'server.js',
  'package.json',
  'package-lock.json',
  'config',
  'routes',
  'services',
  'utils',
  'templates',
  'migrations',
  'brandingAssets',
  'scripts/migrate.js',
  'node_modules'
];

try {
  execSync('npm ci --omit=dev', { stdio: 'inherit' });

  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }
  if (process.platform === 'win32') {
    const psCommand = `Compress-Archive -Path ${files.map(f => `'${f}'`).join(',')} -DestinationPath '${zipFile}' -Force`;
    execSync(`powershell.exe -Command "${psCommand}"`, { stdio: 'inherit' });
  } else {
    execSync(`zip -r ${zipFile} ${files.join(' ')}`, { stdio: 'inherit' });
  }

  console.log(`Created ${zipFile}`);
} catch (err) {
  console.error('Failed to package lambda:', err);
  process.exit(1);
}
