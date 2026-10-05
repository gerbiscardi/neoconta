const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Starting One-Time Password Hashing Migration ---');
  
  // 1. Migrate in SQLite / Prisma DB
  const dbUsers = await prisma.user.findMany();
  console.log(`Found ${dbUsers.length} users in Prisma SQLite DB`);

  let upgradedDbCount = 0;
  for (const u of dbUsers) {
    if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$') && !u.password.startsWith('$2y$')) {
      const hash = await bcrypt.hash(u.password, 10);
      await prisma.user.update({
        where: { id: u.id },
        data: { password: hash }
      });
      upgradedDbCount++;
      console.log(`✓ Upgraded password for Prisma user: ${u.email} (${u.id})`);
    } else {
      console.log(`• User already has bcrypt hash in Prisma: ${u.email}`);
    }
  }

  // 2. Migrate in data/users.json if exists
  const usersJsonPath = path.join(__dirname, '..', 'data', 'users.json');
  if (fs.existsSync(usersJsonPath)) {
    try {
      const raw = fs.readFileSync(usersJsonPath, 'utf8');
      const usersList = JSON.parse(raw);
      let upgradedJsonCount = 0;

      for (const u of usersList) {
        if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$') && !u.password.startsWith('$2y$')) {
          u.password = await bcrypt.hash(u.password, 10);
          upgradedJsonCount++;
        }
      }

      fs.writeFileSync(usersJsonPath, JSON.stringify(usersList, null, 2), 'utf8');
      console.log(`✓ Upgraded ${upgradedJsonCount} users in data/users.json`);
    } catch (e) {
      console.error('Error reading/updating users.json:', e);
    }
  }

  console.log(`\nMigration completed successfully! Upgraded ${upgradedDbCount} DB users.`);
  await prisma.$disconnect();
}

migrate().catch(async (e) => {
  console.error('Migration failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
