export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const masterPass = process.env.PASS || '#flutter';

  if (req.method === 'POST') {
    const { password } = req.body || {};
    if (password === masterPass) {
      return res.status(200).json({ success: true, message: 'Authenticated' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid Password' });
    }
  }

  return res.status(200).json({ status: 'OpenSoftwares Admin Auth Service Ready' });
}
