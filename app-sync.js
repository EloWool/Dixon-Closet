/* ---------- Username sign-in and sync (Supabase) ----------
   The closet stays on the phone and works offline; when signed in, every change is also saved to
   the account's cloud copy and merged onto any other phone signed in with that username.
   Newest change wins. Deleted pieces are kept as tombstones so deletes sync too.
   Supabase accounts need an email, so a username maps to a private placeholder address that is never mailed. */
const SyncCfg = window.DIXON_SYNC || {};
const USER_DOMAIN = 'users.dixoncloset.app';
const usernameOk = u => /^[a-z0-9_.]{3,20}$/.test(u);
// A second copy of the sign-in, kept in the on-device database, which phones clear far less often than other storage.
const authBackup = {
  db(){ return this._db ||= new Promise((res, rej) => { const r = indexedDB.open('dixon-auth', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async op(mode, fn){ try{ const db = await this.db(); return await new Promise(res => { const t = db.transaction('kv', mode), r = fn(t.objectStore('kv')); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }catch{ return null; } },
  get(){ return this.op('readonly', s => s.get('rt')); },
  set(v){ return this.op('readwrite', s => s.put(v, 'rt')); },
  clear(){ return this.op('readwrite', s => s.delete('rt')); },
};
const Sync = {
  enabled: !!(SyncCfg.url && SyncCfg.anonKey),
  // New phones start on "Create an account"; a phone that has signed in before starts on "Sign in".
  client: null, user: null, running: false, again: false, error: '', mode: localStorage.getItem('dixon.sync.user') ? 'signin' : 'signup', isAdmin: false,
  get username(){ const u=this.user; return u ? (u.user_metadata?.username || (u.email||'').split('@')[0]) : ''; },
  lastPull: Number(localStorage.getItem('dixon.sync.last') || 0),
  dirty: new Set(JSON.parse(localStorage.getItem('dixon.sync.dirty') || '[]')),
  lastSynced: Number(localStorage.getItem('dixon.sync.at') || 0),

  save(){ try{ localStorage.setItem('dixon.sync.dirty', JSON.stringify([...this.dirty])); localStorage.setItem('dixon.sync.last', String(this.lastPull)); localStorage.setItem('dixon.sync.at', String(this.lastSynced)); }catch{} },
  mark(id){ this.dirty.add(id); this.save(); this.soon(); },
  soon(){ clearTimeout(this._t); this._t = setTimeout(() => this.syncNow(), 1500); },

  async init(){
    if(!this.enabled) return;
    try{
      const { createClient } = await import('./vendor/supabase.mjs');
      this.client = createClient(SyncCfg.url, SyncCfg.anonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
      let { data } = await this.client.auth.getSession();
      // Stay signed in: if the phone cleared the sign-in, bring it back from the backup copy.
      if(!data.session){ const rt=await authBackup.get(); if(rt){ try{ const r=await this.client.auth.refreshSession({ refresh_token:rt }); if(r.data?.session) data={ session:r.data.session }; }catch{} } }
      this.setUser(data.session?.user || null);
      // Defer: calling Supabase from inside its own auth callback can freeze the library.
      this.client.auth.onAuthStateChange((e, s) => {
        if(s?.refresh_token) authBackup.set(s.refresh_token);
        // A sign-out nobody asked for (a refresh that failed offline, say) is retried from the backup instead of dropping the account.
        if(e === 'SIGNED_OUT' && !this.leaving){ setTimeout(() => this.recover(), 0); return; }
        setTimeout(() => this.setUser(s?.user || null), 0); });
      if(data.session?.refresh_token) authBackup.set(data.session.refresh_token);
    }catch(e){ console.warn('sync unavailable', e); this.enabled = false; }
    setInterval(() => this.syncNow(), 60000);
    window.addEventListener('online', () => this.syncNow());
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') this.syncNow(); });
  },
  setUser(u){
    const was = this.user?.id; this.user = u;
    // Remember who signed in on this device, so the sign-in screen can fill in the username next time.
    if(u){ try{ localStorage.setItem('dixon.sync.lastName', this.username); }catch{} }
    if(u && localStorage.getItem('dixon.sync.user') !== u.id){
      // First sign-in on this phone (or a different account): send everything here up, then pull everything down.
      try{ localStorage.setItem('dixon.sync.user', u.id); }catch{}
      Store.docs.forEach(d => this.dirty.add(d.id)); this.lastPull = 0; this.save();
    }
    if(u && u.id !== was){ this.syncNow(); this.checkAdmin(); }
    if(!u) this.isAdmin = false;
    render(); if(sheetKind === 'settings') drawSettings();
  },
  async checkAdmin(){
    try{ const { data } = await this.client.rpc('is_app_admin'); this.isAdmin = data === true; }catch{ this.isAdmin = false; }
    if(sheetKind === 'settings') drawSettings();
  },
  // Admins only (enforced by the database): give a friend who forgot their password a new one.
  async resetFriend(username, password){
    const { error } = await this.client.rpc('admin_reset_password', { target_username:username, new_password:password });
    if(error) throw error;
  },
  async signUp(username, password){
    const { data, error } = await this.client.auth.signUp({ email:`${username}@${USER_DOMAIN}`, password, options:{ data:{ username } } });
    if(error) throw error;
    if(!data.session) throw { code:'confirm_on' }; // the project still requires email confirmation
  },
  async signIn(username, password){
    const { error } = await this.client.auth.signInWithPassword({ email:`${username}@${USER_DOMAIN}`, password });
    if(error) throw error;
  },
  async recover(){
    const rt=await authBackup.get(); let s=null;
    if(rt){ try{ const r=await this.client.auth.refreshSession({ refresh_token:rt }); s=r.data?.session||null; }catch{} }
    if(s) return; // onAuthStateChange delivers the restored session
    if(!navigator.onLine){ window.addEventListener('online', () => this.recover(), { once:true }); return; } // keep the account; try again when back online
    authBackup.clear(); this.setUser(null);
  },
  async signOut(){ this.leaving=true; await authBackup.clear(); try{ await this.client.auth.signOut(); } finally{ this.leaving=false; } try{ localStorage.removeItem('dixon.sync.user'); }catch{} this.dirty.clear(); this.lastPull = 0; this.save(); },
  // Removes the account and everything synced to it. The copy on this phone stays unless they delete it separately.
  async deleteAccount(){ const { error } = await this.client.rpc('delete_my_account'); if(error) throw error; await this.signOut(); },

  async syncNow(){
    if(!this.client || !this.user || !navigator.onLine) return;
    if(this.running){ this.again = true; return; }
    this.running = true; this.error = '';
    try{ await this.push(); await this.pull(); this.lastSynced = Date.now(); this.save(); }
    catch(e){ console.warn('sync failed', e); this.error = 'Couldn’t sync just now. Your changes are saved on this phone and will sync later.'; }
    this.running = false;
    if(sheetKind === 'settings') drawSettings();
    if(this.again){ this.again = false; this.syncNow(); }
  },
  async push(){
    const ids = [...this.dirty];
    for(let i = 0; i < ids.length; i += 5){ // small batches: each piece carries its photo
      const batch = ids.slice(i, i + 5), now = new Date().toISOString();
      const rows = batch.map(id => { const d = Store.get(id);
        return d ? { user_id:this.user.id, id, kind:d.kind || '', data:d, deleted:false, updated_at:new Date(d._u || Date.now()).toISOString() }
                 : { user_id:this.user.id, id, kind:'', data:null, deleted:true, updated_at:now }; });
      const { error } = await this.client.from('closet_docs').upsert(rows, { onConflict:'user_id,id' });
      if(error) throw error;
      batch.forEach(id => this.dirty.delete(id)); this.save();
    }
  },
  async pull(){
    let since = new Date(this.lastPull || 0).toISOString(), changed = false;
    for(;;){
      const { data, error } = await this.client.from('closet_docs').select('id,kind,data,deleted,updated_at')
        .gt('updated_at', since).order('updated_at', { ascending:true }).limit(50);
      if(error) throw error;
      if(!data.length) break;
      for(const row of data){
        const t = Date.parse(row.updated_at), local = Store.get(row.id);
        if(this.dirty.has(row.id) && (local?._u || 0) >= t) continue; // a newer local edit wins and will be pushed
        if(row.deleted){ if(local){ await Store.remove(local, { fromSync:true }); changed = true; } }
        else if(row.data && (!local || (local._u || 0) < t)){ await Store.put(row.id, { ...row.data, _u:t }, { fromSync:true }); changed = true; }
        since = row.updated_at; this.lastPull = t;
      }
      this.save();
      if(data.length < 50) break;
    }
    if(changed) onData();
  },

  settingsHTML(){
    if(!this.enabled) return `<section><h3>Account &amp; sync</h3><p class="small muted">Sync isn’t set up in this copy of the app yet. Your closet is saved on this device.</p></section>`;
    if(this.user) return `<section><h3>Account &amp; sync</h3>
      <p class="small">Signed in as <b>@${esc(this.username)}</b>. Sign in with the same username on another phone to see the same closet.</p>
      <p class="small muted">${this.running ? 'Syncing…' : this.lastSynced ? 'Last synced ' + new Date(this.lastSynced).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not synced yet'}${this.dirty.size ? ` · ${this.dirty.size} change${this.dirty.size === 1 ? '' : 's'} waiting` : ''}</p>
      ${this.error ? `<p class="small" style="color:var(--danger)">${esc(this.error)}</p>` : ''}
      <div class="row" style="margin-top:10px"><button class="btn" data-act="sync-now"${this.running ? ' disabled' : ''}>Sync now</button><button class="btn ghost" data-act="sync-out">Sign out</button></div>
      <div class="row" style="margin-top:6px"><button class="btn ghost danger" data-act="sync-delete">Delete my account</button></div>
      <p class="small muted">Deleting your account erases your synced closet from the cloud. The copy on this phone stays until you delete the app.</p></section>
      ${this.isAdmin ? `<section><h3>Reset a friend’s password</h3>
        <p class="small muted">For a friend who forgot their password. They’ll be signed out everywhere and can sign in with the new one, then keep using it.</p>
        <div class="form" style="margin-top:10px">
          <label class="field full"><span>Their username</span><input id="reset-user" autocapitalize="none" spellcheck="false" maxlength="20" autocomplete="off"></label>
          <label class="field full"><span>New password</span><input id="reset-pass" autocomplete="off" spellcheck="false" placeholder="At least 8 characters"></label>
        </div>
        <div class="row" style="margin-top:10px"><button class="btn primary" data-act="reset-friend">Reset password</button><button class="btn ghost" data-act="reset-gen">Make one up</button></div></section>` : ''}`;
    const up = this.mode === 'signup';
    return `<section><h3>Account &amp; sync</h3>
      <p class="small muted">${up?'Pick a username and password to back up your closet and keep it the same on every phone.':'Sign in to back up your closet and keep it the same on every phone.'}</p>
      <div class="form" style="margin-top:10px">
        <label class="field full"><span>Username</span><input id="sync-user" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="e.g. ronald_reagan" value="${up ? '' : esc(localStorage.getItem('dixon.sync.lastName') || '')}"></label>
        <label class="field full"><span>Password</span><input id="sync-pass" type="password" autocomplete="${up?'new-password':'current-password'}" placeholder="${up?'At least 8 characters':''}"></label>
        ${up?'<label class="field full"><span>Password again</span><input id="sync-pass2" type="password" autocomplete="new-password"></label>':''}
      </div>
      <p class="small muted">${up?'Write your password down.':'Forgot it?'} If you ever lose it, ask the person who shared Dixon Closet with you; they can set a new one for you.</p>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="sync-go">${up?'Create account':'Sign in'}</button><button class="btn ghost" data-act="sync-mode">${up?'I already have an account':'Create an account'}</button></div></section>`;
  },
};

// Every local change is stamped and queued for sync; changes that arrive from sync are not sent back.
{
  const put = Store.put.bind(Store), remove = Store.remove.bind(Store);
  Store.put = async (id, data, opt = {}) => { await put(id, opt.fromSync ? data : { ...data, _u:Date.now() }); if(!opt.fromSync && Sync.enabled) Sync.mark(id); };
  Store.remove = async (doc, opt = {}) => { await remove(doc); if(!opt.fromSync && Sync.enabled) Sync.mark(doc.id); };
  Store.note = () => Sync.user ? `Synced as @${Sync.username}` : 'Not synced · saved on this device';
}

// Shows a message right under the field that's wrong and puts the cursor there.
function fieldError(id, text){
  const input = $('#' + id); if(!input) { toast(text); return; }
  input.setAttribute('aria-invalid', 'true');
  let msg = input.closest('.field').querySelector('.field-error');
  if(!msg){ msg = document.createElement('small'); msg.className = 'field-error'; msg.setAttribute('role', 'alert'); input.closest('.field').append(msg); }
  msg.textContent = text; input.focus();
}
function clearFieldErrors(){ document.querySelectorAll('.field-error').forEach(e => e.remove()); document.querySelectorAll('[aria-invalid="true"]').forEach(e => e.removeAttribute('aria-invalid')); }
document.addEventListener('input', e => { if(e.target.getAttribute?.('aria-invalid')){ e.target.removeAttribute('aria-invalid'); e.target.closest('.field')?.querySelector('.field-error')?.remove(); } });
{ const s = document.createElement('style'); s.textContent = '.field-error{color:var(--danger);font-size:13px;font-weight:600;margin-top:2px}.field input[aria-invalid="true"]{border-color:var(--danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--danger) 18%,transparent)}'; document.head.append(s); }

Object.assign(ACT, {
  'reset-gen': () => { const words='coat,boot,knit,denim,linen,suede,tweed,flannel,canvas,cotton'.split(','), w=()=>words[Math.floor(Math.random()*words.length)];
    $('#reset-pass').value = `${w()}-${w()}-${Math.floor(100+Math.random()*900)}`; },
  'reset-friend': async t => {
    const username = $('#reset-user').value.trim().toLowerCase(), pass = $('#reset-pass').value.trim();
    if(!usernameOk(username)){ toast('Enter their username'); return; }
    if(pass.length < 8){ toast('Use a password of at least 8 characters'); return; }
    t.disabled = true;
    try{ await Sync.resetFriend(username, pass); toast(`Done. Tell @${username} their new password: ${pass}`); $('#reset-user').value=''; }
    catch(e){ const m = e?.message || '';
      toast(/no account/i.test(m) ? 'There’s no account with that username.' : /only an admin/i.test(m) ? 'Only admins can reset passwords.' : 'Couldn’t reset it. Check your connection and try again.'); }
    t.disabled = false; },
  'sync-mode': () => { Sync.mode = Sync.mode === 'signup' ? 'signin' : 'signup'; drawSettings(); },
  'sync-go': async t => {
    clearFieldErrors();
    const username = $('#sync-user').value.trim().toLowerCase(), pass = $('#sync-pass').value, up = Sync.mode === 'signup';
    if(!usernameOk(username)) return fieldError('sync-user', 'Use 3–20 letters, numbers, dots or underscores. No spaces.');
    if(!pass) return fieldError('sync-pass', 'Enter your password.');
    if(up && pass.length < 8) return fieldError('sync-pass', 'Use at least 8 characters.');
    if(up && pass !== $('#sync-pass2').value) return fieldError('sync-pass2', 'This doesn’t match the password above.');
    t.disabled = true;
    try{ await (up ? Sync.signUp(username, pass) : Sync.signIn(username, pass)); toast(up ? 'Account created. Syncing your closet…' : 'Signed in. Syncing your closet…'); }
    catch(e){ t.disabled = false; const m = e?.message || '';
      if(e?.code === 'confirm_on') return fieldError('sync-user', 'Sign-up is switched off on the server: “Confirm email” needs to be turned off in Supabase.');
      if(/already registered|already exists/i.test(m)) return fieldError('sync-user', `@${username} is taken. Pick another, or tap “I already have an account” to sign in.`);
      if(/invalid login|invalid credentials/i.test(m)){
        let exists = null; try{ const { data } = await Sync.client.rpc('username_exists', { target_username:username }); exists = data; }catch{}
        if(exists === false) return fieldError('sync-user', `There’s no account called @${username}. Check the spelling, or tap “Create an account”.`);
        if(exists === true) return fieldError('sync-pass', `Wrong password for @${username}. Forgot it? Ask whoever shared the app to reset it.`);
        return fieldError('sync-pass', 'That username and password don’t match.');
      }
      if(/password/i.test(m) && /weak|short|least/i.test(m)) return fieldError('sync-pass', 'Pick a stronger password: at least 8 characters.');
      toast(/rate|too many/i.test(m) ? 'Too many tries. Wait a minute and try again.' : 'Couldn’t reach the server. Check your connection and try again.'); } },
  'sync-now': () => Sync.syncNow(),
  'sync-delete': t => armDelete(t, async () => { try{ await Sync.deleteAccount(); toast('Account deleted'); drawSettings(); render(); }
    catch{ toast('Couldn’t delete the account. Check your connection and try again.'); } }),
  'sync-out': async () => { await Sync.signOut(); toast('Signed out. Your closet stays on this phone.'); drawSettings(); render(); },
});
document.addEventListener('keydown', e => { if(e.key === 'Enter' && /^sync-(user|pass2?)$/.test(e.target.id)){ e.preventDefault(); ACT['sync-go']($('[data-act="sync-go"]')); } });

Sync.init();
