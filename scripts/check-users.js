const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.systemUser.findMany({ select: { username: true, password: true } })
  .then(users => {
    console.log('Current users in DB:');
    users.forEach(u => {
      const masked = u.password.startsWith('pbkdf2$') ? '[HASHED - ' + u.password.length + ' chars]' : '[PLAINTEXT: ' + u.password + ']';
      console.log(`  ${u.username}: ${masked}`);
    });
    return p.$disconnect();
  })
  .catch(e => { console.error(e); process.exit(1); });
