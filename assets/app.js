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

// Mock data for offline preview (when server not running)
function mockInfo(url){
  const id = extractId(url) || 'jNQXAC9IVRw';
  return {
    id,
    title: 'Örnek Video - İndir Gitsin Demo (Gerçek indirme için sunucuyu başlatın)',
    channel: 'Demo Kanal',
    duration: 212,
    views: '1.2M',
    thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    url,
    formats: [
      {id:'mp4_1080', label:'MP4 1080p (MP4)', ext:'mp4', quality:'1080p', type:'video', size:'', hasAudio:true},
      {id:'mp4_720', label:'MP4 720p (MP4)', ext:'mp4', quality:'720p', type:'video', size:'~45 MB', hasAudio:true, fps:30},
      {id:'mp4_480', label:'MP4 480p (MP4)', ext:'mp4', quality:'480p', type:'video', size:'~28 MB', hasAudio:true},
      {id:'mp4_360', label:'MP4 360p (MP4)', ext:'mp4', quality:'360p', type:'video', size:'~18 MB', hasAudio:true, fps:30},
      {id:'m4a', label:'M4A (Ses)', ext:'m4a', quality:'128kbps', type:'audio', size:'~3.5 MB'},
      {id:'mp3', label:'MP3 320kbps', ext:'mp3', quality:'320kbps', type:'audio', size:'~5 MB'},
    ]
  };
}

async function fetchInfo(url){
  // Try real server first (FastAPI), fallback to mock
  try{
    const r = await fetch(apiUrl(`/api/info?url=${encodeURIComponent(url)}`));
    if(r.ok){
      const j = await r.json();
      if(j.title) return j;
    }
  }catch(e){}
  // fallback
  await new Promise(res=>setTimeout(res, 700)); // fake delay for UX
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
    `;
    const btn = div.querySelector('.download-btn');
    btn.addEventListener('click', ()=> startDownload(info, f, btn));
    optionsList.appendChild(div);
  });
  optionsCard.classList.remove('hidden');
  if(filtered.length===0){
    optionsList.innerHTML='<p class="empty">Bu filtrede seçenek yok.</p>';
  }
}

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
    const dlUrl = apiUrl(`/api/download?url=${encodeURIComponent(info.url)}&format_id=${encodeURIComponent(format.id)}&ext=${format.ext}`);
    let serverAvailable=false;
    let healthData=null;
    try{ const h=await fetch(apiUrl(`/api/health`)); serverAvailable=h.ok; if(h.ok) healthData=await h.json().catch(()=>null); }catch{ serverAvailable=false; }

    if(serverAvailable){
      // fetch as blob to handle errors (ffmpeg/yt-dlp) properly
      progressText.textContent='Sunucuya bağlanıyor...';
      // For native APK: use Filesystem if available, otherwise Browser
      const native = isNative();
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

    // Mock download (demo - server yokken)
    await new Promise(r=>setTimeout(r, 1200));
    clearInterval(iv);
    progressFill.style.width='100%'; progressText.textContent='100%';
    await new Promise(r=>setTimeout(r,300));
    progressModal.classList.add('hidden');
    const blob = new Blob([`Demo dosya: ${info.title}\nFormat: ${format.label}\nURL: ${info.url}\n\nGerçek indirme için Python sunucusunu başlatın: python server/app.py`], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`${info.id}_${format.ext}.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
    showStatus('Demo indirildi (gerçek video için sunucuyu başlatın).', 'info');
    addToHistory(info, format);
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

// History
function loadHistory(){
  try{ return JSON.parse(localStorage.getItem('indir_gitsin_history')||'[]'); }catch{return []}
}
function saveHistory(h){ localStorage.setItem('indir_gitsin_history', JSON.stringify(h)); }
function renderHistory(){
  const h=loadHistory();
  if(h.length===0){ historyList.innerHTML='<p class="empty">Henüz indirme yok. İlk linkini yapıştır!</p>'; return; }
  historyList.innerHTML='';
  h.slice(0,12).forEach(item=>{
    const div=document.createElement('div'); div.className='history-item';
    div.innerHTML=`<img src="${item.thumb}" alt=""><div><b>${item.title}</b><span>${item.format} • ${new Date(item.date).toLocaleDateString('tr-TR')}</span></div>`;
    div.style.cursor='pointer';
    div.addEventListener('click',()=>{ urlInput.value=item.url; handleAnalyze(); window.scrollTo({top:0,behavior:'smooth'}); });
    historyList.appendChild(div);
  });
}
function addToHistory(info, format){
  const h=loadHistory();
  h.unshift({title:info.title, thumb:info.thumbnail, url:info.url, format:format.label, date:new Date().toISOString()});
  saveHistory(h.slice(0,20));
  renderHistory();
}

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
// About modal
(function(){
  const aboutModal=$('#aboutModal');
  const aboutBtn=$('#aboutBtn');
  const aboutClose=$('#aboutClose');
  function openAbout(){ aboutModal?.classList.remove('hidden'); }
  function closeAbout(){ aboutModal?.classList.add('hidden'); }
  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });
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

// Sunucu ayarı (API base) - Mobil APK için
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
    fetch(apiUrl('/api/health')).then(r=>r.ok?r.json():Promise.reject()).then(j=>{
      const ff=j.ffmpeg ? 'ffmpeg ✓' : 'ffmpeg ✗ (sadece M4A)';
      const baseTxt = base ? base : (isN ? 'https://localhost (APK yerel - çalışmaz!)' : 'yerel /api');
      if(serverStatus) serverStatus.innerHTML=`Sunucu: <b style="color:#10b981">Bağlı</b> • ${ff} • <code>${baseTxt}</code>`;
      if(apiTestResult && settingsModal && !settingsModal.classList.contains('hidden')){
        apiTestResult.textContent=`✓ Bağlı — yt-dlp: ${j.yt_dlp ? 'var' : 'yok'}, ${ff}`; apiTestResult.style.color='#10b981';
      }
    }).catch(()=>{
      const baseTxt = base ? base : (isN ? 'https://localhost (APK yerel)' : '/api');
      if(serverStatus) serverStatus.innerHTML=`Sunucu: <b style="color:#ef4444">Bağlı değil</b> • <code>${baseTxt}</code> ${isN ? '→ ⚙️ ile PC IP gir' : ''}`;
      if(apiTestResult && settingsModal && !settingsModal.classList.contains('hidden')){
        apiTestResult.textContent=`✗ Bağlanamadı (${base||'/api'})`; apiTestResult.style.color='#ef4444';
      }
      // native'de otomatik uyarı
      if(isN && !base && serverStatus){
        showStatus('Mobilde indirme için ⚙️ Sunucu ayarı → PC IP girin (aynı Wi-Fi).', 'info');
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
