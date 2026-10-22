// Jalankan sekali: node buat-kunci.js   (perlu: npm install web-push)
const k = require('web-push').generateVAPIDKeys();
console.log('VAPID_PUBLIC =', k.publicKey);
console.log('VAPID_PRIVATE =', k.privateKey);
