/* ---------- Mobile app extras: settings, backup, install, offline ---------- */
// Each person links their own online closet; nothing personal ships with the app, so it is safe to share.
const getSynced = () => { try{ return localStorage.getItem('dixon.syncedUrl')||''; }catch{ return ''; } };
const syncedOK = u => /^https:\/\/claude\.ai\/(code\/)?artifact\/[A-Za-z0-9-]+\/?$/.test(u);
const appLink = () => location.origin + location.pathname.replace(/index\.html$/,'');
let installPrompt=null, setDraft={};
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installPrompt=e; if(sheetKind==='settings') drawSettings();
  const b=document.querySelector('#install-pill .btn'); if(b) b.dataset.act='install'; });
window.addEventListener('appinstalled',()=>{ document.getElementById('install-pill')?.remove(); toast('Installed. Open Dixon Closet from your home screen.'); });
const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);

/* ----- Install from any browser: one tap where the browser offers it, otherwise the exact taps for this browser ----- */
const SHARE_ICON='<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>';
function browserInfo(){
  const ua=navigator.userAgent, ios=isIOS(), android=/android/i.test(ua);
  const name = navigator.brave ? 'Brave' : /EdgiOS|EdgA|Edg\//.test(ua) ? 'Edge' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /OPR\/|OPiOS|Opera/.test(ua) ? 'Opera' : /DuckDuckGo/.test(ua) ? 'DuckDuckGo' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'your browser';
  const iosVer = ios ? parseFloat(((ua.match(/OS (\d+)[._](\d+)/)||[]).slice(1).join('.'))||'0') : 0;
  return { ios, android, desktop:!ios&&!android, name, iosVer, mac:/Macintosh/.test(ua)&&!ios };
}
// Steps for each browser and device. Third-party iPhone browsers can add to the home screen from iOS 16.4 on.
function installSteps(b){
  const add='<b>Add to Home Screen</b>', share=`<b>Share</b> ${SHARE_ICON}`;
  if(b.ios){
    if(b.name!=='Safari' && b.iosVer && b.iosVer<16.4) return [`Your iPhone’s version of iOS only installs apps from Safari. Copy the link below and open it in <b>Safari</b>.`];
    return ({
      Safari:[`Tap the ${share} button. In newer iOS it’s inside the <b>•••</b> button next to the address bar; in older iOS it’s in the bottom toolbar (scroll up a little if the toolbar is hidden).`,`Scroll down the list and tap ${add}. If it isn’t there, tap <b>Edit Actions</b> at the bottom and add it.`,'Turn on <b>Open as Web App</b> if you see it, then tap <b>Add</b>.'],
      Chrome:[`Tap the ${share} button in the address bar (top right), or the <b>•••</b> menu → <b>Share</b>.`,`Tap ${add}, then <b>Add</b>.`],
      Firefox:['Tap the <b>☰</b> menu (bottom right).',`Tap <b>Share</b>, then ${add}, then <b>Add</b>.`],
      Edge:['Tap the <b>•••</b> menu (bottom center).',`Tap <b>Share</b>, then ${add}, then <b>Add</b>.`],
      Brave:['Tap the <b>•••</b> menu (bottom right).',`Tap <b>Share with…</b>, then ${add}, then <b>Add</b>.`],
    })[b.name] || [`Open your browser’s menu and tap <b>Share</b>.`,`Tap ${add}. If you don’t see it, open this page in <b>Safari</b> instead.`];
  }
  if(b.android) return ({
    Firefox:['Tap the <b>⋮</b> menu.','Tap <b>Add app to Home screen</b> (or <b>Install</b>), then <b>Add</b>.'],
    'Samsung Internet':['Tap the <b>☰</b> menu (bottom right).','Tap <b>Add page to</b> → <b>Home screen</b>, then <b>Add</b>.'],
  })[b.name] || ['Tap the <b>⋮</b> menu (top right).','Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.'];
  if(b.mac && b.name==='Safari') return ['In the menu bar, choose <b>File</b> → <b>Add to Dock</b>.','Click <b>Add</b>. Dixon Closet opens from the Dock like any app.'];
  if(b.name==='Firefox') return ['Firefox on computers can’t install web apps yet. Open this link in <b>Chrome</b>, <b>Edge</b> or <b>Brave</b> to install it, or keep it bookmarked: it still works offline here.'];
  if(b.name==='Edge') return ['Click the <b>•••</b> menu (top right).','Choose <b>Apps</b> → <b>Install this site as an app</b>, then <b>Install</b>.'];
  return ['Click the install icon at the right end of the address bar, or open the <b>⋮</b> menu.','Choose <b>Cast, save and share</b> → <b>Install page as app</b> (or <b>Install Dixon Closet</b>), then <b>Install</b>.'];
}
function installGuideHTML(){
  if(isInstalled()) return '<p class="small muted">Installed. Dixon Closet opens from your home screen and works offline.</p>';
  const b=browserInfo(), steps=installSteps(b);
  const all=[['iPhone · Safari',{ios:true,name:'Safari',iosVer:18}],['iPhone · Chrome',{ios:true,name:'Chrome',iosVer:18}],['iPhone · Brave',{ios:true,name:'Brave',iosVer:18}],['iPhone · Firefox',{ios:true,name:'Firefox',iosVer:18}],['iPhone · Edge',{ios:true,name:'Edge',iosVer:18}],
    ['Android · Chrome, Brave or Edge',{android:true,name:'Chrome'}],['Android · Firefox',{android:true,name:'Firefox'}],['Android · Samsung Internet',{android:true,name:'Samsung Internet'}],
    ['Computer · Chrome or Brave',{desktop:true,name:'Chrome'}],['Computer · Edge',{desktop:true,name:'Edge'}],['Mac · Safari',{desktop:true,mac:true,name:'Safari'}],['Computer · Firefox',{desktop:true,name:'Firefox'}]];
  return `${installPrompt?`<p class="small muted">One tap installs Dixon Closet so it opens like an app and works offline.</p><div class="row" style="margin-top:10px"><button class="btn primary" data-act="install">Install app</button></div>`:''}
    <p class="small" style="margin:${installPrompt?'12px':'0'} 0 6px">${installPrompt?'Or by hand':'On this device'} (${esc(b.name)}${b.ios?' on iPhone':b.android?' on Android':''}):</p>
    <ol class="install-steps">${steps.map(s=>`<li>${s}</li>`).join('')}</ol>
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="copy-app">Copy app link</button></div>
    <details style="margin-top:10px"><summary class="small" style="cursor:pointer">Other browsers and devices</summary>
      ${all.map(([l,x])=>`<p class="small" style="margin:10px 0 4px"><b>${l}</b></p><ol class="install-steps">${installSteps(x).map(s=>`<li>${s}</li>`).join('')}</ol>`).join('')}</details>`;
}
function openInstall(){ openSheet(head('Install Dixon Closet')+`<div class="sheet-body"><div class="settings"><section>${installGuideHTML()}</section></div></div>`,{narrow:true,kind:'install'}); }
// A small reminder until it's installed or dismissed.
function showInstallPill(){
  let off=false; try{ off=localStorage.getItem('dixon.installPill')==='off'; }catch{}
  if(isInstalled() || off || document.getElementById('install-pill')) return;
  const el=document.createElement('div'); el.id='install-pill'; el.className='install-pill';
  el.innerHTML=`<button class="btn primary" data-act="${installPrompt?'install':'install-guide'}">Install the app</button><button class="icon-btn" data-act="install-pill-off" aria-label="Hide">✕</button>`;
  document.body.append(el);
}
{ const st=document.createElement('style'); st.textContent=`.install-steps{margin:0;padding-left:20px;display:grid;gap:6px;font-size:14px;line-height:1.45}
.install-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(86px + env(safe-area-inset-bottom));z-index:30;display:flex;gap:6px;align-items:center;padding:6px;border-radius:999px;background:var(--surface,#151515);border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.35)}
@media (min-width:760px){.install-pill{bottom:24px}}`; document.head.append(st); }
// The floating "Install the app" button is off by request; installing lives in Settings → Install the app.
document.getElementById('install-pill')?.remove();
if(new URLSearchParams(location.search).has('install')) setTimeout(openInstall,600);

async function storageLine(){
  try{
    const [est,kept]=await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]);
    const mb = est ? (est.usage/1048576).toFixed(1) : null;
    return `${mb!=null?mb+' MB used':''}${kept?' · Protected from automatic cleanup':' · The browser may clear this if the phone runs low on space. Install the app and keep a backup.'}`;
  }catch{ return ''; }
}
async function drawSettings(){
  const items=Store.docs.filter(d=>d.kind==='item').length, outfits=Store.docs.filter(d=>d.kind==='outfit').length;
  const sheet=$('#overlay .sheet'); if(!sheet) return;
  sheet.innerHTML = head('Settings')+`<div class="sheet-body"><div class="settings">
    ${typeof Sync!=='undefined'?Sync.settingsHTML():''}
    <section><h3>Install the app</h3>${installGuideHTML()}</section>
    <section><h3>Share with friends</h3>
      <p class="small muted">Send friends this link. They get their own empty Dixon Closet; nothing in yours is shared, and their closet stays on their phone.</p>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="share-app">Share app</button><button class="btn ghost" data-act="copy-app">Copy link</button></div>
      <p class="small muted" style="overflow-wrap:anywhere">${esc(appLink())}</p>
    </section>
    <section><h3>Your data</h3>
      <p class="small">${items} piece${items===1?'':'s'} and ${outfits} outfit${outfits===1?'':'s'}, saved on this device, photos included.</p>
      <p class="small muted" id="storage-line">Checking storage…</p>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="export">Download backup</button><button class="btn" data-act="import">Restore backup</button></div>
      <p class="small muted">A backup is one file with every piece, photo, outfit and recommendation. Restore it on a new phone to move your closet.</p>
    </section>
    <section><h3>AI features</h3>
      ${AI.key&&AI.provider==='openrouter'
        ? `<p class="small">Signed in to your AI account. Auto-fill, label scanning, exact-item matching, Shop check and recommendations are on, and it can look up live listings on the web.</p>
           <div class="form" style="margin-top:10px"><label class="field full"><span>Model (optional)</span><input id="set-model" autocomplete="off" spellcheck="false" placeholder="Automatic: picks the best AI for each task" value="${esc(AI.model)}"></label></div>
           <p class="small muted">Leave blank and it picks for you, or name one from openrouter.ai/models, e.g. a Claude, GPT, Gemini or Grok model.</p>
           <div class="row" style="margin-top:10px"><button class="btn" data-act="save-model">Save model</button><button class="btn ghost danger" data-act="ai-signout">Sign out</button></div>`
        : `<p class="small muted">Sign in to an AI account to turn on auto-fill, label scanning, exact-item matching, Shop check and recommendations. One OpenRouter account works with Claude, ChatGPT, Gemini and Grok. Sign in with Google or email, approve Dixon Closet, and you’re back here. No key to copy.</p>
           <div class="row" style="margin-top:10px"><button class="btn primary" data-act="ai-signin">Sign in to your AI account</button></div>
           <p class="small ${AI.key?'':'muted'}">${AI.key?`On, using your ${esc(PROVIDERS[AI.provider].label)} key.`:'Off. Everything else works without signing in.'}</p>`}
      <details style="margin-top:12px"${setDraft.provider?' open':''}><summary class="small" style="cursor:pointer">Advanced: use an API key instead</summary>
      <div class="form" style="margin-top:10px">
        <label class="field"><span>AI service</span><select id="set-provider">${Object.entries(PROVIDERS).map(([k,p])=>`<option value="${k}"${keyProvider()===k?' selected':''}>${p.label}</option>`).join('')}</select></label>
        <label class="field"><span>Model</span><input id="set-key-model" autocomplete="off" spellcheck="false" placeholder="${esc(PROVIDERS[keyProvider()].model)}" value="${esc(setDraft.model??(AI.provider===keyProvider()?AI.model:''))}"></label>
        <label class="field full"><span>API key</span><input id="set-key" type="password" autocomplete="off" spellcheck="false" placeholder="${esc(PROVIDERS[keyProvider()].hint)}" value="${AI.key&&AI.provider===keyProvider()&&!setDraft.provider?'••••••••••••':''}"></label>
      </div>
      <p class="small muted">Get a key at ${esc(PROVIDERS[keyProvider()].site)}. The key stays on this device and requests go straight to that company.</p>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="save-key">Save key</button>${AI.key&&AI.provider!=='openrouter'?'<button class="btn ghost danger" data-act="remove-key">Remove key</button>':''}</div>
      </details>
    </section>
  </div></div>`;
  const sl=await storageLine(); const el=$('#storage-line'); if(el) el.textContent=sl;
}
const keyProvider = () => setDraft.provider || AI.provider;

/* ----- Sign in to an AI account (OpenRouter's PKCE sign-in: the person approves the app and it gets a key for their own account) ----- */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function aiSignIn(){
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge=b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  try{ localStorage.setItem('dixon.aiVerifier',verifier); }catch{}
  const back=appLink()+'?ai_signin=1';
  location.href='https://openrouter.ai/auth?callback_url='+encodeURIComponent(back)+'&code_challenge='+challenge+'&code_challenge_method=S256';
}
async function aiFinishSignIn(){
  const q=new URLSearchParams(location.search); if(!q.has('ai_signin')) return;
  const code=q.get('code'); let verifier=''; try{ verifier=localStorage.getItem('dixon.aiVerifier')||''; localStorage.removeItem('dixon.aiVerifier'); }catch{}
  history.replaceState(null,'',location.pathname);
  if(!code||!verifier){ toast('AI sign-in was cancelled.'); return; }
  try{
    const r=await fetch('https://openrouter.ai/api/v1/auth/keys',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code, code_verifier:verifier, code_challenge_method:'S256' }) });
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.key) throw new Error(j?.error?.message||'no key');
    AI.set({provider:'openrouter',key:j.key,model:''}); render(); toast('Signed in to your AI account');
  }catch(e){ console.warn(e); toast('Couldn’t finish signing in. Try again from Settings.'); }
}
aiFinishSignIn();

function openSettings(){ openSheet('',{narrow:true,kind:'settings',refresh:drawSettings}); drawSettings(); }

async function exportBackup(btn){
  btn.disabled=true;
  try{
    const docs=Store.docs.map(d=>clean(d));
    const name=`dixon-closet-backup-${today()}.json`;
    const blob=new Blob([JSON.stringify({app:'dixon-closet',version:1,exportedAt:new Date().toISOString(),docs})],{type:'application/json'});
    const file=new File([blob],name,{type:'application/json'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file],title:'Dixon Closet backup'}); toast('Backup ready'); }catch(e){ if(e?.name!=='AbortError') throw e; }
    } else {
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.append(a); a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); toast('Backup downloaded');
    }
  }catch(e){ console.error(e); toast('Couldn’t create the backup. Try again.'); }
  btn.disabled=false;
}
async function importBackup(file){
  try{
    const data=JSON.parse(await file.text());
    const docs=Array.isArray(data?.docs)?data.docs:null;
    if(!['dixon-closet','hangtag-closet'].includes(data?.app)||!docs) throw new Error('not a backup'); // older backups used the first name
    let n=0;
    for(const d of docs){ if(d && typeof d.id==='string' && ['item','outfit','recs','prefs'].includes(d.kind)){ await Store.put(d.id,d); n++; } }
    const lost=docs.filter(d=>d?.kind==='item' && d.imgId && !d.imgData).length;
    toast(`Restored ${n} entr${n===1?'y':'ies'}${lost?` · ${lost} photo${lost===1?'':'s'} missing`:''}`);
    if(sheetKind==='settings') drawSettings();
  }catch(e){ console.error(e); toast('That file isn’t a Dixon Closet backup.'); }
}

Object.assign(ACT,{
  settings:()=>openSettings(),
  install:async()=>{ if(!installPrompt){ openInstall(); return; } installPrompt.prompt(); let ok=false; try{ ok=(await installPrompt.userChoice)?.outcome==='accepted'; }catch{} installPrompt=null;
    if(ok) document.getElementById('install-pill')?.remove(); if(sheetKind==='settings') drawSettings(); },
  'install-guide':()=>openInstall(),
  'install-pill-off':()=>{ try{ localStorage.setItem('dixon.installPill','off'); }catch{} document.getElementById('install-pill')?.remove(); },
  export:t=>exportBackup(t),
  import:()=>{ const f=$('#backup-file'); f.value=''; f.click(); },
  'ai-signin':()=>aiSignIn(),
  'ai-signout':()=>{ AI.set({}); setDraft={}; drawSettings(); render(); toast('Signed out of your AI account'); },
  'save-model':()=>{ AI.set({provider:AI.provider,key:AI.key,model:$('#set-model').value.trim()}); drawSettings(); toast('Saved'); },
  'save-key':()=>{ const provider=$('#set-provider').value, model=$('#set-key-model').value.trim(); let key=$('#set-key').value.trim();
    if(key.startsWith('••')) key=provider===AI.provider?AI.key:'';
    if(!key){ toast('Paste your API key first'); return; }
    const looks={ openrouter:/^sk-or-/, anthropic:/^sk-ant-/, openai:/^sk-/, gemini:/^AIza/, grok:/^xai-/ }[provider];
    if(looks && !looks.test(key)){ toast(`That doesn’t look like a ${PROVIDERS[provider].label} key`); return; }
    AI.set({provider,key,model}); setDraft={}; drawSettings(); render(); toast('Saved on this device'); },
  'remove-key':()=>{ AI.set({}); setDraft={}; drawSettings(); render(); toast('Key removed'); },
  'save-synced':()=>{ const v=$('#set-synced').value.trim();
    if(v && !syncedOK(v)){ toast('Paste the claude.ai/artifact link to your closet'); return; }
    try{ v?localStorage.setItem('dixon.syncedUrl',v):localStorage.removeItem('dixon.syncedUrl'); }catch{}
    drawSettings(); toast(v?'Link saved':'Link removed'); },
  'share-app':async()=>{ const url=appLink();
    if(navigator.share){ try{ await navigator.share({title:'Dixon Closet',text:'My digital closet app. Install it and build your own.',url}); }catch(e){ if(e?.name!=='AbortError') toast('Couldn’t open sharing. Copy the link instead.'); } }
    else ACT['copy-app'](); },
  'copy-app':async()=>{ try{ await navigator.clipboard.writeText(appLink()); toast('Link copied'); }catch{ toast('Couldn’t copy. Press and hold the link instead.'); } },
  'take-photo':()=>{ const f=$('#camera-file'); f.value=''; f.click(); },
});
// Switching the AI service redraws the hints for that service and clears the key field.
document.addEventListener('change',e=>{ if(e.target.id==='set-provider'){ setDraft={provider:e.target.value, model:''}; drawSettings(); } });
$('#backup-file').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) importBackup(f); });
$('#camera-file').addEventListener('change',e=>{ const f=e.target.files[0]; if(!f) return;
  if(!Add){ startAdd(f); return; } if(Add.editingId) Add.identified=true; loadPhoto(f); });

// Everything lives on the phone, so the closet keeps working with no connection; only AI features need one.
let wasOffline=!navigator.onLine;
window.addEventListener('offline',()=>{ wasOffline=true; toast('You’re offline. Your closet still works; AI features wait for a connection.'); });
window.addEventListener('online',()=>{ if(wasOffline) toast('Back online'); wasOffline=false; });

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn('offline mode unavailable',e)));
}
