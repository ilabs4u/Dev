#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
console.log('Exporting patches...');
fs.mkdirSync(path.join(__dirname, '../patches'), { recursive: true });
try {
  execSync('git format-patch HEAD~1 -o patches/', { cwd: path.join(__dirname, '..') });
} catch(e) {}
console.log('Patches exported.');
