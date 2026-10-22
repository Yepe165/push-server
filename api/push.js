// Argo Tookee — server notifikasi push (Vercel Serverless Function)
// Dipanggil otomatis oleh aplikasi Pantau/Petugas/Supir setiap kali pesan chat atau panggilan terkirim.
const webpush = require('web-push');

const FB  = String(process.env.FIREBASE_URL || 'https://argo-tookee-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/+$/, '');
const PUB = process.env.VAPID_PUBLIC;
const PRV = process.env.VAPID_PRIVATE;
const SUB = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (PUB && PRV) webpush.setVapidDetails(SUB, PUB, PRV);

const okG = g => /^[A-Z0-9-]{1,40}$/.test(g);
const okK = k => typeof k === 'string' && k.length > 0 && k.length <= 120;

async function getSubs(g, role, k) {
  const url = `${FB}/pantau/${encodeURIComponent(g)}/push/${role}/${encodeURIComponent(k)}.json`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  return d && d.endpoint && d.keys ? { url, sub: { endpoint: d.endpoint, keys: d.keys } } : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, ready: !!(PUB && PRV) });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!PUB || !PRV) return res.status(500).json({ ok: false, err: 'VAPID_PUBLIC / VAPID_PRIVATE belum diisi di Vercel' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || !okG(b.g) || !okK(b.k) || (b.to !== 'p' && b.to !== 'o')) return res.status(400).json({ ok: false, err: 'data tidak valid' });

  const payload = JSON.stringify({
    title: String(b.title || 'Argo Tookee').slice(0, 80),
    body:  String(b.body  || '').slice(0, 140),
    tag:   String(b.tag   || 'msg').slice(0, 30),
    call:  !!b.call
  });

  // Penerima: pemilik = push/o/_ ; petugas/supir = push/p/<kunci> atau push/s/<kunci>
  const roles = b.to === 'o' ? ['o'] : ['p', 's'];
  let sent = 0;
  await Promise.all(roles.map(async role => {
    try {
      const f = await getSubs(b.g, role, b.k);
      if (!f) return;
      try {
        await webpush.sendNotification(f.sub, payload, { TTL: b.call ? 60 : 86400, urgency: 'high' });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) fetch(f.url, { method: 'DELETE' }).catch(() => {});
      }
    } catch (e) {}
  }));
  return res.status(200).json({ ok: true, sent });
};
