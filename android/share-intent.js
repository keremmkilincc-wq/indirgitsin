// Android Share Intent'i JS tarafında yakala (Capacitor App plugin)
// YouTube -> Paylaş -> İndir Gitsin -> bu kod URL'i otomatik çözer

import { App } from '@capacitor/app';

// Uygulama kapalıyken gelen intent
App.getLaunchUrl().then(({url})=>{
  if(url) handleIncoming(url);
});

// Uygulama açıkken gelen intent
App.addListener('appUrlOpen', ({url})=>{
  handleIncoming(url);
});

// Android SEND (text/plain) için extra: WebView URL param olarak gelir
// ör: https://.../?text=https://youtube.com/watch?v=...
function handleIncoming(url){
  try{
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/https?:\/\/\S+/);
    const yt = match ? match[0] : decoded;
    if(yt.includes('youtube') || yt.includes('youtu.be')){
      const input = document.getElementById('urlInput');
      if(input){
        input.value = yt;
        input.dispatchEvent(new Event('input'));
        // analyze tetikle (app.js'deki global fonksiyon)
        if(window.handleAnalyze) window.handleAnalyze();
        else document.getElementById('analyzeBtn')?.click();
      }
    }
  }catch(e){ console.log('share handle error', e); }
}
