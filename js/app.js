const sb=supabase.createClient(CFG.URL,CFG.KEY),$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,rows=[],mode='login',cur=null;
function toast(t){const e=$('#toast');e.textContent=t;e.className='show';clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='',3500)}
function view(v){$('#auth').hidden=v!=='auth';$('#dash').hidden=v!=='dash'}
async function start(){
  const {data}=await sb.auth.getSession();
  data.session?await enter(data.session.user):view('auth');
  const {data:a}=await sb.from('announcements').select('message').eq('active',true).order('id',{ascending:false}).limit(1);
  if(a&&a[0]){$('#note').textContent=a[0].message;$('#note').hidden=false}
}
async function enter(u){
  const {data}=await sb.from('profiles').select('username').eq('id',u.id).single();
  if(!data){await sb.auth.signOut();return view('auth')}
  me={id:u.id,name:data.username};$('#who').textContent='Halo, '+me.name;view('dash');load();
}
async function load(){
  const {data,error}=await sb.from('projects').select('*').eq('user_id',me.id).order('created_at',{ascending:false});
  if(error)return toast(error.message);rows=data;draw();
}
function draw(){
  $('#list').innerHTML=rows.length?rows.map(p=>{
    const url=`${CFG.SITE}/${me.name}/${p.slug}/`;
    return `<article class="card"><h3>${esc(p.title)}</h3>
<p class="meta">${p.is_public?`Publik, ${p.views} kunjungan`:'Pribadi, belum bisa dilihat orang lain'}</p>
${p.is_public?`<a class="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`:''}
<div class="row"><button class="btn" data-a="edit" data-id="${p.id}">Edit atau ganti file</button>
<button class="btn alt" data-a="pub" data-id="${p.id}">${p.is_public?'Jadikan pribadi':'Publikasikan'}</button>
<button class="btn danger" data-a="del" data-id="${p.id}">Hapus</button></div></article>`}).join('')
  :'<p class="empty">Belum ada codingan. Tekan “Codingan baru” untuk mulai.</p>';
}
$('#list').onclick=async e=>{
  const b=e.target.closest('button');if(!b)return;const p=rows.find(x=>x.id===b.dataset.id),a=b.dataset.a;
  if(a==='edit')openEd(p);
  if(a==='pub')await togglePub(p);
  if(a==='del'&&confirm(`Hapus "${p.title}"? Tidak bisa dibatalkan.`)){
    const {error}=await sb.from('projects').delete().eq('id',p.id);error?toast(error.message):(toast('Dihapus'),load())}
};
async function togglePub(p){
  let patch={is_public:false};
  if(!p.is_public){
    const s=(prompt('Nama link (huruf kecil, angka, strip):',p.slug||'')||'').trim().toLowerCase();
    if(!s)return;
    if(!/^[a-z0-9-]{1,40}$/.test(s))return toast('Nama link hanya boleh huruf kecil, angka, dan strip');
    patch={is_public:true,slug:s};
  }
  const {error}=await sb.from('projects').update(patch).eq('id',p.id);
  error?toast(error.code==='23505'?'Nama link sudah dipakai, coba nama lain':error.message):(toast(patch.is_public?'Dipublikasikan':'Jadi pribadi'),load());
}
function openEd(p){cur=p;$('#t').value=p?p.title:'';for(const k of['html','css','js'])$('#'+k).value=p?p[k]:'';$('#ed').showModal()}
document.querySelectorAll('input[type=file]').forEach(f=>f.onchange=async()=>{const x=f.files[0];if(x)document.getElementById(f.dataset.to).value=await x.text()});
$('#save').onclick=async()=>{
  const title=$('#t').value.trim();if(!title)return toast('Isi judul dulu');
  const body={title,html:$('#html').value,css:$('#css').value,js:$('#js').value,updated_at:new Date().toISOString()};
  const {error}=await(cur?sb.from('projects').update(body).eq('id',cur.id):sb.from('projects').insert({...body,user_id:me.id,username:me.name}));
  if(error)return toast(error.message);$('#ed').close();toast('Tersimpan');load();
};
$('#cancel').onclick=()=>$('#ed').close();
$('#new').onclick=()=>openEd(null);
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
