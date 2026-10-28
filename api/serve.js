module.exports = async (req, res) => {
  const { user, slug } = req.query;
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const h = { apikey: key, Authorization: 'Bearer ' + key };
  const r = await fetch(`${base}/rest/v1/projects?select=html,css,js&username=eq.${encodeURIComponent(user)}&slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&limit=1`, { headers: h });
  const [p] = r.ok ? await r.json() : [];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!p) return res.status(404).end('<meta name="viewport" content="width=device-width"><h1>404</h1><p>Codingan tidak ditemukan atau belum dipublikasikan.</p>');
  await fetch(`${base}/rest/v1/rpc/increment_views`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ u: user, s: slug }) }).catch(() => {});
  let html = p.html || '';
  if (p.css) { const t = `<style>${p.css}</style>`; html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => t + '</head>') : t + html; }
  if (p.js) { const t = `<script>${p.js.replace(/<\/script/gi, '<\\/script')}</script>`; html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => t + '</body>') : html + t; }
  // sandbox: kode siswa tidak bisa mengakses login/sesi situs utama
  res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-modals allow-popups');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).end(html);
};
