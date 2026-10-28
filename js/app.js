const sb=supabase.createClient(CFG.URL,CFG.KEY),$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TEXT=['html','htm','css','js','mjs','json','txt','md','svg','xml','csv'];
const MIME={html:'text/html',htm:'text/html',css:'text/css',js:'text/javascript',mjs:'text/javascript',json:'application/json',txt:'text/plain',md:'text/plain',svg:'image/svg+xml',xml:'application/xml',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',ico:'image/x-icon',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',pdf:'application/pdf'};
let me=null,projs=[],P=null,F=[],cd='',vdirs=new Set(),mode='login',repl=null;
const norm=p=>String(p||'').replace(/\\/g,'/').split('/').map(s=>s.trim()).filter(s=>s&&s!=='.'&&s!=='..').join('/');
const ext=p=>(p.split('.').pop()||'').toLowerCase();
const kb=n=>n<1024?n+' B':(n/1024).toFixed(1)+' KB';
function toast(t){const e=$('#toast');e.textContent=t;e.className='show';clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='',3500)}
function view(v){for(const s of['auth','home','proj'])$('#'+s).hidden=s!==v;$('#userbox').hidden=v==='auth'}
async function start(){
  const {data}=await sb.auth.getSession();
  data.session?await enter(data.session.user):view('auth');
  const {data:a}=await sb.from('announcements').select('message').eq('active',true).order('id',{ascending:false}).limit(1);
  if(a&&a[0]){$('#note').textContent=a[0].message;$('#note').hidden=false}
}
async function enter(u){
  const {data}=await sb.from('profiles').select('username').eq('id',u.id).single();
  if(!data){await sb.auth.signOut();return view('auth')}
  me={id:u.id,name:data.username};$('#who').textContent=me.name;loadProjs();
}
async function loadProjs(){
  const {data,error}=await sb.from('projects').select('id,title,slug,is_public,views,files(count)').eq('user_id',me.id).order('created_at',{ascending:false});
  if(error)return toast(error.message);projs=data;
  $('#grid').innerHTML=projs.map(p=>`<button class="pc" data-id="${p.id}"><span class="tab"></span><b>${esc(p.title)}</b><small>${p.files?.[0]?.count||0} file, ${p.is_public?'publik':'pribadi'}</small></button>`).join('')+'<button class="pc add" id="new">+ Proyek baru</button>';
  view('home');
}
$('#grid').onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='new'){
    const title=(prompt('Judul proyek:')||'').trim();if(!title)return;
    const {data,error}=await sb.from('projects').insert({title,user_id:me.id,username:me.name}).select('id,title,slug,is_public,views').single();
    if(error)return toast(error.message);projs.unshift(data);return openProj(data.id);
  }
  openProj(b.dataset.id);
};
async function openProj(id){P=projs.find(x=>x.id===id);cd='';vdirs=new Set();await loadFiles();view('proj');drawProj()}
async function loadFiles(){const {data,error}=await sb.from('files').select('id,path,mime,size').eq('project_id',P.id).order('path');if(error)toast(error.message);F=data||[]}
function drawProj(){
  $('#pt').textContent=P.title;
  const url=`${CFG.SITE}/${me.name}/${P.slug}/`;
  $('#pl').innerHTML=P.is_public?`Publik, ${P.views||0} kunjungan<a class="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`:'Pribadi, belum bisa dilihat orang lain';
  $('#ppub').textContent=P.is_public?'Jadikan pribadi':'Publikasikan';
  const segs=cd.split('/').filter(Boolean);
  $('#crumbs').innerHTML=`<button data-c="0">Folder utama</button>`+segs.map((s,i)=>` / <button data-c="${i+1}">${esc(s)}</button>`).join('');
  $('#rmd').hidden=!cd;
  const dirs=new Map(),files=[];
  for(const f of F){if(!f.path.startsWith(cd))continue;const r=f.path.slice(cd.length),i=r.indexOf('/');i<0?files.push({...f,name:r}):dirs.set(r.slice(0,i),1)}
  for(const v of vdirs)if(v.startsWith(cd)&&v!==cd)dirs.set(v.slice(cd.length).split('/')[0],1);
  const ds=[...dirs.keys()].sort();
  $('#files').innerHTML=(ds.length||files.length)?ds.map(d=>`<div class="fr dir" data-d="${esc(d)}"><span class="chip d">folder</span><span class="nm">${esc(d)}</span></div>`).join('')+files.map(f=>`<div class="fr"><span class="chip">${esc(ext(f.name))}</span><span class="nm">${esc(f.name)}</span><span class="sz">${kb(f.size)}</span><div class="row"><button class="btn sm alt" data-a="rep" data-id="${f.id}">Ganti file</button><button class="btn sm alt" data-a="mv" data-id="${f.id}">Ubah nama</button><button class="btn sm danger" data-a="del" data-id="${f.id}">Hapus</button></div></div>`).join(''):'<p class="empty">Folder ini kosong. Upload file atau folder untuk mulai.</p>';
  $('#hint').textContent=F.some(f=>f.path==='index.html')?'':'Halaman awal proyek memakai file bernama index.html di folder utama.';
}
$('#back').onclick=loadProjs;
$('#crumbs').onclick=e=>{const b=e.target.closest('button');if(!b)return;cd=cd.split('/').filter(Boolean).slice(0,+b.dataset.c).join('/');cd=cd?cd+'/':'';drawProj()};
$('#files').onclick=async e=>{
  const b=e.target.closest('button');
  if(!b){const d=e.target.closest('[data-d]');if(d){cd+=d.dataset.d+'/';drawProj()}return}
  const f=F.find(x=>x.id===b.dataset.id),a=b.dataset.a;
  if(a==='rep'){repl=f;$('#fr').click()}
  if(a==='mv'){
    const np=norm(prompt('Nama baru atau lokasi (contoh: gambar/foto.png):',f.path));if(!np||np===f.path)return;
    const {error}=await sb.from('files').update({path:np,mime:MIME[ext(np)]||f.mime}).eq('id',f.id);
    error?toast(error.code==='23505'?'Nama itu sudah dipakai file lain':error.message):(await loadFiles(),drawProj());
  }
  if(a==='del'&&confirm(`Hapus ${f.path}?`)){const {error}=await sb.from('files').delete().eq('id',f.id);error?toast(error.message):(await loadFiles(),drawProj())}
};
const b64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=no;r.readAsDataURL(f)});
async function putFile(path,f){
  if(f.size>2097152)return `${path}: lebih dari 2 MB`;
  const x=ext(path),text=TEXT.includes(x);
  const row={project_id:P.id,path,mime:MIME[x]||f.type||'application/octet-stream',is_b64:!text,content:text?await f.text():await b64(f),size:f.size,updated_at:new Date().toISOString()};
  const {error}=await sb.from('files').upsert(row,{onConflict:'project_id,path'});
  return error?`${path}: ${error.message}`:null;
}
async function upload(list){
  const errs=[];let i=0;
  for(const f of list){
    toast(`Mengunggah ${++i} dari ${list.length}`);
    const rel=f.webkitRelativePath?f.webkitRelativePath.split('/').slice(1).join('/'):f.name;
    const path=norm(cd+rel);if(!path){continue}
    const e=await putFile(path,f);if(e)errs.push(e);
  }
  await loadFiles();drawProj();
  toast(errs.length?`${errs.length} file gagal: ${errs[0]}`:'Selesai diunggah');
}
$('#upf').onclick=()=>$('#fi').click();$('#upd').onclick=()=>$('#fo').click();
$('#fi').onchange=e=>{const l=[...e.target.files];e.target.value='';if(l.length)upload(l)};
$('#fo').onchange=e=>{const l=[...e.target.files];e.target.value='';if(l.length)upload(l)};
$('#fr').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f||!repl)return;
  const er=await putFile(repl.path,f);repl=null;await loadFiles();drawProj();toast(er||'File diganti');
};
$('#mkd').onclick=()=>{const n=norm(prompt('Nama folder baru:'));if(!n)return;vdirs.add(cd+n+'/');cd+=n+'/';drawProj()};
$('#rmd').onclick=async()=>{
  if(!confirm(`Hapus folder ini beserta semua isinya?`))return;
  const ids=F.filter(f=>f.path.startsWith(cd)).map(f=>f.id);
  if(ids.length){const {error}=await sb.from('files').delete().in('id',ids);if(error)return toast(error.message)}
  for(const v of [...vdirs])if(v.startsWith(cd))vdirs.delete(v);
  cd=cd.split('/').filter(Boolean).slice(0,-1).join('/');cd=cd?cd+'/':'';await loadFiles();drawProj();
};
$('#pren').onclick=async()=>{
  const title=(prompt('Judul baru:',P.title)||'').trim();if(!title)return;
  const {error}=await sb.from('projects').update({title}).eq('id',P.id);error?toast(error.message):(P.title=title,drawProj());
};
$('#ppub').onclick=async()=>{
  let patch={is_public:false};
  if(!P.is_public){
    const s=(prompt('Nama link (huruf kecil, angka, strip):',P.slug||'')||'').trim().toLowerCase();if(!s)return;
    if(!/^[a-z0-9-]{1,40}$/.test(s))return toast('Nama link hanya boleh huruf kecil, angka, dan strip');
    patch={is_public:true,slug:s};
  }
  const {error}=await sb.from('projects').update(patch).eq('id',P.id);
  if(error)return toast(error.code==='23505'?'Nama link sudah dipakai, coba nama lain':error.message);
  Object.assign(P,patch);toast(patch.is_public?'Dipublikasikan':'Jadi pribadi');drawProj();
};
$('#pdel').onclick=async()=>{
  if(!confirm(`Hapus proyek "${P.title}" beserta semua filenya?`))return;
  const {error}=await sb.from('projects').delete().eq('id',P.id);error?toast(error.message):(toast('Dihapus'),loadProjs());
};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{mode=b.dataset.t;document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));$('#go').textContent=mode==='login'?'Masuk':'Daftar'});
$('#go').onclick=async()=>{
  const u=$('#u').value.trim().toLowerCase(),pw=$('#p').value;
  if(!/^[a-z0-9_-]{3,20}$/.test(u))return toast('Username 3-20 karakter: huruf kecil, angka, _ atau -');
  if(pw.length<6)return toast('Password minimal 6 karakter');
  const email=u+'@siswa-ac.com';let r;
  if(mode==='reg'){
    const {data:free}=await sb.rpc('username_free',{u});if(!free)return toast('Username sudah dipakai');
    r=await sb.auth.signUp({email,password:pw});if(r.error)return toast(r.error.message);
    const {error}=await sb.from('profiles').insert({id:r.data.user.id,username:u});if(error)return toast('Username tidak boleh dipakai, coba yang lain');
  }else{r=await sb.auth.signInWithPassword({email,password:pw});if(r.error)return toast('Username atau password salah')}
  await enter(r.data.user);
};
$('#out').onclick=async()=>{await sb.auth.signOut();me=null;view('auth')};
start();
