/**
 * scripts/hash-passwords.js
 * 
 * Có 2 chức năng:
 *   1. Hash 1 password nhập từ command line:
 *      node scripts/hash-passwords.js <password>
 *
 *   2. Migrate toàn bộ plain-text passwords trong data/users.json:
 *      node scripts/hash-passwords.js --migrate
 */

const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const SALT_ROUNDS = 12;
const USERS_FILE = path.join(__dirname, '../data/users.json');

// ── Hàm hash 1 password ──
async function hashPassword(plainText) {
  if (!plainText) {
    console.error('❌ Vui lòng nhập password. Ví dụ: node scripts/hash-passwords.js mypassword123');
    process.exit(1);
  }
  const hash = await bcrypt.hash(plainText, SALT_ROUNDS);
  console.log('\n✅ Bcrypt Hash (copy vào users.json):');
  console.log('─'.repeat(65));
  console.log(hash);
  console.log('─'.repeat(65) + '\n');
}

// ── Hàm migrate toàn bộ users.json ──
async function migratePasswords() {
  console.log('[MIGRATE] Đang đọc users.json...');
  const content = fs.readFileSync(USERS_FILE, 'utf8');
  const users = JSON.parse(content);

  let changed = 0;
  for (const user of users) {
    if (user.password && !user.password.startsWith('$2b$')) {
      console.log(`[MIGRATE] Hashing password cho user: ${user.username}`);
      user.password = await bcrypt.hash(user.password, SALT_ROUNDS);
      changed++;
    } else {
      console.log(`[MIGRATE] User "${user.username}" đã có bcrypt hash, bỏ qua.`);
    }
  }

  if (changed > 0) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`\n✅ Đã hash ${changed} password và lưu lại users.json.`);
  } else {
    console.log('\nℹ️  Không có password nào cần migrate.');
  }
}

// ── Entry point ──
const arg = process.argv[2];

if (arg === '--migrate') {
  migratePasswords().catch(err => { console.error('[MIGRATE] Lỗi:', err); process.exit(1); });
} else if (arg) {
  hashPassword(arg).catch(err => { console.error('Lỗi:', err); process.exit(1); });
} else {
  console.log(`
Cách dùng:
  Hash 1 password:         node scripts/hash-passwords.js <password>
  Migrate toàn bộ users:   node scripts/hash-passwords.js --migrate

Ví dụ:
  node scripts/hash-passwords.js MyPassword@123
  node scripts/hash-passwords.js --migrate
`);
}
