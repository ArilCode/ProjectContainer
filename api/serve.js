const enc = encodeURIComponent;
module.exports = async (req, res) => {
  const { user, slug } = req.query;
  let path = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path || '');
  if (!path || path.includes('$1') || path.includes(':path')) { // cadangan: ambil dari URL asli
    const u = (req.url || '').split('?')[0], pre = `/${user}/${slug}/`;
    try { path = u.startsWith(pre) ? decodeURIComponent(u.slice(pre.length)) : ''; } catch (e) { path = ''; }
  }
  path = path.replace(/^\/+/, '');
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const h = { apikey: key, Authorization: 'Bearer ' + key };
  const get = async u => { const r = await fetch(`${base}/rest/v1/${u}`, { headers: h }); return r.ok ? r.json() : []; };
  res.setHeader('Access-Control-Allow-Origin', '*');
  const [p] = await get(`projects?select=id,html,css,js&username=eq.${enc(user)}&slug=eq.${enc(slug)}&is_public=eq.true&limit=1`);
  const nf = () => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.status(404).end('<meta name="viewport" content="width=device-width"><h1>404</h1><p>File tidak ditemukan atau proyek belum dipublikasikan.</p>'); };
  if (!p) return nf();
  if (!path || path.endsWith('/')) path += 'index.html';
  const q = pt => get(`files?select=content,mime,is_b64&project_id=eq.${p.id}&path=eq.${enc(pt)}&limit=1`);
  let [f] = await q(path);
  if (!f && !/\.[a-z0-9]+$/i.test(path)) { path += '/index.html'; [f] = await q(path); }
  if (!f && path === 'index.html' && (p.html || p.css || p.js)) { // proyek versi lama
    let html = p.html || '';
    if (p.css) { const t = `<style>${p.css}</style>`; html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => t + '</head>') : t + html; }
    if (p.js) { const t = `<script>${p.js.replace(/<\/script/gi, '<\\/script')}</script>`; html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => t + '</body>') : html + t; }
    f = { content: html, mime: 'text/html', is_b64: false };
  }
  if (!f) return nf();
  const isHtml = f.mime === 'text/html';
  let body = f.is_b64 ? Buffer.from(f.content, 'base64') : f.content;
  if (isHtml) {
    if (path === 'index.html') await fetch(`${base}/rest/v1/rpc/increment_views`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ u: user, s: slug }) }).catch(() => {});
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1).split('/').map(enc).join('/') : '';
    if (!/<base[\s>]/i.test(body)) { const t = `<base href="/${user}/${slug}/${dir}">`; body = /<head(\s[^>]*)?>/i.test(body) ? body.replace(/<head(\s[^>]*)?>/i, m => m + t) : t + body; }
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-modals allow-popups');
  }
  const text = !f.is_b64;
  res.setHeader('Content-Type', f.mime + (text ? '; charset=utf-8' : ''));
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).end(body);
};
