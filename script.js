/* ============================================================
   ⚙️ PENGATURAN
   ============================================================ */
const RADIUS_METER = 100;         
const CHECK_INTERVAL = 15000;     
const MIN_AKURASI = 200;          

/* ============================================================
   STATE & IKON
   ============================================================ */
let watchId = null;
let timerId = null;
let currentUser = null;

const icons = {
  pin: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  target: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
  ruler: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7 15.3 2.7c-.4-.4-1-.4-1.4 0L2.7 13.9c-.4.4-.4 1 0 1.4l6 6c.4.4 1 .4 1.4 0l11.2-11.2c.4-.4.4-1 0-1.4zM14 8l2 2M9 13l2 2M4 18l2 2"></path></svg>`,
  building: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>`,
  check: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  clock: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  trash: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
  refresh: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`,
  warning: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
};

/* ============================================================
   UTIL & DATABASE LOKAL
   ============================================================ */
function hitungJarak(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function tanggalHariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.className = `toast show ${type}`;
  toast.innerHTML = (type === 'success' ? icons.check : icons.warning) + ' ' + msg;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function getUserKey(key) {
  return `${key}_${currentUser}`;
}

function getLokasiKerja() {
  const raw = localStorage.getItem(getUserKey('lokasi_kerja'));
  return raw ? JSON.parse(raw) : null;
}

function simpanLokasiKerja(lat, lng, akurasi) {
  const data = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)), akurasi: Math.round(akurasi), disimpanPada: Date.now() };
  localStorage.setItem(getUserKey('lokasi_kerja'), JSON.stringify(data));
  return data;
}

function hapusLokasiKerja() {
  if (!confirm('Hapus lokasi kerja yang tersimpan?')) return;
  localStorage.removeItem(getUserKey('lokasi_kerja'));
  renderSetupCard();
  renderBanner();
  setStatus('waiting', 'Lokasi kerja belum diatur');
}

function sudahAbsenHariIni() {
  return localStorage.getItem(getUserKey('absensi_last_date')) === tanggalHariIni();
}

/* ============================================================
   AUTHENTICATION (LOGIN / REGISTER)
   ============================================================ */
function switchAuth(type) {
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('registerForm').classList.remove('active');
  document.getElementById(type + 'Form').classList.add('active');
}

function handleRegister(e) {
  e.preventDefault();
  const id = document.getElementById('regId').value.trim().toLowerCase();

  let users = JSON.parse(localStorage.getItem('app_users') || '{}');

  if (users[id]) {
    showToast('ID sudah terdaftar! Gunakan ID lain.', 'error');
    return;
  }

  users[id] = true; 
  localStorage.setItem('app_users', JSON.stringify(users));

  showToast('Registrasi berhasil! Silakan login.');
  switchAuth('login');
  document.getElementById('loginId').value = id;
  document.getElementById('regId').value = '';
}

function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('loginId').value.trim().toLowerCase();

  let users = JSON.parse(localStorage.getItem('app_users') || '{}');

  if (!users[id]) {
    showToast('ID tidak ditemukan. Silakan daftar dulu.', 'error');
    return;
  }

  currentUser = id;
  localStorage.setItem('app_session', id);
  showToast('Login berhasil!');
  masukKeAplikasi();
}

function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar?')) return;
  localStorage.removeItem('app_session');
  currentUser = null;
  
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (timerId !== null) clearInterval(timerId);

  document.getElementById('appView').classList.remove('active');
  document.getElementById('authView').classList.add('active');
}

function masukKeAplikasi() {
  document.getElementById('authView').classList.remove('active');
  document.getElementById('appView').classList.add('active');
  
  const namaTampil = currentUser;
  document.getElementById('userName').textContent = namaTampil;
  document.getElementById('userAvatar').textContent = namaTampil.charAt(0).toUpperCase();

  renderLog();
  renderBanner();
  renderSetupCard();
  
  startTracking();
}

/* ============================================================
   UI ELEMENTS & RENDER
   ============================================================ */
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const gpsInfo = document.getElementById('gpsInfo');
const logList = document.getElementById('logList');
const absenBanner = document.getElementById('absenBanner');
const lokasiTersimpanInfo = document.getElementById('lokasiTersimpanInfo');
const btnAmbil = document.getElementById('btnAmbil');

function setStatus(cls, text) {
  dot.className = 'status-indicator ' + cls;
  statusText.textContent = text;
}

function renderLog() {
  const logs = JSON.parse(localStorage.getItem(getUserKey('absensi_log')) || '[]');
  if (logs.length === 0) {
    logList.innerHTML = '<div class="info-row" style="color: var(--text-muted); font-size: 0.85rem;">Belum ada data absensi.</div>';
    return;
  }
  logList.innerHTML = logs.slice().reverse().map(l => `
    <div class="log-item">
      <span class="badge-in">${icons.check} MASUK</span>
      <span>${new Date(l.waktu).toLocaleString('id-ID')}</span>
    </div>
  `).join('');
}

function renderBanner() {
  if (!getLokasiKerja()) {
    absenBanner.innerHTML = `
      <div class="banner warning">
        <div style="display:flex; align-items:flex-start; gap:8px;">
          ${icons.warning}
          <div><b>Lokasi kerja belum diatur.</b><br>
          Buka halaman ini di lokasi kerja, lalu tekan tombol <b>"Ambil & Simpan Lokasi Ini"</b> di bawah.</div>
        </div>
      </div>`;
    return;
  }
  if (sudahAbsenHariIni()) {
    const waktu = localStorage.getItem(getUserKey('absensi_last_time'));
    const jam = waktu ? new Date(Number(waktu)).toLocaleTimeString('id-ID') : '-';
    absenBanner.innerHTML = `
      <div class="banner success">
        ${icons.check}
        ABSEN HARI INI SUDAH SELESAI
        <span class="banner-time">
          ${icons.clock} Pukul ${jam} • Tidak akan tercatat ganda
        </span>
      </div>`;
  } else {
    absenBanner.innerHTML = '';
  }
}

function renderSetupCard() {
  const lok = getLokasiKerja();
  if (!lok) {
    lokasiTersimpanInfo.innerHTML = '';
    btnAmbil.innerHTML = `${icons.pin} Ambil & Simpan Lokasi Ini`;
    return;
  }
  const tgl = new Date(lok.disimpanPada).toLocaleString('id-ID');
  lokasiTersimpanInfo.innerHTML = `
    <div class="lokasi-box">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px; font-weight:bold;">
        ${icons.check} Lokasi kerja tersimpan
      </div>
      <div class="info-row">${icons.pin} Lat: <b>${lok.lat}</b></div>
      <div class="info-row">${icons.pin} Lng: <b>${lok.lng}</b></div>
      <div class="info-row">${icons.ruler} Akurasi saat ambil: <b>±${lok.akurasi} m</b></div>
      <div class="info-row">${icons.clock} Disimpan: <b>${tgl}</b></div>
      <button class="btn-danger" onclick="hapusL
