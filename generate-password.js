#!/usr/bin/env node

/**
 * Password Hash Generator for LAN Jukebox
 *
 * Usage: node generate-password.js <your-password>
 *
 * This script generates a bcrypt hash that can be used in config.json
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
    console.error('Usage: node generate-password.js <your-password>');
    console.error('Example: node generate-password.js mySecretPassword123');
    process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err);
        process.exit(1);
    }
    console.log('\nGenerated password hash:');
    console.log(hash);
    console.log('\nAdd this to your config.json as "passwordHash"');
});
