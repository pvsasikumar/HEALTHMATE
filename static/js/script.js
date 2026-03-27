/* =============================================================
   HealthMate — script.js
   All frontend logic: auth, data, navigation, health tracking,
   reminders, fitness, AI chat, leaderboard, profile.
   ============================================================= */

/* ================================================================
   DATA STORE  (localStorage-backed key-value store)
   ================================================================ */
const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('hm_' + key)) || null; }
    catch { return null; }
  },
  set(key, val) {
    localStorage.setItem('hm_' + key, JSON.stringify(val));
  },
  getArr(key) { return this.get(key) || []; },
  pushArr(key, item) {
    const arr = this.getArr(key);
    arr.push(item);
    this.set(key, arr);
    return arr;
  }
};

// ---- Convenience wrappers ----
const getUsers  = ()      => DB.get('users') || {};
const saveUsers = (u)     => DB.set('users', u);
const getUserData   = (uid, key)      => DB.getArr(`u_${uid}_${key}`);
const addUserData   = (uid, key, item)=> DB.pushArr(`u_${uid}_${key}`, item);
const setUserData   = (uid, key, val) => DB.set(`u_${uid}_${key}`, val);

// ---- Date helpers ----
const todayStr = () => new Date().toISOString().split('T')[0];

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

// ---- Current session ----
let currentUser = null;

/* ================================================================
   AUTH
   ================================================================ */
function showSignup() {
  document.getElementById('loginWrap').classList.add('hidden');
  document.getElementById('signupWrap').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('signupWrap').classList.add('hidden');
  document.getElementById('loginWrap').classList.remove('hidden');
}

function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const users = getUsers();
  if (!u || !p) { showLoginError('Please fill in all fields.'); return; }
  if (!users[u] || users[u].password !== btoa(p)) {
    showLoginError('Invalid username or password.');
    return;
  }
  currentUser = { id: u, ...users[u] };
  DB.set('session', u);
  launchApp();
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function doSignup() {
  const u   = document.getElementById('suUser').value.trim();
  const p   = document.getElementById('suPass').value;
  const el  = document.getElementById('suError');
  el.classList.add('hidden');

  if (!u || !p) { el.textContent = 'Username and password are required.'; el.classList.remove('hidden'); return; }
  if (u.length < 3) { el.textContent = 'Username must be at least 3 characters.'; el.classList.remove('hidden'); return; }

  const users = getUsers();
  if (users[u]) { el.textContent = 'Username already taken.'; el.classList.remove('hidden'); return; }

  users[u] = {
    password: btoa(p),
    age:      document.getElementById('suAge').value,
    gender:   document.getElementById('suGender').value,
    height:   document.getElementById('suHeight').value,
    weight:   document.getElementById('suWeight').value,
    goal:     document.getElementById('suGoal').value,
    created:  new Date().toISOString()
  };
  saveUsers(users);
  notify('Account Created! 🎉', `Welcome to HealthMate, ${u}!`, 'success');
  showLogin();
}

function doLogout() {
  DB.set('session', null);
  currentUser = null;
  clearAllTimers();
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  // Close mobile sidebar if open
  closeSidebar();
}

function launchApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  initApp();
}

function checkSession() {
  const uid = DB.get('session');
  if (uid) {
    const users = getUsers();
    if (users[uid]) {
      currentUser = { id: uid, ...users[uid] };
      launchApp();
      return;
    }
  }
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
}

/* ================================================================
   APP INIT
   ================================================================ */
function initApp() {
  // Personalised greeting
  const hr    = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dashGreeting').textContent = `${greet}, ${currentUser.id}!`;

  refreshDashboard();
  refreshLeaderboard();
  renderReminders();
  loadProfile();
  startReminderTimers();
  refreshWorkoutStats();
  requestNotifPermission();
}

/* ================================================================
   MOBILE SIDEBAR TOGGLE
   ================================================================ */
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
  hamburger.classList.toggle('open');
}

function closeSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  hamburger && hamburger.classList.remove('open');
}

/* ================================================================
   NAVIGATION
   ================================================================ */
function navTo(page) {
  // Hide all pages, deactivate all nav items
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page and mark nav item active
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === page) n.classList.add('active');
  });

  // Refresh page-specific data
  if (page === 'dashboard')   refreshDashboard();
  if (page === 'leaderboard') refreshLeaderboard();
  if (page === 'health')      refreshHealthPage();
  if (page === 'fitness')     refreshWorkoutStats();
  if (page === 'profile')     { loadProfile(); updateBMI(); }
  if (page === 'reminders')   renderReminders();

  // Close mobile sidebar after navigation
  closeSidebar();
}

/* Health tab switcher */
function healthTab(tab) {
  ['water', 'glucose', 'bp', 'tablets'].forEach(t => {
    document.getElementById(`htab-${t}`).classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  if (tab === 'water')   refreshWaterUI();
  if (tab === 'glucose') renderGlucoseLog();
  if (tab === 'bp')      renderBPLog();
  if (tab === 'tablets') renderTabletList();
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function refreshDashboard() {
  const uid = currentUser.id;

  // Water stat
  const waterLogs  = getUserData(uid, 'water');
  const todayWater = waterLogs.filter(l => l.date === todayStr()).reduce((s, l) => s + l.amount, 0);
  document.getElementById('dashWater').textContent = todayWater;
  const pct = Math.min(100, Math.round(todayWater / 2000 * 100));
  document.getElementById('dashWaterBar').style.width = `${pct}%`;

  // Glucose stat
  const glucose = getUserData(uid, 'glucose');
  if (glucose.length)
    document.getElementById('dashGlucose').textContent = glucose[glucose.length - 1].value;

  // BP stat
  const bp = getUserData(uid, 'bp');
  if (bp.length) {
    const last = bp[bp.length - 1];
    document.getElementById('dashBP').textContent = `${last.sys}/${last.dia}`;
  }

  // Reminders count
  const reminders = getUserData(uid, 'reminders');
  document.getElementById('dashReminders').textContent = reminders.length;

  // Water log list (dashboard quick view)
  const todayLogs = waterLogs.filter(l => l.date === todayStr()).reverse().slice(0, 5);
  const wll = document.getElementById('waterLogList');
  if (!todayLogs.length) {
    wll.innerHTML = '<div class="empty"><span class="empty-icon">💧</span>No logs today</div>';
  } else {
    wll.innerHTML = todayLogs.map(l =>
      `<div class="log-item"><span>💧 ${l.amount} ml</span><span class="log-time">${fmtTime(l.ts)}</span></div>`
    ).join('');
  }

  // Medication reminders on dashboard
  const drl = document.getElementById('dashReminderList');
  if (!reminders.length) {
    drl.innerHTML = '<div class="empty"><span class="empty-icon">💊</span>No reminders set</div>';
  } else {
    drl.innerHTML = reminders.map(r => `
      <div class="reminder-item">
        <div>
          <div class="reminder-name">💊 ${r.name}
            <span class="badge badge-blue" style="margin-left:4px;">${r.dosage || ''}</span>
          </div>
          <div class="reminder-meta">${r.time} · ${r.freq}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="markTaken('${r.id}')">✓ Taken</button>
      </div>`
    ).join('');
  }

  // 7-day water trend chart
  drawWaterChart();
}

function drawWaterChart() {
  const uid = currentUser.id;
  const waterLogs = getUserData(uid, 'water');
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const total = waterLogs.filter(l => l.date === ds).reduce((s, l) => s + l.amount, 0);
    days.push({ label: d.toLocaleDateString([], { weekday: 'short' }), total });
  }

  const max   = Math.max(2000, ...days.map(d => d.total));
  const W = 600, H = 130, pad = 30, barW = 50, gap = (W - pad * 2 - 7 * barW) / 6;
  let svg = '';

  days.forEach((d, i) => {
    const x    = pad + i * (barW + gap);
    const barH = Math.round((d.total / max) * (H - 45));
    const y    = H - 20 - barH;
    const fill = d.total >= 2000 ? '#2563eb' : '#93c5fd';
    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="5" fill="${fill}"/>`;
    svg += `<text x="${x + barW / 2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="#6b7280">${d.label}</text>`;
    if (d.total > 0)
      svg += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="#1a1d27">${d.total}</text>`;
  });

  // Goal line
  const goalY = H - 20 - Math.round((2000 / max) * (H - 45));
  svg += `<line x1="${pad}" y1="${goalY}" x2="${W - pad}" y2="${goalY}" stroke="#ef4444" stroke-dasharray="4,3" stroke-width="1.5"/>`;
  svg += `<text x="${W - pad + 4}" y="${goalY + 4}" font-size="10" fill="#ef4444">Goal</text>`;

  document.getElementById('waterChart').innerHTML = svg;
}

/* ================================================================
   WATER LOGGING
   ================================================================ */
function logWater(amount) {
  addUserData(currentUser.id, 'water', {
    amount,
    date: todayStr(),
    ts: new Date().toISOString()
  });
  notify('Water Logged 💧', `+${amount} ml added`, 'success');
  refreshDashboard();
  refreshWaterUI();
}

function logCustomWater() {
  const v = parseInt(document.getElementById('customWater').value);
  if (!v || v <= 0) return;
  logWater(v);
  document.getElementById('customWater').value = '';
}

function logCustomWater2() {
  const v = parseInt(document.getElementById('customWater2').value);
  if (!v || v <= 0) return;
  logWater(v);
  document.getElementById('customWater2').value = '';
}

function refreshWaterUI() {
  const uid       = currentUser.id;
  const waterLogs = getUserData(uid, 'water');
  const todayTotal = waterLogs.filter(l => l.date === todayStr()).reduce((s, l) => s + l.amount, 0);
  const pct = Math.min(100, Math.round(todayTotal / 2000 * 100));

  // SVG ring on health page
  const ring = document.getElementById('waterRing');
  if (ring) ring.style.strokeDashoffset = 251.2 * (1 - pct / 100);
  const rp = document.getElementById('waterRingPct');
  if (rp) rp.textContent = `${pct}%`;
  const wc = document.getElementById('waterConsumed');
  if (wc) wc.textContent = `${todayTotal} ml`;

  // Full log list on health page
  const wfl = document.getElementById('waterFullLog');
  if (!wfl) return;
  const logs = [...waterLogs].reverse().slice(0, 20);
  if (!logs.length) { wfl.innerHTML = '<div class="empty">No logs yet</div>'; return; }
  wfl.innerHTML = logs.map(l =>
    `<div class="log-item"><span>💧 ${l.amount} ml</span><span class="log-time">${fmtDateTime(l.ts)}</span></div>`
  ).join('');
}

/* ================================================================
   GLUCOSE
   ================================================================ */
function logGlucose() {
  const v   = parseFloat(document.getElementById('glucoseVal').value);
  const ctx = document.getElementById('glucoseCtx').value;
  if (!v) return;
  addUserData(currentUser.id, 'glucose', { value: v, ctx, ts: new Date().toISOString(), date: todayStr() });
  document.getElementById('glucoseVal').value = '';
  notify('Glucose Logged 🩸', `${v} mg/dL (${ctx})`, 'info');
  renderGlucoseLog();
  refreshDashboard();
}

function glucoseStatus(v) {
  if (v < 70)   return { label: 'Low (Hypoglycemia)', cls: 'badge-red' };
  if (v <= 99)  return { label: 'Normal',              cls: 'badge-green' };
  if (v <= 125) return { label: 'Pre-diabetic range',  cls: 'badge-amber' };
  return               { label: 'High – see doctor',  cls: 'badge-red' };
}

function renderGlucoseLog() {
  const logs = [...getUserData(currentUser.id, 'glucose')].reverse().slice(0, 20);
  const el   = document.getElementById('glucoseLog');
  if (!logs.length) { el.innerHTML = '<div class="empty">No readings logged</div>'; return; }
  el.innerHTML = logs.map(l => {
    const s = glucoseStatus(l.value);
    return `<div class="log-item">
      <span>🩸 ${l.value} mg/dL <span class="badge ${s.cls}" style="margin-left:4px;">${s.label}</span></span>
      <span class="log-time">${fmtDateTime(l.ts)}</span>
    </div>`;
  }).join('');

  const last = logs[0];
  const s    = glucoseStatus(last.value);
  document.getElementById('glucoseStatus').innerHTML = `
    <div class="stat">
      <div class="stat-label">Latest Reading</div>
      <div class="stat-value">${last.value}</div>
      <div class="stat-unit">mg/dL</div>
    </div>
    <div style="margin-top:10px;">
      <span class="badge ${s.cls}" style="font-size:13px;padding:6px 14px;">${s.label}</span>
    </div>
    <div class="text-muted mt-2">${last.ctx} · ${fmtDateTime(last.ts)}</div>`;
}

/* ================================================================
   BLOOD PRESSURE
   ================================================================ */
function logBP() {
  const sys = parseFloat(document.getElementById('bpSys').value);
  const dia = parseFloat(document.getElementById('bpDia').value);
  if (!sys || !dia) return;
  addUserData(currentUser.id, 'bp', { sys, dia, ts: new Date().toISOString(), date: todayStr() });
  document.getElementById('bpSys').value = '';
  document.getElementById('bpDia').value = '';
  notify('BP Logged ❤️', `${sys}/${dia} mmHg`, 'info');
  renderBPLog();
  refreshDashboard();
}

function bpStatus(sys, dia) {
  if (sys < 90 || dia < 60)  return { label: 'Low',          cls: 'badge-blue' };
  if (sys < 120 && dia < 80) return { label: 'Normal',       cls: 'badge-green' };
  if (sys < 130 && dia < 80) return { label: 'Elevated',     cls: 'badge-amber' };
  if (sys < 140 || dia < 90) return { label: 'High Stage 1', cls: 'badge-red' };
  return                            { label: 'High Stage 2', cls: 'badge-red' };
}

function renderBPLog() {
  const logs = [...getUserData(currentUser.id, 'bp')].reverse().slice(0, 20);
  const el   = document.getElementById('bpLog');
  if (!logs.length) { el.innerHTML = '<div class="empty">No readings logged</div>'; return; }
  el.innerHTML = logs.map(l => {
    const s = bpStatus(l.sys, l.dia);
    return `<div class="log-item">
      <span>❤️ ${l.sys}/${l.dia} mmHg <span class="badge ${s.cls}" style="margin-left:4px;">${s.label}</span></span>
      <span class="log-time">${fmtDateTime(l.ts)}</span>
    </div>`;
  }).join('');

  const last = logs[0];
  const s    = bpStatus(last.sys, last.dia);
  document.getElementById('bpStatus').innerHTML = `
    <div class="stat">
      <div class="stat-label">Latest Reading</div>
      <div class="stat-value">${last.sys}/${last.dia}</div>
      <div class="stat-unit">mmHg</div>
    </div>
    <div style="margin-top:10px;">
      <span class="badge ${s.cls}" style="font-size:13px;padding:6px 14px;">${s.label}</span>
    </div>`;
}

/* ================================================================
   MEDICATIONS (Tablet list)
   ================================================================ */
function addTablet() {
  const name   = document.getElementById('tabName').value.trim();
  const dosage = document.getElementById('tabDosage').value.trim();
  const time   = document.getElementById('tabTime').value;
  if (!name) return;
  addUserData(currentUser.id, 'tablets', {
    name, dosage, time,
    id: Date.now().toString(),
    added: new Date().toISOString()
  });
  document.getElementById('tabName').value   = '';
  document.getElementById('tabDosage').value = '';
  document.getElementById('tabTime').value   = '';
  notify('Medication Added 💊', `${name} added to your list`, 'success');
  renderTabletList();
}

function renderTabletList() {
  const tablets = getUserData(currentUser.id, 'tablets');
  const el = document.getElementById('tabletList');
  if (!tablets.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">💊</span>No medications added</div>';
    return;
  }
  el.innerHTML = tablets.map(t => `
    <div class="reminder-item">
      <div>
        <div class="reminder-name">💊 ${t.name}
          <span class="badge badge-purple" style="margin-left:4px;">${t.dosage || ''}</span>
        </div>
        <div class="reminder-meta">${t.time || 'No time set'}</div>
      </div>
      <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:none;"
        onclick="removeTablet('${t.id}')">✕</button>
    </div>`
  ).join('');
}

function removeTablet(id) {
  setUserData(currentUser.id, 'tablets',
    getUserData(currentUser.id, 'tablets').filter(t => t.id !== id)
  );
  renderTabletList();
}

/* ================================================================
   REMINDERS  (with browser notification scheduling)
   ================================================================ */
const activeTimers = [];

function clearAllTimers() {
  activeTimers.forEach(t => clearTimeout(t));
  activeTimers.length = 0;
}

function addReminder() {
  const name   = document.getElementById('remName').value.trim();
  const dosage = document.getElementById('remDosage').value.trim();
  const time   = document.getElementById('remTime').value;
  const freq   = document.getElementById('remFreq').value;
  const notes  = document.getElementById('remNotes').value.trim();
  const notif  = document.getElementById('remNotif').checked;

  if (!name || !time) {
    notify('Missing Info', 'Please enter medication name and time.', 'error');
    return;
  }

  const id = Date.now().toString();
  addUserData(currentUser.id, 'reminders', {
    id, name, dosage, time, freq, notes, notif,
    created: new Date().toISOString()
  });

  // Clear form
  ['remName', 'remDosage', 'remNotes'].forEach(k => document.getElementById(k).value = '');
  document.getElementById('remTime').value = '';

  scheduleReminder({ id, name, dosage, time, freq, notif });
  notify('Reminder Set! 🔔', `${name} at ${time} (${freq})`, 'success');
  renderReminders();
  refreshDashboard();
}

function scheduleReminder(r) {
  const [h, m] = r.time.split(':').map(Number);
  const now  = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const t = setTimeout(() => {
    fireReminder(r);
    if (r.freq === 'daily' || r.freq === 'twice') {
      const interval = r.freq === 'twice' ? 12 * 3_600_000 : 24 * 3_600_000;
      const t2 = setInterval(() => fireReminder(r), interval);
      activeTimers.push(t2);
    }
  }, next - now);

  activeTimers.push(t);
}

function fireReminder(r) {
  notify('💊 Medication Reminder', `Time to take ${r.name} ${r.dosage || ''}`, 'reminder');
  if (r.notif && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('HealthMate Reminder', {
      body: `Time to take ${r.name} ${r.dosage || ''}`,
      icon: '/static/images/icon.png'
    });
  }
  const bell = document.querySelector(`[data-reminder-id="${r.id}"] .reminder-bell`);
  if (bell) {
    bell.classList.add('ringing');
    setTimeout(() => bell.classList.remove('ringing'), 10_000);
  }
}

function startReminderTimers() {
  clearAllTimers();
  getUserData(currentUser.id, 'reminders').forEach(r => scheduleReminder(r));
}

function deleteReminder(id) {
  setUserData(currentUser.id, 'reminders',
    getUserData(currentUser.id, 'reminders').filter(r => r.id !== id)
  );
  clearAllTimers();
  startReminderTimers();
  renderReminders();
  refreshDashboard();
}

function markTaken(id) {
  notify('Taken! ✅', 'Medication marked as taken', 'success');
}

function renderReminders() {
  const reminders = getUserData(currentUser.id, 'reminders');
  const el = document.getElementById('reminderList');
  if (!el) return;

  if (!reminders.length) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">🔔</span>No reminders set</div>';
  } else {
    el.innerHTML = reminders.map(r => `
      <div class="reminder-item" data-reminder-id="${r.id}">
        <div style="flex:1;">
          <div class="reminder-name">
            <span class="reminder-bell">🔔</span>
            ${r.name} <span class="badge badge-purple" style="margin-left:4px;">${r.dosage || ''}</span>
          </div>
          <div class="reminder-meta">${r.time} · ${r.freq}${r.notes ? ' · ' + r.notes : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <button class="btn btn-success btn-sm" onclick="markTaken('${r.id}')">✓ Taken</button>
          <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:none;"
            onclick="deleteReminder('${r.id}')">✕</button>
        </div>
      </div>`
    ).join('');
  }

  // Today's schedule timeline
  const tl = document.getElementById('reminderTimeline');
  if (!tl) return;
  if (!reminders.length) {
    tl.innerHTML = '<div class="empty">Set reminders to see your schedule here.</div>';
    return;
  }
  const sorted = [...reminders].sort((a, b) => a.time.localeCompare(b.time));
  const now    = new Date();
  tl.innerHTML = sorted.map(r => {
    const [h, m] = r.time.split(':').map(Number);
    const rDate  = new Date(); rDate.setHours(h, m, 0, 0);
    const isPast = rDate < now;
    const color  = isPast ? 'var(--muted)' : 'var(--accent)';
    const dotBg  = isPast ? 'var(--border)' : 'var(--accent)';
    return `
      <div class="timeline-row">
        <div class="timeline-time" style="color:${color};">${r.time}</div>
        <div class="timeline-dot" style="background:${dotBg};"></div>
        <div>
          <div class="timeline-label" style="color:${isPast ? 'var(--muted)' : 'var(--text)'};">${r.name} ${r.dosage || ''}</div>
          <div class="timeline-sub">${r.freq}${isPast ? ' · Past' : ' · Upcoming'}</div>
        </div>
      </div>`;
  }).join('');
}

/* ================================================================
   WORKOUT / FITNESS
   ================================================================ */
function logWorkout() {
  const type  = document.getElementById('exType').value;
  const dur   = parseInt(document.getElementById('exDur').value) || 0;
  const cal   = parseInt(document.getElementById('exCal').value) || 0;
  const notes = document.getElementById('exNotes').value.trim();
  if (!dur) { notify('Missing Info', 'Please enter the workout duration.', 'error'); return; }
  addUserData(currentUser.id, 'workouts', {
    type, dur, cal, notes,
    ts: new Date().toISOString(),
    date: todayStr()
  });
  ['exDur', 'exCal', 'exNotes'].forEach(k => document.getElementById(k).value = '');
  notify('Workout Logged! ⚡', `${type} · ${dur} mins`, 'success');
  refreshWorkoutStats();
}

function refreshWorkoutStats() {
  const workouts = getUserData(currentUser.id, 'workouts');
  const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const recent   = workouts.filter(w => new Date(w.ts) > weekAgo);

  document.getElementById('wkCount').textContent = recent.length;
  document.getElementById('wkMins').textContent  = recent.reduce((s, w) => s + w.dur, 0);
  document.getElementById('wkCals').textContent  = recent.reduce((s, w) => s + w.cal, 0);

  // Streak calculation
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.toISOString().split('T')[0];
    if (workouts.some(w => w.date === ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  document.getElementById('wkStreak').textContent = streak;

  // Workout log list
  const el = document.getElementById('workoutLog');
  if (!workouts.length) { el.innerHTML = '<div class="empty">No workouts logged yet</div>'; return; }
  el.innerHTML = [...workouts].reverse().slice(0, 20).map(w => `
    <div class="log-item">
      <span>⚡ <strong>${w.type}</strong> · ${w.dur} min${w.cal ? ' · ' + w.cal + ' cal' : ''}${w.notes ? ' · ' + w.notes : ''}</span>
      <span class="log-time">${fmtDateTime(w.ts)}</span>
    </div>`
  ).join('');
}

/* ================================================================
   HEALTH PAGE REFRESH
   ================================================================ */
function refreshHealthPage() {
  refreshWaterUI();
  renderGlucoseLog();
  renderBPLog();
  renderTabletList();
}

/* ================================================================
   AI COACH — Chat (calls Flask /chat endpoint → Gemini API)
   ================================================================ */
// Gemini conversation history (Gemini format: {role, parts:[{text}]})
let geminiHistory = [];

async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';

  addChatMsg(msg, 'user');
  geminiHistory.push({ role: 'user', parts: [{ text: msg }] });

  // Show typing indicator
  const typingEl = addChatMsg('', 'ai typing');
  typingEl.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

  // Build user context to personalise AI responses
  const uid       = currentUser.id;
  const todayWater = getUserData(uid, 'water').filter(l => l.date === todayStr()).reduce((s, l) => s + l.amount, 0);
  const glucose   = getUserData(uid, 'glucose');
  const bp        = getUserData(uid, 'bp');
  const reminders = getUserData(uid, 'reminders');
  const workouts  = getUserData(uid, 'workouts');
  const users     = getUsers();
  const prof      = users[uid] || {};
  const weekAgo   = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const systemContext =
    `User: age=${prof.age || '?'}, gender=${prof.gender || '?'}, ` +
    `height=${prof.height || '?'}cm, weight=${prof.weight || '?'}kg, goal=${prof.goal || 'general health'}. ` +
    `Today: water=${todayWater}ml/2000ml, ` +
    `last glucose=${glucose.length ? glucose[glucose.length - 1].value + ' mg/dL' : 'none'}, ` +
    `last BP=${bp.length ? bp[bp.length - 1].sys + '/' + bp[bp.length - 1].dia + ' mmHg' : 'none'}, ` +
    `reminders=${reminders.length}, ` +
    `workouts this week=${workouts.filter(w => new Date(w.ts) > weekAgo).length}.`;

  try {
    // Call Flask backend which calls Gemini API
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        // Send only last 10 turns to keep context window manageable
        history: geminiHistory.slice(-11, -1),
        system_context: systemContext
      })
    });

    const data = await response.json();
    typingEl.remove();

    if (!response.ok || data.error) {
      const errMsg = data.error || 'Something went wrong. Please try again.';
      addChatMsg(`⚠️ ${errMsg}`, 'ai');
      return;
    }

    addChatMsg(data.reply, 'ai');
    geminiHistory.push({ role: 'model', parts: [{ text: data.reply }] });

  } catch (err) {
    typingEl.remove();
    addChatMsg('⚠️ Could not reach the server. Make sure Flask is running and try again.', 'ai');
    console.error('Chat error:', err);
  }
}

function addChatMsg(text, cls) {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = `chat-msg ${cls}`;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function quickChat(msg) {
  document.getElementById('chatInput').value = msg;
  sendChat();
}

/* ================================================================
   LEADERBOARD
   ================================================================ */
function refreshLeaderboard() {
  const users  = getUsers();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const scores = Object.keys(users).map(uid => {
    const water    = getUserData(uid, 'water').filter(l => l.date === todayStr()).reduce((s, l) => s + l.amount, 0);
    const workouts = getUserData(uid, 'workouts').filter(w => new Date(w.ts) > weekAgo).length;
    const glucose  = getUserData(uid, 'glucose').length;
    const score    = Math.round(water / 100 + workouts * 10 + glucose * 5);
    return { uid, score, water, workouts };
  }).sort((a, b) => b.score - a.score);

  const el = document.getElementById('leaderboardList');
  if (!scores.length) { el.innerHTML = '<div class="empty">No users yet</div>'; return; }

  const medals   = ['🥇', '🥈', '🥉'];
  const rankCls  = ['gold', 'silver', 'bronze'];
  const isMe     = uid => uid === currentUser.id;

  el.innerHTML = scores.slice(0, 20).map((s, i) => `
    <div class="lb-row" style="${isMe(s.uid) ? 'border:1.5px solid var(--accent);' : ''}">
      <div class="lb-rank ${rankCls[i] || ''}">${medals[i] || '#' + (i + 1)}</div>
      <div class="lb-avatar">${s.uid[0].toUpperCase()}</div>
      <div class="lb-name">${s.uid}${isMe(s.uid) ? ' <span class="badge badge-blue" style="margin-left:4px;">You</span>' : ''}</div>
      <div class="lb-detail">${s.water} ml · ${s.workouts} workouts</div>
      <div class="lb-score">${s.score} pts</div>
    </div>`
  ).join('');
}

/* ================================================================
   PROFILE
   ================================================================ */
function loadProfile() {
  if (!currentUser) return;
  const users = getUsers();
  const prof  = users[currentUser.id] || {};

  document.getElementById('profUser').value   = currentUser.id;
  document.getElementById('profAge').value    = prof.age    || '';
  document.getElementById('profGender').value = prof.gender || '';
  document.getElementById('profHeight').value = prof.height || '';
  document.getElementById('profWeight').value = prof.weight || '';
  document.getElementById('profGoal').value   = prof.goal   || '';
  document.getElementById('profPhone').value  = prof.phone  || '';

  const uid   = currentUser.id;
  const stats = [
    { label: 'Total Water',       val: getUserData(uid, 'water').reduce((s, l) => s + l.amount, 0) + ' ml' },
    { label: 'Workouts Logged',   val: getUserData(uid, 'workouts').length },
    { label: 'Glucose Readings',  val: getUserData(uid, 'glucose').length },
    { label: 'BP Readings',       val: getUserData(uid, 'bp').length }
  ];

  document.getElementById('profileStats').innerHTML = `
    <div class="grid-2" style="gap:10px;">
      ${stats.map(s => `
        <div class="stat">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.val}</div>
        </div>`).join('')}
    </div>`;

  updateBMI();
}

function saveProfile() {
  const users = getUsers();
  const uid   = currentUser.id;
  users[uid]  = {
    ...users[uid],
    age:    document.getElementById('profAge').value,
    gender: document.getElementById('profGender').value,
    height: document.getElementById('profHeight').value,
    weight: document.getElementById('profWeight').value,
    goal:   document.getElementById('profGoal').value,
    phone:  document.getElementById('profPhone').value
  };
  saveUsers(users);
  currentUser = { id: uid, ...users[uid] };
  notify('Profile Saved ✅', 'Your profile has been updated.', 'success');
  updateBMI();
}

function updateBMI() {
  const users  = getUsers();
  const prof   = users[currentUser?.id] || {};
  const bmiEl  = document.getElementById('bmiVal');
  const bmiCat = document.getElementById('bmiCat');
  if (!bmiEl || !bmiCat) return;

  const h = parseFloat(prof.height);
  const w = parseFloat(prof.weight);
  if (!h || !w) { bmiEl.textContent = '--'; bmiCat.textContent = 'Enter height & weight'; return; }

  const bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
  const cat = bmi < 18.5 ? 'Underweight'
            : bmi < 25   ? 'Normal weight'
            : bmi < 30   ? 'Overweight'
            :               'Obese';
  bmiEl.textContent  = bmi;
  bmiCat.textContent = cat;
}

/* ================================================================
   NOTIFICATIONS
   ================================================================ */
function notify(title, body, type = 'info') {
  const icons  = { success: '✅', error: '❌', info: 'ℹ️', reminder: '🔔' };
  const colors = {
    success:  'var(--green)',
    error:    'var(--red)',
    info:     'var(--accent)',
    reminder: 'var(--amber)'
  };

  const container = document.getElementById('notifContainer');
  const div = document.createElement('div');
  div.className = 'notif';
  div.style.borderLeft = `3px solid ${colors[type] || colors.info}`;
  div.innerHTML = `
    <div class="notif-icon">${icons[type] || 'ℹ️'}</div>
    <div>
      <div class="notif-title">${title}</div>
      <div class="notif-body">${body}</div>
    </div>`;
  container.appendChild(div);

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    div.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ================================================================
   BOOT — run on page load
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  // Enter key submits login / signup
  document.getElementById('loginPass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // Overlay click closes sidebar
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

  // Chat input Enter key
  document.getElementById('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });
});
