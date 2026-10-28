const sb=supabase.createClient(CFG.URL,CFG.KEY),$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fd=d=>d?new Date(d).toLocaleString('id-ID'):'belum pernah';
let P=[],N=[],cur='info';
function toast(t){const e=$('#toast');e.textContent=t;e.className='show';clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='',3500)}
async function check(){
  const {data}=await sb.rpc('is_admin');
  if(!data){await sb.auth.signOut();$('#login').hidden=false;$('#app').hidden=true;return toast('Akun ini bukan developer')}
  $('#login').hidden=true;$('#app').hidden=false;tab('info');
}
$('#go').onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('#e').value.trim(),password:$('#p').value});if(error)return toast('Login gagal');check()};
$('#out').onclick=async()=>{await sb.auth.signOut();location.reload()};
const T={
  async info(){
    const {data:s,error}=await sb.rpc('admin_stats');if(error){toast(error.message);return ''}
    return `<div class="stats">${[['Siswa',s.users],['Codingan',s.projects],['Codingan publik',s.public],['Total kunjungan',s.views],['Ukuran database',(s.db_bytes/1048576).toFixed(1)+' MB dari 500 MB (paket gratis)'],['Waktu server',fd(s.now)]].map(([a,b])=>`<div class="card"><b>${esc(b)}</b><span class="meta">${a}</span></div>`).join('')}</div>`;
  },
  async users(){
    const {data,error}=await sb.rpc('admin_users');if(error){toast(error.message);return ''}
    return `<div class="scroll"><table><tr><th>Username<th>Login terakhir<th>Codingan<th></tr>${data.map(u=>`<tr><td><b>${esc(u.username)}</b><br><span class="meta">daftar ${fd(u.created_at)}</span><td>${fd(u.last_sign_in)}<td>${u.total}<td><button class="btn danger sm" data-a="deluser" data-id="${u.id}">Hapus akun</button></tr>`).join('')}</table></div>`;
  },
  async code(){
    const {data,error}=await sb.from('projects').select('*').order('created_at',{ascending:false});if(error){toast(error.message);return ''}
    P=data;
    return `<input id="q" placeholder="Cari username atau judul"><div class="scroll"><table><tr><th>Siswa / judul<th>Status<th>Aksi</tr>${P.map(p=>`<tr data-s="${esc((p.username+' '+p.title+' '+(p.slug||'')).toLowerCase())}"><td><b>${esc(p.username)}</b>/${esc(p.slug||'-')}<br>${esc(p.title)}<td>${p.is_public?'Publik':'Pribadi'}<br>${p.views}x<td><div class="row" style="margin:0"><button class="btn sm alt" data-a="view" data-id="${p.id}">Lihat</button><button class="btn sm alt" data-a="ren" data-id="${p.id}">Rename</button><button class="btn sm" data-a="pub" data-id="${p.id}">${p.is_public?'Unpublik':'Publik'}</button><button class="btn sm danger" data-a="del" data-id="${p.id}">Hapus</button></div></tr>`).join('')}</table></div>`;
  },
  async news(){
    const {data}=await sb.from('announcements').select('*').order('id',{ascending:false});N=data||[];
    return `<div class="card"><input id="nm" placeholder="Tulis pengumuman untuk web siswa"><button class="btn" data-a="nadd">Tampilkan</button></div>${N.map(n=>`<div class="card"><p>${esc(n.message)}</p><p class="meta">${n.active?'Sedang tampil':'Nonaktif'}</p><div class="row"><button class="btn sm alt" data-a="ntog" data-id="${n.id}">${n.active?'Sembunyikan':'Tampilkan'}</button><button class="btn sm danger" data-a="ndel" data-id="${n.id}">Hapus</button></div></div>`).join('')}`;
  }
};
async function tab(t){
  cur=t;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  $('#main').innerHTML='<p class="empty">Memuat…</p>';$('#main').innerHTML=await T[t]();
}
document.querySelector('.tabs').onclick=e=>{const b=e.target.closest('button');if(b)tab(b.dataset.t)};
$('#main').oninput=e=>{if(e.target.id!=='q')return;const v=e.target.value.toLowerCase();document.querySelectorAll('tr[data-s]').forEach(r=>r.hidden=!r.dataset.s.includes(v))};
$('#main').onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;const a=b.dataset.a,id=b.dataset.id,p=P.find(x=>x.id===id);let r;
  if(a==='view'){const {data:fl}=await sb.from('files').select('path,size').eq('project_id',id).order('path');$('#vt').textContent=p.username+'/'+(p.slug||'-');$('#vh').textContent=(fl&&fl.length?fl.map(x=>x.path+'  ('+(x.size/1024).toFixed(1)+' KB)').join('\n'):'(tidak ada file)')+(p.html?'\n\n'+p.html:'');$('#vc').textContent=p.css;$('#vj').textContent=p.js;$('#vw').showModal();return}
  if(a==='ren'){const title=prompt('Judul baru:',p.title);if(!title)return;const s=(prompt('Nama link (kosongkan jika tidak diubah):',p.slug||'')||'').trim().toLowerCase();
    if(s&&!/^[a-z0-9-]{1,40}$/.test(s))return toast('Nama link tidak valid');r=await sb.from('projects').update(s?{title,slug:s}:{title}).eq('id',id)}
  if(a==='pub'){let patch={is_public:false};if(!p.is_public){const s=(prompt('Nama link:',p.slug||'')||'').trim().toLowerCase();if(!/^[a-z0-9-]{1,40}$/.test(s))return toast('Nama link tidak valid');patch={is_public:true,slug:s}}
    r=await sb.from('projects').update(patch).eq('id',id)}
  if(a==='del'){if(!confirm('Hapus codingan ini?'))return;r=await sb.from('projects').delete().eq('id',id)}
  if(a==='deluser'){if(!confirm('Hapus akun beserta semua codingannya?'))return;r=await sb.rpc('admin_delete_user',{uid:id})}
  if(a==='nadd'){const m=$('#nm').value.trim();if(!m)return;r=await sb.from('announcements').insert({message:m})}
  if(a==='ntog'){const n=N.find(x=>String(x.id)===id);r=await sb.from('announcements').update({active:!n.active}).eq('id',id)}
  if(a==='ndel'){r=await sb.from('announcements').delete().eq('id',id)}
  if(r){r.error?toast(r.error.message):(toast('Berhasil'),tab(cur))}
};
sb.auth.getSession().then(({data})=>{if(data.session)check()});
