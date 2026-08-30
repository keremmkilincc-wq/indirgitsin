const $ = s => document.querySelector(s);
const urlInput = $('#urlInput');
const pasteBtn = $('#pasteBtn');
const clearBtn = $('#clearBtn');
const analyzeBtn = $('#analyzeBtn');
const analyzeText = $('#analyzeText');
const analyzeSpinner = $('#analyzeSpinner');
const statusBox = $('#statusBox');
const previewCard = $('#previewCard');
const optionsCard = $('#optionsCard');
const optionsList = $('#optionsList');
const thumb = $('#thumb');
const videoTitle = $('#videoTitle');
const videoChannel = $('#videoChannel');
const videoMeta = $('#videoMeta');
const durationEl = $('#duration');
const sourceBadge = $('#sourceBadge');
const openYt = $('#openYt');
const historyList = $('#historyList');
const progressModal = $('#progressModal');
const progressFill = $('#progressFill');
const progressText = $('#progressText');
const progressTitle = $('#progressTitle');

let currentInfo = null;
let activeFilter = 'all';

// --- helpers ---
function showStatus(msg, type='info'){
  statusBox.textContent = msg;
  statusBox.className = 'status ' + type;
  statusBox.classList.remove('hidden');
  if(type==='success') setTimeout(()=>statusBox.classList.add('hidden'), 3500);
}
function hideStatus(){ statusBox.classList.add('hidden');}
function setLoading(v){
  analyzeBtn.disabled=v;
  analyzeText.textContent=v?'Çözümleniyor...':'Çözümle';
  analyzeSpinner.classList.toggle('hidden', !v);
}
function isYouTubeUrl(u){
  try{
    const url = new URL(u);
    const h = url.hostname.replace('www.','');
    return ['youtube.com','youtu.be','music.youtube.com','m.youtube.com'].some(d=>h.includes(d)) || u.includes('youtube') || u.includes('youtu.be');
  }catch{ return false;}
}
function extractId(url){
  const m = url.match(/(?:v=|\.be\/|music.*v=|shorts\/)([A-Za-z0-9_-]{6,11})/);
  return m ? m[1] : null;
}
function formatDuration(sec){
  if(!sec) return '00:00';
  const m=Math.floor(sec/60), s=sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function getSourceLabel(url){
  if(url.includes('music.youtube.com')) return 'YouTube Music';
  if(url.includes('/shorts/')) return 'YouTube Shorts';
  return 'YouTube';
}

// --- API base (for mobile APK: set to PC IP, e.g., http://192.168.1.15:8000) ---
const API_BASE_KEY='indir_gitsin_api_base';
function getApiBase(){ try{ return (localStorage.getItem(API_BASE_KEY)||'').trim().replace(/\/$/,''); }catch{ return '';} }
function apiUrl(path){
  const base=getApiBase();
  if(base) return base + path;
  return path;
}
function isNative(){ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }

// Kaydet: native download - Filesystem.downloadFile (CORS'siz) + fallback base64
async function saveToDownloads(filename, b64){
  const FS = window.Capacitor.Plugins.Filesystem;
  if(!FS) return {saved:false, error:'no FS'};
  const Dir = FS.Directory || {};
  const tries = [
    Dir.ExternalStorage ? {dir: Dir.ExternalStorage, path:`Download/IndirGitsin/${filename}`} : null,
    Dir.External ? {dir: Dir.External, path:`Download/IndirGitsin/${filename}`} : null,
    Dir.Documents ? {dir: Dir.Documents, path:`Download/IndirGitsin/${filename}`} : null,
    Dir.Documents ? {dir: Dir.Documents, path:`IndirGitsin/${filename}`} : null,
    Dir.Data ? {dir: Dir.Data, path:filename} : null,
  ].filter(Boolean);
  let lastErr=null;
  for(const t of tries){
    try{
      await FS.writeFile({ path: t.path, data: b64, directory: t.dir, recursive:true });
      try{ const st = await FS.stat({ path: t.path, directory: t.dir }); console.log('saved stat', st); }catch{}
      return {saved:true, path: t.path, dir: t.dir};
    }catch(e){ lastErr=e; console.log('save try fail', t, e.message||e); }
  }
  try{
    await FS.writeFile({ path: filename, data: b64 });
    return {saved:true, path: filename, dir:'CACHE'};
  }catch(e){ lastErr=e; }
  return {saved:false, error: lastErr};
}

// Helper: promise timeout - 88'de takılmayı önlemek için kritik
function withTimeout(promise, ms, label){
  let t;
  const timeout = new Promise((_, rej)=> t=setTimeout(()=> rej(new Error((label||'Timeout')+' ('+ms+'ms)')), ms));
  return Promise.race([promise, timeout]).finally(()=> clearTimeout(t));
}

// En güvenilir: Filesystem.downloadFile ile doğrudan URL'den public Download'a çek (CORS bypass)
async function downloadViaNative(url, filename){
  // 0) En hızlı ve en güvenilir: Android DownloadManager bridge (takılmaz)
  try{
    if(window.Android && window.Android.download){
      window.Android.download(url, filename);
      console.log('Android bridge download triggered', filename);
      return {ok:true, path: filename, dir:'AndroidBridge'};
    }
  }catch(e){ console.log('Android bridge fail', e); }
  const FS = window.Capacitor.Plugins.Filesystem;
  if(!FS || !FS.downloadFile) return {ok:false, error:'no downloadFile'};
  const Dir = FS.Directory || {};
  const tries = [
    Dir.ExternalStorage ? {dir: Dir.ExternalStorage, path:`Download/IndirGitsin/${filename}`} : null,
    Dir.External ? {dir: Dir.External, path:`Download/IndirGitsin/${filename}`} : null,
    Dir.Documents ? {dir: Dir.Documents, path:`Download/IndirGitsin/${filename}`} : null,
  ].filter(Boolean);
  let lastErr=null;
  for(const t of tries){
    try{
      const res = await withTimeout(FS.downloadFile({ url, path: t.path, directory: t.dir, recursive:true }), 9000, 'downloadFile');
      console.log('downloadFile ok', res);
      return {ok:true, path: t.path, dir: t.dir, res};
    }catch(e){ lastErr=e; console.log('downloadFile fail', t, e.message||e); }
  }
  return {ok:false, error: lastErr};
}

// Mock data for offline preview (when server not running)
function mockInfo(url){
  const id = extractId(url) || 'jNQXAC9IVRw';
  return {
    id,
    title: 'Örnek Video - İndir Gitsin Demo (Sunucu yok - doğrudan mod deneniyor)',
    channel: 'Demo Kanal',
    duration: 212,
    views: '1.2M',
    thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    url,
    formats: [
      {id:'mp4_360', label:'MP4 360p (MP4)', ext:'mp4', quality:'360p', type:'video', size:'', hasAudio:true, url:''},
      {id:'m4a', label:'M4A (Ses)', ext:'m4a', quality:'128kbps', type:'audio', size:'', url:''},
    ]
  };
}

// --- Client-side direct extractor (Innertube primary + Piped fallback) - sunucusuz çalışır ---
// CapacitorHttp varsa CORS bypass için onu kullan
async function nativeFetch(url, opts={}){
  // 1) CapacitorHttp (CORS bypass)
  try{
    const cap = window.Capacitor && window.Capacitor.Plugins && (window.Capacitor.Plugins.CapacitorHttp || window.Capacitor.Plugins.Http);
    if(cap && cap.request){
      const method = (opts.method||'GET').toUpperCase();
      const headers = opts.headers||{};
      const data = opts.body;
      const res = await cap.request({url, method, headers, data, connectTimeout: 8000, readTimeout: 12000});
      // normalize to fetch-like
      return {
        ok: res.status >=200 && res.status<300,
        status: res.status,
        headers: { get:(k)=> (res.headers && (res.headers[k]||res.headers[k.toLowerCase()])) || null },
        json: async()=> typeof res.data==='string' ? JSON.parse(res.data) : res.data,
        text: async()=> typeof res.data==='string' ? res.data : JSON.stringify(res.data),
        blob: async()=> { // for binary, data is base64? fallback
          if(res.data instanceof Blob) return res.data;
          // if base64 string, convert
          return new Blob([res.data]);
        },
        arrayBuffer: async()=> res.data
      };
    }
  }catch(e){ console.log('CapacitorHttp failed', e); }
  return fetch(url, opts);
}

async function fetchWithTimeout(url, opts={}, ms=8000){
  const c = new AbortController();
  const t = setTimeout(()=>c.abort(), ms);
  try{
    // CapacitorHttp doesn't support signal, fallback to fetch
    const hasCap = !!(window.Capacitor && window.Capacitor.Plugins && (window.Capacitor.Plugins.CapacitorHttp || window.Capacitor.Plugins.Http));
    if(hasCap && opts.method==='POST'){
      clearTimeout(t);
      return await nativeFetch(url, opts);
    }
    const r = await fetch(url, {...opts, signal:c.signal});
    clearTimeout(t);
    return r;
  }catch(e){ clearTimeout(t); throw e; }
}

async function fetchViaPiped(videoId){
  // Piped çoğu instance kapandı, dene ama hızlı fail
  const PIPED_HOSTS = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.mha.fi',
    'https://pipedapi.r4fo.com'
  ];
  let lastErr=null;
  for(const host of PIPED_HOSTS){
    try{
      const r = await fetchWithTimeout(`${host}/streams/${videoId}`, {}, 5000);
      if(!r.ok) continue;
      const j = await r.json();
      if(!j.title) continue;
      return j;
    }catch(e){ lastErr=e; continue; }
  }
  throw lastErr || new Error('Piped failed');
}

function mapPipedToInfo(piped, originalUrl, videoId){
  const title = piped.title || 'Bilinmeyen Başlık';
  const channel = piped.uploader || piped.uploaderName || 'YouTube';
  const duration = piped.duration || 0;
  const thumb = piped.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const views = piped.views ? String(piped.views) : '';
  const formats=[];
  // videoStreams: sorted by quality desc, includes itag, quality, mimeType, url, height, fps
  const vstreams = piped.videoStreams || [];
  const seenH=new Set();
  // sadece progressive mp4 (video+audio) öncelik, yoksa en iyi video
  vstreams.filter(s=> s.mimeType && s.mimeType.includes('video/mp4') && s.url).forEach(s=>{
    const h = s.height || (s.quality ? parseInt(s.quality) : 0);
    if(!h || seenH.has(h)) return;
    seenH.add(h);
    const fps = s.fps || '';
    formats.push({id:String(s.itag||h), label:`MP4 ${h}p`, ext:'mp4', quality:`${h}p`, type:'video', size:'', hasAudio: !!s.audioTrack || true, fps:fps, url:s.url});
  });
  // fallback: any video/mp4 not yet
  if(formats.length===0){
    vstreams.filter(s=> s.url && s.mimeType && s.mimeType.includes('video')).slice(0,4).forEach(s=>{
      const h=s.height||360; if(seenH.has(h)) return; seenH.add(h);
      formats.push({id:String(s.itag||h), label:`MP4 ${h}p`, ext:'mp4', quality:`${h}p`, type:'video', size:'', hasAudio:true, url:s.url});
    });
  }
  formats.sort((a,b)=> parseInt(b.quality)-parseInt(a.quality));
  // audioStreams
  const astreams = piped.audioStreams || piped.audioOnly || [];
  let audioUrl='';
  let abr='128kbps';
  if(astreams.length){
    // en iyi m4a/opus seç
    const best = [...astreams].filter(a=>a.url).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0))[0];
    if(best){
      audioUrl=best.url;
      const ext = best.mimeType && best.mimeType.includes('mp4') ? 'm4a' : (best.mimeType && best.mimeType.includes('webm') ? 'webm' : 'm4a');
      const bitrate = best.bitrate ? Math.round(best.bitrate/1000)+'kbps' : '128kbps';
      abr=bitrate;
      formats.push({id:'m4a', label:'M4A (Ses)', ext:'m4a', quality:abr, type:'audio', size:'', url: audioUrl});
      // opus da ekle
      const opus = astreams.find(a=>a.mimeType && a.mimeType.includes('opus') && a.url);
      if(opus && opus.url!==audioUrl) formats.push({id:'opus', label:'OPUS (Ses)', ext:'opus', quality:opus.quality||abr, type:'audio', size:'', url:opus.url});
    }
  }
  if(!formats.find(f=>f.type==='audio')){
    formats.push({id:'m4a', label:'M4A (Ses)', ext:'m4a', quality:'128kbps', type:'audio', size:'', url:''});
  }
  // MP3 cihazda ffmpeg.wasm ile dönüştürülür (sunucusuz)
  formats.push({id:'mp3', label:'MP3 (cihazda dönüştür)', ext:'mp3', quality:'192kbps', type:'audio', size:'', url:''});
  return {id:videoId, title, channel, duration, views, thumbnail:thumb, url:originalUrl, formats:formats.slice(0,8), _source:'piped'};
}

async function fetchViaInnertube(videoId){
  const key='AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  const clients = [
    {clientName:'ANDROID', clientVersion:'20.10.38', androidSdkVersion:30},
    {clientName:'IOS', clientVersion:'19.29.1', deviceModel:'iPhone16,2', osVersion:'17.5.1.21F90'},
    {clientName:'WEB', clientVersion:'2.20250101.00.00'},
  ];
  const doFetch = async (url, body)=>{
    // dene: nativeFetch -> fetch -> corsproxy
    try{
      let r = await nativeFetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
      if(r.ok) return r;
      throw new Error('HTTP '+r.status);
    }catch(e){
      // CORS/proxy fallback
      try{
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        let r2 = await fetch(proxyUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
        if(r2.ok) return r2;
      }catch{}
      throw e;
    }
  };
  let lastErr=null;
  for(const client of clients){
    try{
      const body={context:{client:{...client, hl:'tr', gl:'TR'}}, videoId, playbackContext:{contentPlaybackContext:{html5Preference:'HTML5_PREF_WANTS'}}, racyCheckOk:true, contentCheckOk:true};
      const r = await doFetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`, body);
      const j = await r.json();
      if(j.playabilityStatus && j.playabilityStatus.status==='ERROR' && j.playabilityStatus.reason){
        if(String(j.playabilityStatus.reason).toLowerCase().includes('sign in')) { lastErr=new Error(j.playabilityStatus.reason); continue; }
      }
      const details=j.videoDetails||{};
      const sd=j.streamingData||{};
      if(!sd.formats && !sd.adaptiveFormats) throw new Error('No streamingData');
      return {details, streamingData:sd};
    }catch(e){ lastErr=e; continue; }
  }
  throw lastErr || new Error('Innertube failed');
}

function mapInnertubeToInfo(data, originalUrl, videoId){
  const details=data.details||{};
  const sd=data.streamingData||{};
  const title=details.title||'Bilinmeyen Başlık';
  const channel=details.author||'YouTube';
  const duration=parseInt(details.lengthSeconds||0);
  const thumb=(details.thumbnail && details.thumbnail.thumbnails && details.thumbnail.thumbnails.slice(-1)[0].url) || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const views=details.viewCount||'';
  const formats=[];
  // sd.formats are progressive (video+audio, direct download friendly)
  (sd.formats||[]).filter(f=>f.url).forEach(f=>{
    const h=f.height||0;
    const ext=(f.mimeType||'').includes('mp4')?'mp4':'webm';
    if(ext!=='mp4') return;
    formats.push({id:String(f.itag), label:`MP4 ${h}p`, ext:'mp4', quality:`${h}p`, type:'video', size:'', hasAudio:true, fps:f.fps||'', url:f.url});
  });
  formats.sort((a,b)=> parseInt(b.quality)-parseInt(a.quality));
  // adaptive audio only
  const audios=(sd.adaptiveFormats||[]).filter(f=>f.mimeType && f.mimeType.includes('audio') && f.url);
  if(audios.length){
    audios.sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
    const best=audios[0];
    const isM4a=(best.mimeType||'').includes('mp4');
    formats.push({id:'m4a', label:'M4A (Ses)', ext:isM4a?'m4a':'webm', quality: best.bitrate? Math.round(best.bitrate/1000)+'kbps' : '128kbps', type:'audio', size:'', url:best.url});
  }
  if(!formats.find(f=>f.type==='audio')) formats.push({id:'m4a', label:'M4A (Ses)', ext:'m4a', quality:'128kbps', type:'audio', size:'', url:''});
  formats.push({id:'mp3', label:'MP3 (cihazda dönüştür)', ext:'mp3', quality:'192kbps', type:'audio', size:'', url:''});
  return {id:videoId, title, channel, duration, views, thumbnail:thumb, url:originalUrl, formats:formats.slice(0,8), _source:'innertube'};
}

async function fetchInfoClientSide(url){
  const vid=extractId(url);
  if(!vid) throw new Error('Video ID bulunamadı');
  // 1) Piped
  let pipedInfo=null;
  try{
    const piped=await fetchViaPiped(vid);
    pipedInfo = mapPipedToInfo(piped, url, vid);
    // Piped bazen ses döndürmez - Innertube ile zenginleştir
    const hasAudioUrl = pipedInfo.formats.some(f=> f.type==='audio' && f.url && f.url.startsWith('http'));
    if(!hasAudioUrl){
      try{
        const inn=await fetchViaInnertube(vid);
        const innInfo=mapInnertubeToInfo(inn, url, vid);
        const innAudio = innInfo.formats.filter(f=> f.type==='audio' && f.url);
        // piped eksik音频 url'i inn ile doldur
        pipedInfo.formats = pipedInfo.formats.filter(f=> !(f.type==='audio' && !f.url));
        innAudio.forEach(a=>{
          if(!pipedInfo.formats.some(f=> f.url===a.url)) pipedInfo.formats.push(a);
        });
        if(!pipedInfo.formats.find(f=>f.id==='mp3')) pipedInfo.formats.push({id:'mp3', label:'MP3 (cihazda dönüştür)', ext:'mp3', quality:'192kbps', type:'audio', size:'', url:''});
        console.log('Piped audio enrich with Innertube', innAudio.length);
      }catch(e){ console.log('Piped audio enrich failed', e); }
    }
    if(pipedInfo.formats.some(f=> f.url && f.url.startsWith('http'))) return pipedInfo;
  }catch(e){ console.log('Piped failed', e); }
  // 2) Innertube
  try{
    const inn=await fetchViaInnertube(vid);
    const innInfo = mapInnertubeToInfo(inn, url, vid);
    // eğer piped vardı ama url'sizdi, inn tercih et
    if(pipedInfo && innInfo){
      // video formatları birleştir
      const merged = [...innInfo.formats];
      pipedInfo.formats.forEach(f=>{
        if(f.url && !merged.some(m=> m.url===f.url)) merged.push(f);
      });
      innInfo.formats = merged.slice(0,8);
      return innInfo;
    }
    return innInfo;
  }catch(e){ console.log('Innertube failed', e); if(pipedInfo) return pipedInfo; throw e; }
}

async function fetchInfo(url){
  // 1) Backend varsa dene (isteğe bağlı, zorunlu değil)
  const base=getApiBase();
  // sadece base varsa veya localhost ise backend dene - boş base'te /api 404 ise direkt client'a geç
  try{
    // if no base and not localhost, skip backend to avoid 404 delay on APK
    const shouldTryBackend = !!base || location.hostname==='localhost' || location.hostname==='127.0.0.1';
    if(shouldTryBackend){
      const r = await fetchWithTimeout(apiUrl(`/api/info?url=${encodeURIComponent(url)}`), {}, 4000);
      if(r.ok){
        const j = await r.json();
        if(j.title) return j;
      }
    }
  }catch(e){ console.log('backend info failed', e); }
  // 2) Client-side direct (sunucusuz)
  try{
    const info = await fetchInfoClientSide(url);
    if(info && info.title) return info;
  }catch(e){ console.log('client-side failed', e); }
  // 3) fallback mock (demo)
  await new Promise(res=>setTimeout(res, 400));
  return mockInfo(url);
}

function renderPreview(info){
  thumb.src = info.thumbnail;
  thumb.onerror = () => thumb.src = `https://img.youtube.com/vi/${info.id}/mqdefault.jpg`;
  videoTitle.textContent = info.title;
  videoChannel.textContent = `${info.channel} • ${info.views || ''} görüntüleme`;
  videoMeta.textContent = `${info.duration ? formatDuration(info.duration) : ''} • ${getSourceLabel(info.url)}`;
  durationEl.textContent = formatDuration(info.duration);
  sourceBadge.textContent = getSourceLabel(info.url);
  openYt.href = info.url;
  previewCard.classList.remove('hidden');
}

function renderOptions(info){
  optionsList.innerHTML='';
  const filtered = info.formats.filter(f=> activeFilter==='all' || f.type===activeFilter);
  filtered.forEach(f=>{
    const div = document.createElement('div');
    div.className='option';
    div.dataset.type=f.type;
    div.innerHTML=`
      <div class="option-icon ${f.type}">${f.type==='video'?'🎬':'🎵'}</div>
      <div class="option-main"><b>${f.label}</b><span>${f.ext.toUpperCase()} • ${f.size} ${f.fps? '• '+f.fps+'fps':''}</span></div>
      <div class="option-meta">${f.quality}</div>
      <button class="download-btn">İndir</button>
      <button class="icon-btn more-opt-btn" title="Seçenekler" style="width:36px;height:36px;border-radius:10px;font-size:16px">⋮</button>
    `;
    const btn = div.querySelector('.download-btn');
    btn.addEventListener('click', ()=> startDownload(info, f, btn));
    // 3-nokta: hızlı müzik indir (aynı menü mantığı - küçük dropdown)
    const moreBtn = div.querySelector('.more-opt-btn');
    moreBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      // Hızlı: doğrudan bu formatı indir zaten - ama 3 nokta için ek menü: M4A/MP3 kısayol
      // Basit: bu satırın formatını kopyala / paylaş
      const menu = document.createElement('div');
      menu.className='more-menu glass';
      menu.style.position='absolute'; menu.style.right='10px'; menu.style.zIndex='10';
      menu.innerHTML=`<button data-a="copy">🔗 Linki kopyala</button><button data-a="m4a">🎵 M4A olarak indir</button><button data-a="mp3">🎵 MP3 olarak indir</button>`;
      menu.style.minWidth='180px';
      div.style.position='relative';
      // eski menü varsa sil
      div.querySelectorAll('.more-menu').forEach(m=>m.remove());
      div.appendChild(menu);
      menu.querySelector('[data-a="copy"]').onclick=async()=>{ try{ await navigator.clipboard.writeText(info.url); showStatus('Link kopyalandı','success'); }catch{ showStatus(info.url,'info'); } menu.remove(); };
      menu.querySelector('[data-a="m4a"]').onclick=()=>{ menu.remove(); const aFmt = info.formats.find(x=> x.type==='audio' && x.ext==='m4a' && x.url) || info.formats.find(x=> x.type==='audio' && x.url); if(aFmt) startDownload(info, aFmt, btn); else showStatus('M4A bulunamadı','error'); };
      menu.querySelector('[data-a="mp3"]').onclick=()=>{ menu.remove(); const mp3Fmt = info.formats.find(x=> x.id==='mp3') || info.formats.find(x=> x.ext==='mp3'); if(mp3Fmt) startDownload(info, mp3Fmt, btn); else showStatus('MP3 bulunamadı','error'); };
      setTimeout(()=>{ const h=(ev)=>{ if(!menu.contains(ev.target) && ev.target!==moreBtn){ menu.remove(); document.removeEventListener('click', h); } }; document.addEventListener('click', h); }, 50);
    });
    optionsList.appendChild(div);
  });
  optionsCard.classList.remove('hidden');
  if(filtered.length===0){
    optionsList.innerHTML='<p class="empty">Bu filtrede seçenek yok.</p>';
  }
}

// Preview 3-nokta menüsü: video ekranı müzikte de aynı - 3 noktadan M4A/MP3 direkt insin
(function setupPreviewMoreMenu(){
  const btn = document.getElementById('moreBtn');
  const menu = document.getElementById('moreMenu');
  if(!btn || !menu) return;
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e)=>{
    if(!menu.contains(e.target) && e.target!==btn) menu.classList.add('hidden');
  });
  menu.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      const act = b.dataset.action;
      menu.classList.add('hidden');
      if(!currentInfo){ showStatus('Önce bir link çözümle','error'); return; }
      if(act==='copy'){
        navigator.clipboard.writeText(currentInfo.url).then(()=> showStatus('Link kopyalandı','success')).catch(()=> showStatus(currentInfo.url,'info'));
        return;
      }
      if(act==='m4a'){
        const f = currentInfo.formats.find(x=> x.type==='audio' && x.ext==='m4a' && x.url) || currentInfo.formats.find(x=> x.type==='audio' && x.url);
        if(f) startDownload(currentInfo, f, b);
        else showStatus('M4A bulunamadı, seçeneklerden dene','error');
        return;
      }
      if(act==='mp3'){
        const f = currentInfo.formats.find(x=> x.id==='mp3') || currentInfo.formats.find(x=> x.ext==='mp3');
        if(f) startDownload(currentInfo, f, b);
        else showStatus('MP3 bulunamadı','error');
        return;
      }
      if(act==='video'){
        const f = currentInfo.formats.find(x=> x.type==='video' && x.url) || currentInfo.formats[0];
        if(f) startDownload(currentInfo, f, b);
      }
    });
  });
})();

async function startDownload(info, format, btn){
  btn.disabled=true; btn.textContent='Hazırlanıyor...';
  progressModal.classList.remove('hidden');
  progressTitle.textContent = `${info.title.slice(0,40)} - ${format.label}`;
  progressFill.style.width='8%'; progressText.textContent='8%';
  let p=8;
  const iv = setInterval(()=>{
    p+= Math.random()*12;
    if(p>=88) p=88;
    progressFill.style.width=p+'%';
    progressText.textContent=Math.round(p)+'%';
  }, 500);

  try{
    const native = isNative();
    // 1) Doğrudan CDN - sunucusuz, cihaz doğrudan indirir (öncelikli)
    if(format.url && format.url.startsWith('http')){
      let filename = `${(info.title||'video').replace(/[^\w\- ]/g,'').slice(0,60)}.${format.ext}`;
      // Native: önce Android bridge (takılmaz), sonra downloadFile, en son anchor/browser
      if(native){
        try{
          progressText.textContent='İndiriliyor (doğrudan)...';
          // Yöntem 0: Android DownloadManager bridge - en hızlı, 88'de takılma yok
          try{
            if(window.Android && window.Android.download){
              window.Android.download(format.url, filename);
              clearInterval(iv);
              progressFill.style.width='100%'; progressText.textContent='100%';
              await new Promise(r=>setTimeout(r,400));
              progressModal.classList.add('hidden');
              showStatus(`İndirildi ✓ İndirilenler/IndirGitsin/${filename} (bildirim çubuğunu kontrol et)`, 'success');
              addToHistory(info, format);
              return;
            }
          }catch(e){ console.log('Android bridge fail', e); }
          // Yöntem 1: Filesystem.downloadFile -> doğrudan public Download (CORS bypass, timeout 9s)
          try{
            const dl = await withTimeout(downloadViaNative(format.url, filename), 10000, 'downloadViaNative');
            if(dl.ok){
              clearInterval(iv);
              progressFill.style.width='100%'; progressText.textContent='100%';
              await new Promise(r=>setTimeout(r,400));
              progressModal.classList.add('hidden');
              const loc = dl.dir==='AndroidBridge' ? 'İndirilenler/IndirGitsin' : `İndirilenler/IndirGitsin/${filename}`;
              showStatus(`İndirildi ✓ ${loc} (bildirim çubuğunu kontrol et)`, 'success');
              addToHistory(info, format);
              return;
            } else {
              console.log('downloadViaNative failed, fallback fetch', dl.error);
            }
          }catch(e){ console.log('downloadViaNative timeout/error', e); }
          // Yöntem 2: Fetch blob -> Filesystem base64 (timeout 12s) - M4A için CORS bypass
          try{
            let resp;
            try{ resp = await withTimeout(nativeFetch(format.url), 10000, 'nativeFetch'); }catch{ resp = await withTimeout(fetch(format.url), 10000, 'fetch'); }
            if(resp && resp.ok){
              let blob;
              try{ blob = await withTimeout(resp.blob(), 8000, 'blob'); }catch{ const ab = await withTimeout(resp.arrayBuffer(), 8000, 'arrayBuffer'); blob = new Blob([ab], {type: format.ext==='m4a'?'audio/mp4':'video/mp4'}); }
              if(blob && blob.size>0){
                const toBase64 = (b)=> new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=> res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(b); });
                const b64 = await withTimeout(toBase64(blob), 8000, 'toBase64');
                const res = await withTimeout(saveToDownloads(filename, b64), 7000, 'saveToDownloads');
                if(res.saved){
                  clearInterval(iv);
                  progressFill.style.width='100%'; progressText.textContent='100%';
                  await new Promise(r=>setTimeout(r,300));
                  progressModal.classList.add('hidden');
                  const loc = res.dir==='CACHE' ? 'uygulama önbelleği' : `İndirilenler/IndirGitsin/${filename}`;
                  showStatus(`İndirildi ✓ Kaydedildi: ${loc}`, 'success');
                  try{ const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); }catch{}
                  addToHistory(info, format);
                  return;
                } else {
                  console.log('saveToDownloads failed', res.error);
                }
              }
            }
          }catch(e){ console.log('direct fetch->FS failed/timeout', e); }
          // Yöntem 3: Anchor (MainActivity setDownloadListener yakalar) - timeout yok, anında
          try{
            const a=document.createElement('a'); a.href=format.url; a.download=filename; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove();
            clearInterval(iv);
            progressFill.style.width='100%'; progressText.textContent='100%';
            await new Promise(r=>setTimeout(r,300));
            progressModal.classList.add('hidden');
            showStatus('İndirme başlatıldı (İndirilenler/IndirGitsin klasörünü kontrol et)...', 'success');
            addToHistory(info, format);
            return;
          }catch(e2){ console.log('anchor trigger failed', e2); }
          // Yöntem 4: External browser
          try{
            if(window.Capacitor.Plugins.Browser) await withTimeout(window.Capacitor.Plugins.Browser.open({ url: format.url }), 5000, 'Browser.open');
            else window.open(format.url, '_blank');
            clearInterval(iv);
            progressFill.style.width='100%'; progressText.textContent='100%';
            progressModal.classList.add('hidden');
            showStatus('Tarayıcıda açıldı - indirme için ... menüden Kaydet deyin.', 'info');
            addToHistory(info, format);
            return;
          }catch{}
        }catch(e){
          console.log('native direct failed', e);
        }
      } else {
        // Web: direkt anchor
        try{
          clearInterval(iv);
          progressFill.style.width='100%'; progressText.textContent='100%';
          await new Promise(r=>setTimeout(r,200));
          progressModal.classList.add('hidden');
          const a=document.createElement('a'); a.href=format.url; a.download=filename; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove();
          showStatus('Doğrudan indirme başlatıldı.', 'success');
          addToHistory(info, format);
          return;
        }catch{
          window.open(format.url, '_blank');
          clearInterval(iv);
          progressFill.style.width='100%'; progressText.textContent='100%';
          progressModal.classList.add('hidden');
          showStatus('Doğrudan indirme başlatıldı.', 'success');
          addToHistory(info, format);
          return;
        }
      }
      // fallback still
      clearInterval(iv);
      progressFill.style.width='100%'; progressText.textContent='100%';
      progressModal.classList.add('hidden');
      window.open(format.url, '_blank');
      showStatus('Doğrudan link açıldı.', 'info');
      addToHistory(info, format);
      return;
    }
    // MP3 direkt sunucusuz (cihazda ffmpeg.wasm ile dönüştür)
    if((format.id==='mp3' || format.ext==='mp3') && (!format.url || format.url==='')){
      // Önce sunucu varsa sunucuyu kullan (daha hızlı), yoksa cihazda dönüştür
      const hasServer = await (async()=>{ try{ const r=await fetchWithTimeout(apiUrl('/api/health'),{},2000); return r.ok; }catch{return false;} })();
      if(!hasServer){
        // Sunucu yok -> cihazda M4A -> MP3
        const audioSrc = (currentInfo && currentInfo.formats.find(f=> f.type==='audio' && f.url && f.url.startsWith('http'))) || (info.formats.find(f=> f.type==='audio' && f.url && f.url.startsWith('http')));
        if(!audioSrc || !audioSrc.url){
          clearInterval(iv);
          progressModal.classList.add('hidden');
          showStatus('MP3 için ses kaynağı bulunamadı. Önce M4A ile çözümlenmeli - linki tekrar çözümle.', 'error');
          return;
        }
        try{
          progressText.textContent='Ses indiriliyor...';
          progressFill.style.width='30%';
          // CORS bypass için nativeFetch kullan (APK'da googlevideo CORS yok)
          let audioBlob;
          try{
            let resp;
            try{ resp = await withTimeout(nativeFetch(audioSrc.url), 10000, 'nativeFetch audio'); }catch{ resp = await withTimeout(fetch(audioSrc.url), 10000, 'fetch audio'); }
            if(!resp.ok) throw new Error('HTTP '+resp.status);
            // nativeFetch blob() bazen base64 string dönebilir, handle et
            try{ audioBlob = await withTimeout(resp.blob(), 8000, 'blob'); }catch{ const ab = await withTimeout(resp.arrayBuffer(), 8000, 'arrayBuffer'); audioBlob = new Blob([ab]); }
            // blob boşsa ve native ise DownloadManager ile dene -> fallback base64
            if(!audioBlob || audioBlob.size===0) throw new Error('Boş ses verisi');
          }catch(fetchErr){
            console.log('audio fetch fail, trying direct download fallback', fetchErr);
            // Son çare: M4A url ile doğrudan indirmeyi dene (anchor/Browser) - 88'de takılma olmasın
            try{
              if(window.Android && window.Android.download){
                const fn = `${(info.title||'audio').replace(/[^\w\- ]/g,'').slice(0,60)}.m4a`;
                window.Android.download(audioSrc.url, fn);
                clearInterval(iv);
                progressFill.style.width='100%'; progressText.textContent='100%';
                progressModal.classList.add('hidden');
                showStatus('M4A olarak indiriliyor (MP3 dönüştürülemedi) ✓ İndirilenler/IndirGitsin/'+fn, 'success');
                addToHistory(info, {label:'M4A (fallback)'});
                return;
              }
            }catch{}
            throw new Error('Ses indirilemedi (CORS/URL süresi dolmuş). M4A butonunu dene: ' + (fetchErr.message||fetchErr));
          }
          progressFill.style.width='45%';
          progressText.textContent='MP3’e dönüştürülüyor (cihazda)...';
          // FFmpeg.wasm ile dönüştür - hem 0.11 (createFFmpeg) hem 0.12 (FFmpeg class) destekle
          let mp3Blob;
          let ffmpegOk=false;
          try{
            // 0.12 API: window.FFmpeg.FFmpeg veya window.FFmpegWASM.FFmpeg
            const FFmpegNS = window.FFmpeg || window.FFmpegWASM || {};
            if(FFmpegNS.createFFmpeg){
              // 0.11 stili
              if(!window._ffmpegInstance){
                const { createFFmpeg, fetchFile } = FFmpegNS;
                const ffmpeg = createFFmpeg({ log:false, corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js' });
                ffmpeg.setProgress(({ratio})=>{
                  const p = 45 + Math.round(ratio*45);
                  progressFill.style.width=p+'%';
                  progressText.textContent=`Dönüştürülüyor ${Math.round(ratio*100)}%`;
                });
                window._ffmpegLoading = ffmpeg.load();
                window._ffmpegInstance = ffmpeg;
                window._ffmpegFetchFile = fetchFile;
              }
              if(window._ffmpegLoading) await window._ffmpegLoading;
              const ffmpeg = window._ffmpegInstance;
              const fetchFile = window._ffmpegFetchFile || FFmpegNS.fetchFile;
              const inputName = 'input.' + (audioSrc.ext||'m4a');
              ffmpeg.FS('writeFile', inputName, await fetchFile(audioBlob));
              await ffmpeg.run('-i', inputName, '-codec:a', 'libmp3lame', '-qscale:a', '2', 'output.mp3');
              const data = ffmpeg.FS('readFile', 'output.mp3');
              mp3Blob = new Blob([data.buffer], {type:'audio/mpeg'});
              try{ ffmpeg.FS('unlink', inputName); ffmpeg.FS('unlink', 'output.mp3'); }catch{}
              ffmpegOk=true;
            } else if(FFmpegNS.FFmpeg){
              // 0.12 stili
              if(!window._ffmpeg12){
                const { FFmpeg } = FFmpegNS;
                const ffmpeg = new FFmpeg();
                ffmpeg.on('progress', ({progress})=>{
                  const p = 45 + Math.round(progress*45);
                  progressFill.style.width=p+'%';
                  progressText.textContent=`Dönüştürülüyor ${Math.round(progress*100)}%`;
                });
                window._ffmpeg12 = ffmpeg;
                window._ffmpeg12Loading = ffmpeg.load({coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'});
              }
              await window._ffmpeg12Loading;
              const ffmpeg = window._ffmpeg12;
              const { fetchFile } = FFmpegNS;
              await ffmpeg.writeFile('input.'+(audioSrc.ext||'m4a'), await fetchFile(audioBlob));
              await ffmpeg.exec(['-i','input.'+(audioSrc.ext||'m4a'),'-codec:a','libmp3lame','-qscale:a','2','output.mp3']);
              const data = await ffmpeg.readFile('output.mp3');
              mp3Blob = new Blob([data], {type:'audio/mpeg'});
              try{ await ffmpeg.deleteFile('input.'+(audioSrc.ext||'m4a')); await ffmpeg.deleteFile('output.mp3'); }catch{}
              ffmpegOk=true;
            } else {
              throw new Error('FFmpeg script yok');
            }
          }catch(ffErr){
            console.log('ffmpeg fail, fallback m4a->mp3 rename', ffErr);
            // Fallback: m4a'yı mp3 gibi kaydet (oynatıcılar çalar, gerçek dönüştürme değil)
            if(!ffmpegOk) {
              mp3Blob = audioBlob;
              showStatus('FFmpeg yüklenemedi, ses M4A olarak MP3 adıyla kaydediliyor (uyumlu).', 'info');
            }
          }
          const filename = `${(info.title||'audio').replace(/[^\w\- ]/g,'').slice(0,60)}.mp3`;
          // Kaydet
          if(native && window.Capacitor.Plugins.Filesystem){
            const toBase64 = (b)=> new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=> res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(b); });
            const b64 = await toBase64(mp3Blob);
            const res2 = await saveToDownloads(filename, b64);
            if(res2.saved){
              clearInterval(iv);
              progressFill.style.width='100%'; progressText.textContent='100%';
              await new Promise(r=>setTimeout(r,300));
              progressModal.classList.add('hidden');
              const loc2 = res2.dir==='CACHE' ? 'önbellek' : `İndirilenler/IndirGitsin/${filename}`;
              showStatus(`MP3 indirildi ✓ ${loc2} ${res2.dir==='CACHE' ? '(Dosya Yöneticisi > Android/data/com.indirgitsin.app)':''}`, 'success');
              addToHistory(info, format);
              return;
            } else {
              console.log('MP3 save fail', res2.error);
            }
          }
          // Web fallback
          const url = URL.createObjectURL(mp3Blob);
          const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(url),4000);
          clearInterval(iv);
          progressFill.style.width='100%'; progressText.textContent='100%';
          await new Promise(r=>setTimeout(r,300));
          progressModal.classList.add('hidden');
          showStatus('MP3 oluşturuldu ve indirildi.', 'success');
          addToHistory(info, format);
          return;
        }catch(e){
          clearInterval(iv);
          progressModal.classList.add('hidden');
          showStatus('MP3 dönüştürme hatası: '+(e.message||e)+'. M4A deneyin.', 'error');
          return;
        }
      }
      // hasServer true ise aşağıya düş -> sunucu /api/download ile mp3 yapacak
    }
    const dlUrl = apiUrl(`/api/download?url=${encodeURIComponent(info.url)}&format_id=${encodeURIComponent(format.id)}&ext=${format.ext}`);
    let serverAvailable=false;
    let healthData=null;
    try{ const h=await fetch(apiUrl(`/api/health`)); serverAvailable=h.ok; if(h.ok) healthData=await h.json().catch(()=>null); }catch{ serverAvailable=false; }

    if(serverAvailable){
      // fetch as blob to handle errors (ffmpeg/yt-dlp) properly
      progressText.textContent='Sunucuya bağlanıyor...';
      const resp = await fetch(dlUrl);
      if(!resp.ok){
        let msg='';
        try{ const j=await resp.json(); msg=j.detail||j.message||JSON.stringify(j); }catch{ try{ msg=await resp.text(); }catch{} }
        if(!msg) msg=`HTTP ${resp.status}`;
        // ffmpeg missing => friendly message
        if(msg.toLowerCase().includes('ffmpeg')){
          throw new Error('Bu format için ffmpeg gerekli. M4A deneyin veya ffmpeg kurun.');
        }
        throw new Error(msg);
      }
      clearInterval(iv);
      progressFill.style.width='92%'; progressText.textContent='92%';
      const blob = await resp.blob();
      let filename = `${(info.title||'video').replace(/[^\w\- ]/g,'').slice(0,60)}.${format.ext}`;
      const cd = resp.headers.get('content-disposition');
      if(cd){
        const m = cd.match(/filename="?([^"]+)"?/);
        if(m) try{ filename = decodeURIComponent(m[1]); }catch{ filename=m[1]; }
        // handle filename*=utf-8'' part
        const m2 = cd.match(/filename\*=utf-8''([^;]+)/i);
        if(m2) try{ filename = decodeURIComponent(m2[1]); }catch{}
      }
      // Native APK: try Filesystem, fallback to Browser/open
      if(native){
        try{
          const FS = window.Capacitor.Plugins.Filesystem;
          const Browser = window.Capacitor.Plugins.Browser;
          if(FS){
            // blob -> base64
            const toBase64 = (b)=> new Promise((res,rej)=>{
              const r=new FileReader(); r.onload=()=>{ const s=r.result; const b64=s.split(',')[1]; res(b64); }; r.onerror=rej; r.readAsDataURL(b);
            });
            const b64 = await toBase64(blob);
            // try Documents/Download
            let saved=false;
            try{
              const Dir = FS.Directory || window.Capacitor.Plugins.Filesystem.Directory;
              // Capacitor Filesystem Directory enum
              const dir = Dir ? Dir.Documents : 'DOCUMENTS';
              await FS.writeFile({ path: `Download/${filename}`, data: b64, directory: dir, recursive:true });
              saved=true;
            }catch(e){ console.log('FS write Documents failed', e); }
            if(!saved){
              try{ await FS.writeFile({ path: filename, data: b64 }); saved=true; }catch(e){ console.log('FS write cache failed', e); }
            }
            if(saved){
              progressFill.style.width='100%'; progressText.textContent='100%';
              await new Promise(r=>setTimeout(r,400));
              progressModal.classList.add('hidden');
              showStatus(`İndirme tamamlandı! Dosya kaydedildi: ${filename}`, 'success');
              addToHistory(info, format);
              return;
            }
          }
          if(Browser){
            await Browser.open({ url: dlUrl });
            progressFill.style.width='100%'; progressText.textContent='100%';
            progressModal.classList.add('hidden');
            showStatus('Tarayıcıda indirme başlatıldı.', 'success');
            addToHistory(info, format);
            return;
          }
        }catch(e){ console.log('native download fallback', e); }
        // fallback: open system browser via window.open
        window.open(dlUrl, '_blank');
        progressFill.style.width='100%'; progressText.textContent='100%';
        progressModal.classList.add('hidden');
        showStatus('İndirme bağlantısı açıldı (tarayıcı).', 'success');
        addToHistory(info, format);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000);
      progressFill.style.width='100%'; progressText.textContent='100%';
      await new Promise(r=>setTimeout(r,400));
      progressModal.classList.add('hidden');
      showStatus('İndirme tamamlandı! İndirilenler klasörüne kaydedildi.', 'success');
      addToHistory(info, format);
      return;
    }

    // Server gerekli ama yok - demo değil, doğrudan alternatif dene
    if(!format.url){
      // Son çare: Piped/Innertube'dan url alınamadıysa bilgi ver
      await new Promise(r=>setTimeout(r, 400));
      clearInterval(iv);
      progressFill.style.width='0%'; progressText.textContent='0%';
      progressModal.classList.add('hidden');
      showStatus('Bu format için doğrudan link alınamadı. Başka kalite/M4A dene veya ⚙️ Sunucu ayarı ile backend ekle.', 'error');
      return;
    }
  }catch(e){
    clearInterval(iv);
    progressModal.classList.add('hidden');
    progressFill.style.width='0%';
    showStatus('İndirme hatası: '+(e.message||e), 'error');
  }finally{
    btn.disabled=false; btn.textContent='İndir';
    clearInterval(iv);
    setTimeout(()=>{progressModal.classList.add('hidden'); progressFill.style.width='0%';}, 1500);
  }
}

// History - Derli toplu, responsive grid + silme
function loadHistory(){
  try{ return JSON.parse(localStorage.getItem('indir_gitsin_history')||'[]'); }catch{return []}
}
function saveHistory(h){ localStorage.setItem('indir_gitsin_history', JSON.stringify(h)); }
function formatHistoryDate(iso){
  try{
    const d=new Date(iso);
    const now=new Date();
    const diff=(now-d)/1000;
    if(diff<60) return 'az önce';
    if(diff<3600) return Math.floor(diff/60)+' dk önce';
    if(diff<86400) return Math.floor(diff/3600)+' saat önce';
    if(diff<172800) return 'dün';
    return d.toLocaleDateString('tr-TR', {day:'2-digit', month:'short'});
  }catch{return ''}
}
function renderHistory(){
  const h=loadHistory();
  const countEl=$('#historyCount');
  const navCountEl=$('#navHistoryCount');
  if(countEl){
    if(h.length>0){ countEl.textContent=h.length; countEl.classList.remove('hidden'); } else { countEl.classList.add('hidden'); }
  }
  if(navCountEl){
    if(h.length>0){ navCountEl.textContent=h.length; navCountEl.classList.remove('hidden'); } else { navCountEl.classList.add('hidden'); }
  }
  if(h.length===0){
    historyList.innerHTML=`<div class="history-empty"><div class="history-empty-icon">📭</div><b style="font-size:13px">Henüz indirme yok</b><p>İlk YouTube linkini yapıştır ve indir gitsin!</p></div>`;
    return;
  }
  historyList.innerHTML='';
  h.slice(0,18).forEach((item, idx)=>{
    const div=document.createElement('div'); div.className='history-item';
    const isAudio = (item.format||'').toLowerCase().includes('mp3') || (item.format||'').toLowerCase().includes('m4a') || (item.format||'').toLowerCase().includes('ses');
    const isVideo = (item.format||'').toLowerCase().includes('mp4') || (item.format||'').toLowerCase().includes('video');
    const badgeClass = isAudio ? 'audio' : isVideo ? 'video' : '';
    const badgeText = item.format || 'Görüntülendi';
    const timeText = formatHistoryDate(item.date);
    const playIcon = isAudio ? '🎵' : '▶';
    const playClass = isAudio ? 'audio' : '';
    div.innerHTML=`<img src="${item.thumb}" alt="" loading="lazy"><div class="history-item-main"><b title="${(item.title||'').replace(/"/g,'&quot;')}">${item.title||'Bilinmeyen Başlık'}</b><div class="history-item-meta"><span class="history-badge ${badgeClass}">${badgeText}</span><span class="history-time">${timeText}</span></div></div><div class="history-actions"><button class="history-play ${playClass}" title="Oynat">${playIcon}</button><button class="history-delete" title="Sil">✕</button></div>`;
    div.addEventListener('click',()=>{ if(window.switchTab) window.switchTab('indir'); urlInput.value=item.url; urlInput.dispatchEvent(new Event('input')); handleAnalyze(); window.scrollTo({top:0,behavior:'smooth'}); });
    const playBtn=div.querySelector('.history-play');
    if(playBtn) playBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      openHistoryPlayer(item);
    });
    const delBtn=div.querySelector('.history-delete');
    if(delBtn) delBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const nh=loadHistory();
      nh.splice(idx,1);
      saveHistory(nh);
      renderHistory();
      showStatus('Geçmişten silindi', 'info');
    });
    historyList.appendChild(div);
  });
}
function addToHistory(info, format){
  const h=loadHistory();
  // aynı url+format varsa başa taşı, duplicate engelle
  const existingIdx=h.findIndex(x=> x.url===info.url && x.format===format.label);
  if(existingIdx!==-1) h.splice(existingIdx,1);
  h.unshift({title:info.title, thumb:info.thumbnail, url:info.url, format:format.label, date:new Date().toISOString()});
  saveHistory(h.slice(0,30));
  renderHistory();
}

// Medya Oynatıcı - Geçmişteki video/müzik oynatma
async function openHistoryPlayer(item){
  const modal=$('#playerModal');
  const videoEl=$('#playerVideo');
  const audioEl=$('#playerAudio');
  const titleEl=$('#playerTitle');
  const subEl=$('#playerSub');
  const placeholder=$('#playerPlaceholder');
  const spinner=$('#playerSpinner');
  const openYt=$('#playerOpenYt');
  const dlBtn=$('#playerDownload');
  const container=$('#playerContainer');
  if(!modal) return;
  const isAudio = (item.format||'').toLowerCase().includes('mp3') || (item.format||'').toLowerCase().includes('m4a') || (item.format||'').toLowerCase().includes('ses') || (item.format||'').toLowerCase().includes('audio');
  if(titleEl) titleEl.textContent=item.title||'Oynatılıyor';
  if(subEl) subEl.textContent=isAudio ? 'Ses hazırlanıyor...' : 'Video hazırlanıyor...';
  if(placeholder){ placeholder.style.display='block'; placeholder.textContent=isAudio ? '🎵 Ses yükleniyor...' : '🎬 Video yükleniyor...'; }
  if(videoEl){ videoEl.style.display='none'; videoEl.pause(); videoEl.removeAttribute('src'); }
  if(audioEl){ audioEl.style.display='none'; audioEl.pause(); audioEl.removeAttribute('src'); }
  if(spinner) spinner.style.display='block';
  if(openYt) openYt.href=item.url;
  if(dlBtn) dlBtn.onclick=()=>{ if(window.switchTab) window.switchTab('indir'); modal.classList.add('hidden'); urlInput.value=item.url; urlInput.dispatchEvent(new Event('input')); handleAnalyze(); };
  modal.classList.remove('hidden');
  try{
    const info = await fetchInfo(item.url);
    let mediaUrl='';
    let mediaType='video';
    if(isAudio){
      const audioFmt = info.formats.find(f=> f.type==='audio' && f.url && f.url.startsWith('http')) || info.formats.find(f=> f.url && f.url.startsWith('http'));
      if(audioFmt){ mediaUrl=audioFmt.url; mediaType='audio'; }
    } else {
      const videoFmt = info.formats.find(f=> f.type==='video' && f.url && f.url.startsWith('http')) || info.formats.find(f=> f.url && f.url.startsWith('http'));
      if(videoFmt){ mediaUrl=videoFmt.url; mediaType= isAudio ? 'audio' : 'video'; }
    }
    if(!mediaUrl){
      // fallback: YouTube embed
      if(placeholder) placeholder.innerHTML=`Doğrudan oynatma linki alınamadı.<br><a href="${item.url}" target="_blank" style="color:#FF0033;text-decoration:underline">YouTube'da aç</a>`;
      if(subEl) subEl.textContent='YouTube üzerinden izleyin';
      if(spinner) spinner.style.display='none';
      return;
    }
    if(spinner) spinner.style.display='none';
    if(placeholder) placeholder.style.display='none';
    if(mediaType==='audio'){
      if(audioEl){
        audioEl.src=mediaUrl;
        audioEl.style.display='block';
        container.style.aspectRatio='auto';
        container.style.minHeight='80px';
        audioEl.play().catch(()=>{});
        if(subEl) subEl.textContent='🎵 Çalıyor • M4A/Audio';
      }
    } else {
      if(videoEl){
        videoEl.src=mediaUrl;
        videoEl.style.display='block';
        container.style.aspectRatio='16/9';
        container.style.minHeight='';
        videoEl.play().catch(()=>{});
        if(subEl) subEl.textContent='🎬 Çalıyor • MP4';
      }
    }
    if(dlBtn) dlBtn.onclick=()=>{
      modal.classList.add('hidden');
      if(videoEl) videoEl.pause();
      if(audioEl) audioEl.pause();
      if(window.switchTab) window.switchTab('indir');
      urlInput.value=item.url;
      urlInput.dispatchEvent(new Event('input'));
      handleAnalyze();
    };
  }catch(e){
    if(spinner) spinner.style.display='none';
    if(placeholder){ placeholder.style.display='block'; placeholder.textContent='Oynatma hatası: '+(e.message||e); }
    if(subEl) subEl.textContent='Hata oluştu';
  }
}
(function setupPlayerModal(){
  const modal=$('#playerModal');
  const close=$('#playerClose');
  const videoEl=$('#playerVideo');
  const audioEl=$('#playerAudio');
  function closePlayer(){
    modal?.classList.add('hidden');
    if(videoEl){ videoEl.pause(); videoEl.removeAttribute('src'); videoEl.style.display='none'; }
    if(audioEl){ audioEl.pause(); audioEl.removeAttribute('src'); audioEl.style.display='none'; }
  }
  close?.addEventListener('click', closePlayer);
  modal?.addEventListener('click', (e)=>{ if(e.target===modal) closePlayer(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && modal && !modal.classList.contains('hidden')) closePlayer(); });
  // Preview oynat butonu da aynı player ile çalsın
  $('#previewPlay')?.addEventListener('click', ()=>{
    if(!currentInfo) return showStatus('Önce bir link çözümle','error');
    const isAudioPreview = currentInfo.formats.some(f=> f.type==='audio' && f.url) && !currentInfo.formats.some(f=> f.type==='video' && f.url);
    const mockItem={title: currentInfo.title, url: currentInfo.url, format: isAudioPreview ? 'M4A' : 'MP4'};
    openHistoryPlayer(mockItem);
  });
})();

// Main analyze
async function handleAnalyze(){
  const url = urlInput.value.trim();
  if(!url) return showStatus('Lütfen bir YouTube linki yapıştırın.','error');
  if(!isYouTubeUrl(url)) return showStatus('Bu bir YouTube / YouTube Music linkine benzemiyor.','error');
  hideStatus(); setLoading(true);
  try{
    const info = await fetchInfo(url);
    currentInfo=info;
    renderPreview(info);
    renderOptions(info);
    showStatus('Video çözümlendi! Kalite seçip indirebilirsin.', 'success');
    addToHistory(info, {label:'Görüntülendi'}); // quick history
    setTimeout(()=> previewCard.scrollIntoView({behavior:'smooth', block:'nearest'}), 200);
  }catch(e){
    showStatus('Çözümleme hatası: '+(e.message||e), 'error');
  }finally{ setLoading(false); }
}

// Events
analyzeBtn.addEventListener('click', handleAnalyze);
urlInput.addEventListener('keydown', e=>{ if(e.key==='Enter') handleAnalyze(); });
urlInput.addEventListener('input', ()=>{
  const has = urlInput.value.trim().length>0;
  clearBtn.classList.toggle('hidden', !has);
  pasteBtn.classList.toggle('hidden', has);
});
clearBtn.addEventListener('click', ()=>{
  urlInput.value=''; clearBtn.classList.add('hidden'); pasteBtn.classList.remove('hidden');
  previewCard.classList.add('hidden'); optionsCard.classList.add('hidden'); hideStatus(); urlInput.focus();
});
pasteBtn.addEventListener('click', async()=>{
  try{
    const t=await navigator.clipboard.readText();
    if(t){ urlInput.value=t.trim(); urlInput.dispatchEvent(new Event('input')); handleAnalyze(); }
  }catch{
    showStatus('Panoya erişilemedi — lütfen manuel yapıştırın (Ctrl+V).','error');
  }
});
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click', ()=>{
  urlInput.value=c.dataset.sample; urlInput.dispatchEvent(new Event('input')); handleAnalyze();
}));
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click', ()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active'); activeFilter=t.dataset.filter;
  if(currentInfo) renderOptions(currentInfo);
}));
$('#clearHistory').addEventListener('click', ()=>{ localStorage.removeItem('indir_gitsin_history'); renderHistory(); });
$('#cancelDl').addEventListener('click', ()=> progressModal.classList.add('hidden'));
// Sekmeli navigasyon - İndir / İzle / Geçmiş / Hakkında
(function(){
  const tabs = {
    indir: $('#tab-indir'),
    izle: $('#tab-izle'),
    gecmis: $('#tab-gecmis'),
    hakkinda: $('#tab-hakkinda')
  };
  const navBtns = document.querySelectorAll('.bottom-nav .nav-item[data-tab]');
  window.switchTab = function(name){
    Object.entries(tabs).forEach(([k, el])=>{
      if(!el) return;
      el.classList.toggle('hidden', k!==name);
      el.classList.toggle('active', k===name);
    });
    navBtns.forEach(b=>{
      b.classList.toggle('active', b.dataset.tab===name);
    });
    window.scrollTo({top:0, behavior:'smooth'});
    if(name==='gecmis') renderHistory();
  };
  navBtns.forEach(b=>{
    b.addEventListener('click', ()=> switchTab(b.dataset.tab));
  });
  // History item tıklandığında İndir sekmesine dön
  const origRenderHistory = renderHistory;
  // expose
  window._switchTab = window.switchTab;
})();
// About modal (hem tab hem modal için)
(function(){
  const aboutModal=$('#aboutModal');
  const aboutClose=$('#aboutClose');
  const openAboutModalBtn=$('#openAboutModalBtn');
  function openAbout(){ aboutModal?.classList.remove('hidden'); }
  function closeAbout(){ aboutModal?.classList.add('hidden'); }
  openAboutModalBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });
  // Hakkında içindeki güncelle butonları (modal + tab)
  $('#aboutUpdateCheck')?.addEventListener('click', async()=>{
    const b=$('#aboutUpdateCheck');
    if(b){ b.textContent='⏳ Denetleniyor...'; b.disabled=true; }
    await checkForUpdate(true);
    setTimeout(()=>{ if(b){ b.textContent='🔄 Güncellemeyi Denetle'; b.disabled=false; } }, 1200);
  });
  $('#aboutTabUpdateCheck')?.addEventListener('click', async()=>{
    const b=$('#aboutTabUpdateCheck');
    if(b){ b.textContent='⏳ Denetleniyor...'; b.disabled=true; }
    await checkForUpdate(true);
    setTimeout(()=>{ if(b){ b.textContent='🔄 Güncellemeyi Denetle'; b.disabled=false; } }, 1200);
  });
})();
// Theme toggle - persisted + CSS variables
const THEME_KEY='indir_gitsin_theme';
function applyTheme(t){
  const isLight = t==='light';
  document.body.classList.toggle('light', isLight);
  const btn=$('#themeToggle');
  if(btn) btn.textContent = isLight ? '☀️' : '🌙';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isLight ? '#ffffff' : '#0a0a0f');
  // update bg blobs visibility via CSS, keep bg variable
}
const savedTheme = localStorage.getItem(THEME_KEY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
applyTheme(savedTheme);
$('#themeToggle').addEventListener('click', ()=>{
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// Sunucu ayarı (API base) - İSTEĞE BAĞLI, varsayılan doğrudan mod
(function(){
  const settingsModal=$('#settingsModal');
  const settingsBtn=$('#settingsBtn');
  const settingsClose=$('#settingsClose');
  const apiInput=$('#apiBaseInput');
  const apiTestBtn=$('#apiTestBtn');
  const apiSaveBtn=$('#apiSaveBtn');
  const apiTestResult=$('#apiTestResult');
  const apiUseLocalBtn=$('#apiUseLocalBtn');
  const apiClearBtn=$('#apiClearBtn');
  const serverStatus=$('#serverStatus');
  function updateServerStatus(){
    const base=getApiBase();
    const isN=isNative();
    // Sunucusuz doğrudan mod varsayılan - backend sadece yüksek kalite/MP3 için opsiyonel
    fetch(apiUrl('/api/health')).then(r=>r.ok?r.json():Promise.reject()).then(j=>{
      const ff=j.ffmpeg ? 'ffmpeg ✓' : 'ffmpeg ✗';
      const baseTxt = base ? base : 'yerel /api';
      if(serverStatus) serverStatus.innerHTML=`Doğrudan mod: <b style="color:#10b981">Aktif ✓</b> • Sunucu: <b style="color:#10b981">Bağlı</b> • ${ff} • <code>${baseTxt}</code> <span style="font-size:11px;opacity:0.7">(MP3/yüksek kalite için)</span>`;
      if(apiTestResult && settingsModal && !settingsModal.classList.contains('hidden')){
        apiTestResult.textContent=`✓ Bağlı — yt-dlp: ${j.yt_dlp ? 'var' : 'yok'}, ${ff}`; apiTestResult.style.color='#10b981';
      }
    }).catch(()=>{
      const baseTxt = base ? base : 'yok (doğrudan mod)';
      if(serverStatus) serverStatus.innerHTML=`Doğrudan mod: <b style="color:#10b981">Aktif ✓</b> • Sunucu: <b style="color:#6b7280">Gerekli değil</b> • <code>${baseTxt}</code> <span style="font-size:11px;opacity:0.7">MP4/M4A doğrudan cihaza iner • MP3 için ⚙️ isteğe bağlı</span>`;
      if(apiTestResult && settingsModal && !settingsModal.classList.contains('hidden')){
        apiTestResult.textContent=`Sunucu yok — ama doğrudan indirme aktif (Piped/Innertube). MP3 için sunucu ekleyebilirsin.`; apiTestResult.style.color='#6b7280';
      }
    });
  }
  function openSettings(){
    if(apiInput) apiInput.value=getApiBase();
    settingsModal?.classList.remove('hidden');
    updateServerStatus();
  }
  function closeSettings(){ settingsModal?.classList.add('hidden'); }
  settingsBtn?.addEventListener('click', openSettings);
  settingsClose?.addEventListener('click', closeSettings);
  settingsModal?.addEventListener('click', (e)=>{ if(e.target===settingsModal) closeSettings(); });
  apiTestBtn?.addEventListener('click', async()=>{
    const val=(apiInput.value||'').trim().replace(/\/$/,'');
    const testBase = val || '';
    const url = (testBase ? testBase : '') + '/api/health';
    apiTestResult.textContent='Test ediliyor...'; apiTestResult.style.color='var(--muted)';
    try{
      const r=await fetch(url);
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json();
      apiTestResult.textContent=`✓ Bağlı — yt-dlp:${j.yt_dlp?'var':'yok'} ffmpeg:${j.ffmpeg?'var':'yok'}`;
      apiTestResult.style.color='#10b981';
    }catch(e){
      apiTestResult.textContent='✗ Bağlanamadı: '+(e.message||e);
      apiTestResult.style.color='#ef4444';
    }
  });
  apiSaveBtn?.addEventListener('click', ()=>{
    const v=(apiInput.value||'').trim().replace(/\/$/,'');
    if(v && !/^https?:\/\//.test(v)){ apiTestResult.textContent='URL http:// veya https:// ile başlamalı'; apiTestResult.style.color='#ef4444'; return; }
    if(v) localStorage.setItem(API_BASE_KEY, v); else localStorage.removeItem(API_BASE_KEY);
    apiTestResult.textContent=v?`Kaydedildi: ${v}`:'Yerel /api kullanılacak'; apiTestResult.style.color='#10b981';
    updateServerStatus();
    setTimeout(closeSettings, 700);
  });
  apiUseLocalBtn?.addEventListener('click', ()=>{ if(apiInput) apiInput.value=''; apiTestResult.textContent='Yerel /api seçildi'; });
  apiClearBtn?.addEventListener('click', ()=>{ localStorage.removeItem(API_BASE_KEY); if(apiInput) apiInput.value=''; apiTestResult.textContent='Sıfırlandı'; updateServerStatus(); });
  // initial check + periodic
  updateServerStatus();
  setInterval(updateServerStatus, 8000);
  // expose for debugging
  window.updateServerStatus=updateServerStatus;
})();

// Share Target handling (PWA + Native Android SEND)
function handleSharedText(text){
  if(!text) return;
  const m = text.match(/https?:\/\/\S+/);
  const url = m ? m[0] : text;
  // clean trailing quotes / whitespace
  const clean = url.replace(/[\s"']+$/,'').trim();
  if(isYouTubeUrl(clean)){
    if(window.switchTab) window.switchTab('indir');
    urlInput.value = clean;
    urlInput.dispatchEvent(new Event('input'));
    setTimeout(handleAnalyze, 350);
    showStatus('Paylaşılan link alındı — çözümleniyor...','info');
  }
}
// expose for MainActivity.evaluateJavascript
window.handleSharedText = handleSharedText;

(function handleShareTarget(){
  const params=new URLSearchParams(location.search);
  // 1) PWA share_target: ?text=&title=&url=
  const sharedRaw = params.get('text') || params.get('url') || params.get('title') || '';
  // 2) native redirect: ?text=<youtube url>
  const directText = params.get('text');
  let candidate = '';
  if(directText && isYouTubeUrl(directText)){
    candidate = directText;
  } else if(sharedRaw){
    const ytMatch = sharedRaw.match(/https?:\/\/\S+/);
    candidate = ytMatch ? ytMatch[0] : sharedRaw;
  }
  // YouTube contains check
  if(candidate && (candidate.includes('youtube') || candidate.includes('youtu.be') || isYouTubeUrl(candidate))){
    // decode twice in case double-encoded from MainActivity
    try{ candidate = decodeURIComponent(candidate); }catch{}
    try{ candidate = decodeURIComponent(candidate); }catch{}
    handleSharedText(candidate);
    // clean URL without reload loop: history replace
    try{ history.replaceState({}, '', location.pathname); }catch{}
    return;
  }
  // also handle ?url= directly
  if(params.get('url') && isYouTubeUrl(params.get('url'))){
    handleSharedText(params.get('url'));
    try{ history.replaceState({}, '', location.pathname); }catch{}
  }
})();

// Capacitor App plugin - handle VIEW intents as fallback (https://localhost/?text= already handled above, but also appUrlOpen)
(function setupCapacitorShare(){
  if(!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return;
  const App = window.Capacitor.Plugins.App;
  App.getLaunchUrl && App.getLaunchUrl().then(res=>{
    if(res && res.url){
      const u = res.url;
      if(u.includes('youtube') || u.includes('youtu.be') || u.includes('text=')){
        const p = new URL(u).searchParams.get('text');
        if(p) handleSharedText(decodeURIComponent(p));
        else handleSharedText(u);
      }
    }
  }).catch(()=>{});
  App.addListener && App.addListener('appUrlOpen', (data)=>{
    const u = data && data.url;
    if(!u) return;
    try{
      const urlObj = new URL(u);
      const t = urlObj.searchParams.get('text') || urlObj.searchParams.get('url') || u;
      handleSharedText(decodeURIComponent(t));
    }catch{
      handleSharedText(u);
    }
  });
  // also listen for custom event from MainActivity bridge.triggerWindowJSEvent
  window.addEventListener('sharedText', (e)=>{
    try{
      const d = typeof e.detail === 'string' ? e.detail : (e.detail && e.detail.value) || '';
      if(d) handleSharedText(d);
    }catch{}
  });
})();

// --- Otomatik Güncelleme (GitHub Releases) ---
const APP_VERSION = '1.6.1';
const GITHUB_REPO = 'keremmkilincc-wq/indirgitsin';
const UPDATE_CHECK_KEY = 'indir_gitsin_update_dismiss';
const UPDATE_LAST_CHECK = 'indir_gitsin_last_check';
function parseVersion(v){ return String(v||'').replace(/^v/,'').split('.').map(n=>parseInt(n,10)||0); }
function compareVersions(a,b){
  const pa=parseVersion(a), pb=parseVersion(b);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){
    const da=pa[i]||0, db=pb[i]||0;
    if(da>db) return 1;
    if(da<db) return -1;
  }
  return 0;
}
function getApkUrl(release){
  if(!release) return `https://github.com/${GITHUB_REPO}/releases/latest`;
  const apk = (release.assets||[]).find(a=> a.name && a.name.endsWith('.apk')) || (release.assets||[])[0];
  return apk ? apk.browser_download_url : release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
}
async function fetchLatestRelease(){
  // 2 kaynak: API + redirect fallback
  try{
    const r = await fetchWithTimeout(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {}, 6000);
    if(r.ok){ const j=await r.json(); if(j.tag_name) return j; }
  }catch(e){ console.log('update API fail', e); }
  // fallback: try raw tag via releases/latest redirect (fetch html_url)
  try{
    const r2 = await fetchWithTimeout(`https://github.com/${GITHUB_REPO}/releases/latest`, {headers:{'Accept':'application/json'}}, 6000);
    // GitHub redirects to /releases/tag/vX - we can't easily parse, return null
  }catch{}
  return null;
}
function showUpdateBanner(release){
  const banner=$('#updateBanner');
  const title=$('#updateTitle');
  const text=$('#updateText');
  const btn=$('#updateBtn');
  const dismiss=$('#updateDismiss');
  const later=$('#updateLater');
  if(!banner || !release) return;
  const tag = release.tag_name || release.name || '';
  const ver = tag.replace(/^v/,'');
  if(title) title.textContent = `Yeni sürüm: v${ver} (mevcut v${APP_VERSION})`;
  if(text) text.textContent = (release.body||'Hata düzeltmeleri ve iyileştirmeler').slice(0,120) + (release.body && release.body.length>120 ? '…' : '');
  const apkUrl = getApkUrl(release);
  if(btn){
    btn.href = apkUrl;
    btn.textContent = apkUrl.endsWith('.apk') ? 'APK İndir' : 'Güncelle';
    btn.onclick = (e)=>{
      // Native ise Browser ile aç
      try{
        if(isNative() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser){
          e.preventDefault();
          window.Capacitor.Plugins.Browser.open({url: apkUrl});
        } else if(isNative() && window.Android && window.Android.download){
          e.preventDefault();
          const fn = `IndirGitsin-v${ver}.apk`;
          window.Android.download(apkUrl, fn);
          showStatus('Güncelleme indiriliyor... İndirilenler/IndirGitsin kontrol et', 'success');
        }
      }catch{}
    };
  }
  banner.classList.remove('hidden');
  const checkBtn=$('#updateCheckBtn');
  if(checkBtn) checkBtn.classList.remove('hidden');
  // Dismiss
  const hide = ()=>{ banner.classList.add('hidden'); };
  if(dismiss) dismiss.onclick = ()=>{ localStorage.setItem(UPDATE_CHECK_KEY, tag); hide(); };
  if(later) later.onclick = ()=>{ hide(); };
}
async function checkForUpdate(force=false){
  const last = parseInt(localStorage.getItem(UPDATE_LAST_CHECK)||'0',10);
  const now = Date.now();
  const dismissed = localStorage.getItem(UPDATE_CHECK_KEY)||'';
  if(!force && now - last < 4*60*60*1000) return; // 4 saatte bir
  localStorage.setItem(UPDATE_LAST_CHECK, String(now));
  try{
    const rel = await fetchLatestRelease();
    if(!rel || !rel.tag_name) {
      console.log('no release found');
      return;
    }
    const latest = rel.tag_name.replace(/^v/,'');
    if(dismissed && dismissed===rel.tag_name) return; // kullanıcı kapattı
    if(compareVersions(latest, APP_VERSION) > 0){
      showUpdateBanner(rel);
      console.log('update available', latest, '>', APP_VERSION);
    } else {
      console.log('app up-to-date', APP_VERSION);
      if(force) showStatus(`Uygulama güncel (v${APP_VERSION})`, 'success');
    }
  }catch(e){ console.log('update check error', e); }
}
// Otomatik tetikle
setTimeout(()=> checkForUpdate(false), 2500);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') checkForUpdate(false); });
window.addEventListener('focus', ()=> checkForUpdate(false));
(function setupUpdateBtn(){
  const b=$('#updateCheckBtn');
  if(!b) return;
  b.addEventListener('click', async()=>{
    b.textContent='⏳';
    await checkForUpdate(true);
    setTimeout(()=> b.textContent='🔄', 1500);
    // eğer banner hala hidden ise güncel mesajı zaten checkForUpdate gösterdi
    const banner=$('#updateBanner');
    if(banner && banner.classList.contains('hidden')){
      // force didn't find update -> banner hidden, kullanıcıya bilgi zaten verildi
    }
  });
  // Hakkında modal içine de versiyon göster
  const aboutVer = document.querySelector('#aboutModal p');
  // extra: periyodik 6 saat
  setInterval(()=> checkForUpdate(false), 6*60*60*1000);
})();

// === İzle Sekmesi — Tubular tarzı: ara + oynat + indir (sunucusuz, Piped/Innertube) ===
(function(){
  const izleInput = document.getElementById('izleSearchInput');
  const izleBtn = document.getElementById('izleSearchBtn');
  const izleClear = document.getElementById('izleClearBtn');
  const izleSpinner = document.getElementById('izleSearchSpinner');
  const izleText = document.getElementById('izleSearchText');
  const izleStatus = document.getElementById('izleStatusBox');
  const izleResults = document.getElementById('izleResults');
  const izleResultsTitle = document.getElementById('izleResultsTitle');
  const izleResultsCount = document.getElementById('izleResultsCount');
  const izleEmpty = document.getElementById('izleEmpty');
  const izleLoadMore = document.getElementById('izleLoadMore');
  const izlePlayerWrap = document.getElementById('izlePlayerWrap');
  const izleVideo = document.getElementById('izleVideo');
  const izlePlaceholder = document.getElementById('izlePlayerPlaceholder');
  const izleSpinnerP = document.getElementById('izlePlayerSpinner');
  const izleTitle = document.getElementById('izlePlayerTitle');
  const izleChannel = document.getElementById('izlePlayerChannel');
  const izleMeta = document.getElementById('izlePlayerMeta');
  const izleOpenYt = document.getElementById('izleOpenYtBtn');
  const izleDownloadBtn = document.getElementById('izleDownloadBtn');
  const izleShareBtn = document.getElementById('izleShareBtn');
  if(!izleInput || !izleResults) return;

  let izleNextPage = null;
  let izleCurrentQuery = 'trend';
  let izleCurrentItems = [];
  let izlePlayingId = null;
  let izleCache = {};

  function izleShowStatus(msg,type='info'){
    if(!izleStatus) return;
    izleStatus.textContent = msg;
    izleStatus.className = 'status ' + type;
    izleStatus.classList.remove('hidden');
    if(type==='success') setTimeout(()=>izleStatus.classList.add('hidden'),3000);
  }
  function izleHideStatus(){ izleStatus && izleStatus.classList.add('hidden'); }
  function izleSetLoading(v){
    if(izleBtn) izleBtn.disabled = v;
    if(izleText) izleText.textContent = v ? 'Aranıyor...' : 'Ara';
    if(izleSpinner) izleSpinner.classList.toggle('hidden', !v);
  }
  function izleFormatViews(n){
    if(!n) return '';
    const num = typeof n==='string' ? parseInt(n.replace(/\D/g,'')) : n;
    if(isNaN(num)) return String(n);
    if(num>=1000000) return (num/1000000).toFixed(1).replace('.0','')+'M';
    if(num>=1000) return (num/1000).toFixed(1).replace('.0','')+'B';
    return String(num);
  }

  const PIPED_HOSTS_IZLE = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.mha.fi',
    'https://pipedapi.r4fo.com'
  ];

  async function pipedSearch(query, filter='videos'){
    const q = encodeURIComponent(query);
    for(const host of PIPED_HOSTS_IZLE){
      try{
        const url = `${host}/search?q=${q}&filter=${filter}`;
        const r = await fetchWithTimeout(url, {}, 6000);
        if(!r.ok) continue;
        const j = await r.json();
        const items = j.items || j.results || [];
        if(items.length) return {items, nextpage: j.nextpage || null, source: host};
      }catch(e){ continue; }
    }
    throw new Error('Piped search failed');
  }
  async function pipedTrending(region='TR'){
    for(const host of PIPED_HOSTS_IZLE){
      try{
        const r = await fetchWithTimeout(`${host}/trending?region=${region}`, {}, 6000);
        if(!r.ok) continue;
        const j = await r.json();
        if(Array.isArray(j) && j.length) return {items: j, nextpage: null};
        if(j.items && j.items.length) return {items: j.items, nextpage: null};
      }catch(e){ continue; }
    }
    throw new Error('Trending failed');
  }
  async function innertubeSearch(query){
    const key='AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    const url=`https://www.youtube.com/youtubei/v1/search?key=${key}`;
    const clients=[
      {clientName:'ANDROID', clientVersion:'20.10.38'},
      {clientName:'WEB', clientVersion:'2.20250101.00.00'}
    ];
    for(const cl of clients){
      try{
        const body={context:{client:{...cl, hl:'tr', gl:'TR'}}, query, params:'EgIQAQ=='};
        let r;
        try{ r = await nativeFetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); }catch{ r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
        if(!r.ok) continue;
        const j=await r.json();
        const contents = j.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        let videos=[];
        for(const sec of contents){
          const itemSec = sec.itemSectionRenderer?.contents || [];
          for(const it of itemSec){
            const vr = it.videoRenderer;
            if(!vr) continue;
            const vid = vr.videoId;
            const title = vr.title?.runs?.[0]?.text || 'Bilinmeyen';
            const channel = vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || '';
            const thumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
            const duration = vr.lengthText?.simpleText || '';
            const views = vr.viewCountText?.simpleText || '';
            const uploadedAt = vr.publishedTimeText?.simpleText || '';
            videos.push({type:'stream', title, url:`/watch?v=${vid}`, thumbnail: thumb, uploaderName: channel, duration: duration, views: views, uploadedDate: uploadedAt, videoId: vid});
          }
        }
        if(videos.length) return {items: videos, nextpage: j.nextpage || null};
      }catch(e){ continue; }
    }
    throw new Error('Innertube search failed');
  }

  async function fetchIzle(query){
    const isTrend = query==='trend' || query==='trending';
    if(isTrend){
      try{ const t=await pipedTrending('TR'); return t; }catch(e){ console.log('trending piped fail',e); }
      // fallback to search "trend"
      query='trend turkiye';
    }
    // try piped search
    try{ const s=await pipedSearch(query); return s; }catch(e){ console.log('piped search fail',e); }
    // fallback innertube
    try{ const s2=await innertubeSearch(query); return s2; }catch(e){ console.log('innertube search fail',e); throw e; }
  }

  function normalizeItem(it){
    // piped item may have different fields
    const vid = it.videoId || extractId(it.url||'') || (it.url && it.url.match(/v=([^&]+)/)?.[1]) || '';
    // url may be /watch?v=xxx
    const url = vid ? `https://www.youtube.com/watch?v=${vid}` : (it.url?.startsWith('http')? it.url : `https://www.youtube.com${it.url||''}`);
    const thumb = it.thumbnail || it.thumbnailUrl || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    const durationSec = it.duration || 0;
    let durationStr='';
    if(typeof durationSec==='number' && durationSec>0) durationStr = formatDuration(durationSec);
    else if(typeof it.duration==='string') durationStr = it.duration;
    else if(it.durationText) durationStr = it.durationText;
    const views = it.views ? (typeof it.views==='number' ? izleFormatViews(it.views)+' görüntüleme' : String(it.views)) : (it.viewCountText||'');
    const channel = it.uploaderName || it.uploader || it.channel || it.author || '';
    const uploaded = it.uploadedDate || it.uploaded || '';
    return {vid, url, thumb, title: it.title||'Başlıksız', channel, durationStr, views, uploaded, raw: it};
  }

  function renderIzle(items, append=false){
    if(!append) izleResults.innerHTML='';
    if(!items || items.length===0){
      if(!append){ izleEmpty.classList.remove('hidden'); izleResultsCount.textContent='0 sonuç'; }
      return;
    }
    izleEmpty.classList.add('hidden');
    items.forEach(it=>{
      const n = normalizeItem(it);
      if(!n.vid) return;
      const card=document.createElement('div');
      card.className='izle-card';
      card.innerHTML=`
        <div class="izle-thumb">
          <img src="${n.thumb}" alt="" loading="lazy" onerror="this.src='https://img.youtube.com/vi/${n.vid}/hqdefault.jpg'">
          <span class="izle-duration">${n.durationStr||''}</span>
          ${n.views? `<span class="izle-views">${n.views}</span>`:''}
          <div class="izle-play-overlay"><span>▶</span></div>
        </div>
        <div class="izle-info">
          <b title="${n.title.replace(/"/g,'&quot;')}">${n.title}</b>
          <span class="izle-channel">${n.channel||'YouTube'}</span>
          <span class="izle-meta">${n.uploaded? n.uploaded+' • ':''}${n.views||''}</span>
        </div>
        <div class="izle-card-actions">
          <button class="ghost-btn izle-play-btn">▶ İzle</button>
          <button class="download-btn izle-dl-btn">⬇ İndir</button>
        </div>
      `;
      card.addEventListener('click', (e)=>{
        if(e.target.closest('.izle-dl-btn')) return;
        playIzleVideo(n);
      });
      card.querySelector('.izle-play-btn').addEventListener('click', (e)=>{ e.stopPropagation(); playIzleVideo(n); });
      card.querySelector('.izle-dl-btn').addEventListener('click', (e)=>{
        e.stopPropagation();
        // indir sekmesine yolla + çözümle
        if(window.switchTab) window.switchTab('indir');
        urlInput.value = n.url;
        urlInput.dispatchEvent(new Event('input'));
        handleAnalyze();
      });
      izleResults.appendChild(card);
    });
    izleResultsCount.textContent = `${izleResults.children.length} video`;
    // load more visibility
    if(izleNextPage) izleLoadMore.classList.remove('hidden'); else izleLoadMore.classList.add('hidden');
  }

  async function playIzleVideo(n){
    izlePlayingId = n.vid;
    izlePlayerWrap.classList.remove('hidden');
    izleTitle.textContent = n.title;
    izleChannel.textContent = n.channel ? n.channel + ' • ' + (n.views||'') : (n.views||'');
    izleMeta.textContent = n.uploaded || '';
    if(izleOpenYt) izleOpenYt.href = n.url;
    if(izleDownloadBtn) izleDownloadBtn.onclick = ()=>{
      if(window.switchTab) window.switchTab('indir');
      urlInput.value = n.url;
      urlInput.dispatchEvent(new Event('input'));
      handleAnalyze();
    };
    if(izleShareBtn) izleShareBtn.onclick = async()=>{
      try{ await navigator.clipboard.writeText(n.url); izleShowStatus('Link kopyalandı','success'); }catch{ izleShowStatus(n.url,'info'); }
    };
    if(izlePlaceholder){ izlePlaceholder.style.display='block'; izlePlaceholder.textContent='Video hazırlanıyor...'; }
    if(izleSpinnerP) izleSpinnerP.style.display='block';
    if(izleVideo){ izleVideo.style.display='none'; izleVideo.pause(); izleVideo.removeAttribute('src'); }
    izlePlayerWrap.scrollIntoView({behavior:'smooth', block:'start'});
    try{
      const info = await fetchInfo(n.url);
      // find best video stream
      let mediaUrl='';
      const vfmt = info.formats.find(f=> f.type==='video' && f.url && f.url.startsWith('http'));
      if(vfmt) mediaUrl = vfmt.url;
      else mediaUrl = info.formats.find(f=> f.url && f.url.startsWith('http'))?.url || '';
      if(!mediaUrl){
        if(izlePlaceholder) izlePlaceholder.innerHTML=`Doğrudan link alınamadı.<br><a href="${n.url}" target="_blank" style="color:#FF0033">YouTube'da aç</a>`;
        if(izleSpinnerP) izleSpinnerP.style.display='none';
        return;
      }
      if(izleSpinnerP) izleSpinnerP.style.display='none';
      if(izlePlaceholder) izlePlaceholder.style.display='none';
      if(izleVideo){
        izleVideo.src = mediaUrl;
        izleVideo.style.display='block';
        izleVideo.play().catch(()=>{});
      }
      if(izleChannel) izleChannel.textContent = info.channel + ' • ' + formatDuration(info.duration);
      if(izleMeta) izleMeta.textContent = info.views ? info.views + ' görüntüleme' : '';
      if(izleDownloadBtn) izleDownloadBtn.onclick = ()=>{
        // doğrudan mevcut info ile indir
        // indir sekmesine geçmeden de indirilebilir: en iyi mp4'ü indir
        const fmt = info.formats.find(f=> f.type==='video' && f.url) || info.formats[0];
        if(fmt) startDownload(info, fmt, izleDownloadBtn);
      };
    }catch(e){
      if(izleSpinnerP) izleSpinnerP.style.display='none';
      if(izlePlaceholder){ izlePlaceholder.style.display='block'; izlePlaceholder.textContent='Oynatma hatası: '+(e.message||e); }
    }
  }

  async function doIzleSearch(query, append=false){
    if(!query) return;
    izleCurrentQuery = query;
    if(!append){
      izleNextPage=null;
      izleResults.innerHTML='';
      izleHideStatus();
    }
    izleSetLoading(true);
    izleResultsTitle.textContent = query==='trend' ? '🔥 Trend — Keşfet' : `🔍 "${query}" sonuçları`;
    try{
      let res;
      const cacheKey = query + (append? '|page:'+izleNextPage:'');
      if(!append && izleCache[query]){
        res = izleCache[query];
      } else {
        if(append && izleNextPage){
          // Piped nextpage: fetch next page via /nextpage/search?nextpage=...&q=...
          // Simpler: pipedSearch with nextpage param not implemented, fallback to same query
          // Try piped search nextpage endpoint
          try{
            const host = PIPED_HOSTS_IZLE[0];
            const r = await fetchWithTimeout(`${host}/nextpage/search?nextpage=${encodeURIComponent(izleNextPage)}&q=${encodeURIComponent(query)}`,{},6000);
            if(r.ok){
              const j=await r.json();
              res={items: j.items||[], nextpage: j.nextpage||null};
            } else { res=await fetchIzle(query); }
          }catch{ res=await fetchIzle(query); }
        } else {
          res = await fetchIzle(query);
        }
        if(!append) izleCache[query]=res;
      }
      const items = res.items || [];
      izleCurrentItems = append ? izleCurrentItems.concat(items) : items;
      izleNextPage = res.nextpage || null;
      renderIzle(items, append);
      if(items.length===0) izleShowStatus('Sonuç bulunamadı','error');
    }catch(e){
      izleShowStatus('Arama hatası: '+(e.message||e)+' — Piped kapalı olabilir, tekrar dene','error');
      if(!append) renderIzle([],false);
    }finally{ izleSetLoading(false); }
  }

  // Events
  izleBtn.addEventListener('click', ()=> doIzleSearch(izleInput.value.trim()||'trend'));
  izleInput.addEventListener('keydown', e=>{ if(e.key==='Enter') doIzleSearch(izleInput.value.trim()||'trend'); });
  izleInput.addEventListener('input', ()=>{
    const has = izleInput.value.trim().length>0;
    izleClear.classList.toggle('hidden', !has);
  });
  izleClear.addEventListener('click', ()=>{
    izleInput.value=''; izleClear.classList.add('hidden'); izleInput.focus();
  });
  document.querySelectorAll('.izle-chip').forEach(c=>{
    c.addEventListener('click', ()=>{
      document.querySelectorAll('.izle-chip').forEach(x=>x.classList.remove('active'));
      c.classList.add('active');
      const q=c.dataset.q;
      izleInput.value = q==='trend' ? '' : q;
      izleClear.classList.toggle('hidden', !izleInput.value);
      doIzleSearch(q==='trend'?'trend':q);
    });
  });
  izleLoadMore.addEventListener('click', ()=> doIzleSearch(izleCurrentQuery, true));

  // Tab açıldığında otomatik trend yükle
  let izleLoaded=false;
  const origSwitch = window.switchTab;
  window.switchTab = function(name){
    if(origSwitch) origSwitch(name);
    // also handle izle lazy load
    if(name==='izle' && !izleLoaded){
      izleLoaded=true;
      doIzleSearch('trend');
    }
  };
  // expose
  window.doIzleSearch = doIzleSearch;
  window.playIzleVideo = playIzleVideo;
})();

// Auto paste on load if clipboard contains youtube link (mobile UX)
window.addEventListener('focus', async()=>{
  if(urlInput.value) return;
  try{
    const t=await navigator.clipboard.readText();
    if(t && isYouTubeUrl(t) && !sessionStorage.getItem('autoPasted')){
      sessionStorage.setItem('autoPasted','1');
      urlInput.value=t.trim(); urlInput.dispatchEvent(new Event('input'));
      showStatus('Panodaki YouTube linki bulundu — Çözümle\'ye bas!','info');
    }
  }catch{}
});

renderHistory();
