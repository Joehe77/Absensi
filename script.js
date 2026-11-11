/* ============================================================
   ⚙️ PENGATURAN
   ============================================================ */
const RADIUS_METER = 100;         // radius toleransi absen (meter)
const CHECK_INTERVAL = 15000;     // cek GPS tiap 15 detik
const MIN_AKURASI = 200;          // abaikan GPS jika akurasi > 200m

/* ============================================================
   STATE
   ============================================================ */
let watchId = null;
let timerId = null;

/* ============================================================
   UTIL
   ============================================================ */
function hitungJarak(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tanggalHariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sudahAbsenHariIni() {
  return localStorage.getItem('absensi_last_date') === tanggalHariIni();
}

/* ============================================================
   SIMPAN / AMBIL LOKASI KERJA
   ============================================================ */
function getLokasiKerja() {
  const raw = localStorage.getItem('lokasi_kerja');
  return raw ? JSON.parse(raw) : null;
}

function simpanLokasiKerja(lat, lng, akurasi) {
  const data = {
    lat: parseFloat(lat.toFixed(6)),
    lng: parseFloat(lng.toFixed(6)),
    akurasi: Math.round(akurasi),
    disimpanPada: Date.now()
  };
  localStorage.setItem('lokasi_kerja', JSON.stringify(data));
  return data;
}

function hapusLokasiKerja() {
  if (!confirm('Hapus lokasi kerja yang tersimpan? Setelah dihapus, kamu harus setup ulang.')) return;
  localStorage.removeItem('lokasi_kerja');
  renderSetupCard();
  renderBanner();
  setStatus('waiting', 'Lokasi kerja belum diatur');
}

/* ============================================================
   UI ELEMENTS
   ============================================================ */
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const gpsInfo = document.getElementById('gpsInfo');
const logList = document.getElementById('logList');
const absenBanner = document.getElementById('absenBanner');
const lokasiTersimpanInfo = document.getElementById('lokasiTersimpanInfo');
const btnAmbil = document.getElementById('btnAmbil');

function setStatus(cls, text) {
  dot.className = 'dot ' + cls;
  statusText.textContent = text;
}

function renderLog() {
  const logs = JSON.parse(localStorage.getItem('absensi_log') || '[]');
  if (logs.length === 0) {
    logList.innerHTML = '<div class="info">Belum ada absensi.</div>';
    return;
  }
  logList.innerHTML = logs.slice().reverse().map(l => `
    <div class="log-item">
      <span class="badge-in">✅ MASUK</span>
      <span>${new Date(l.waktu).toLocaleString('id-ID')}</span>
    </div>
  `).join('');
}

function renderBanner() {
  if (!getLokasiKerja()) {
    absenBanner.innerHTML = `
      <div class="absen-warn">
        ⚠️ <b>Lokasi kerja belum diatur.</b><br>
        Buka halaman ini di lokasi kerja, lalu tekan tombol <b>"📌 Ambil & Simpan Lokasi Ini"</b> di bawah.
      </div>`;
    return;
  }
  if (sudahAbsenHariIni()) {
    const waktu = localStorage.getItem('absensi_last_time');
    const jam = waktu ? new Date(Number(waktu)).toLocaleTimeString('id-ID') : '-';
    absenBanner.innerHTML = `
      <div class="absen-ok">
        ✅ ABSEN HARI INI SUDAH SELESAI<br>
        <span style="font-size:.85rem; font-weight:400; opacity:.8;">Pukul ${jam} • Tidak akan tercatat ganda</span>
      </div>`;
  } else {
    absenBanner.innerHTML = '';
  }
}

function renderSetupCard() {
  const lok = getLokasiKerja();
  if (!lok) {
    lokasiTersimpanInfo.innerHTML = '';
    btnAmbil.textContent = '📌 Ambil & Simpan Lokasi Ini';
    return;
  }
  const tgl = new Date(lok.disimpanPada).toLocaleString('id-ID');
  lokasiTersimpanInfo.innerHTML = `
    <div class="lokasi-tersimpan">
      ✅ <b>Lokasi kerja tersimpan</b><br>
      📍 Lat: <b>${lok.lat}</b><br>
      📍 Lng: <b>${lok.lng}</b><br>
      📏 Akurasi saat ambil: <b>±${lok.akurasi} m</b><br>
      🕐 Disimpan: <b>${tgl}</b><br><br>
      <button class="danger" style="margin-top:0;" onclick="hapusLokasiKerja()">🗑 Hapus & Setup Ulang</button>
    </div>`;
  btnAmbil.textContent = '🔄 Perbarui Lokasi Kerja';
}

/* ============================================================
   LOGIKA UTAMA — auto absen sekali sehari
   ============================================================ */
function prosesPosisi(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const lokasiKerja = getLokasiKerja();

  // Belum setup lokasi → tampilkan info posisi saja
  if (!lokasiKerja) {
    setStatus('waiting', 'Lokasi kerja belum diatur');
    gpsInfo.innerHTML = `
      📍 Posisi Anda: <b>${latitude.toFixed(6)}, ${longitude.toFixed(6)}</b><br>
      📏 Akurasi: <b>±${Math.round(accuracy)} m</b><br>
      <span style="color:#fbbf24;">Atur lokasi kerja dulu di bawah ⬇</span>
    `;
    return;
  }

  const jarak = hitungJarak(latitude, longitude, lokasiKerja.lat, lokasiKerja.lng);

  gpsInfo.innerHTML = `
    📍 Lat: <b>${latitude.toFixed(6)}</b> • Lng: <b>${longitude.toFixed(6)}</b><br>
    🎯 Jarak ke lokasi kerja: <b>${Math.round(jarak)} m</b><br>
    📏 Akurasi GPS: <b>±${Math.round(accuracy)} m</b><br>
    🏢 Radius absen: <b>${RADIUS_METER} m</b>
  `;

  const dalamRadius = jarak <= RADIUS_METER;
  const akurasiCukup = accuracy <= MIN_AKURASI;

  if (dalamRadius && akurasiCukup) {
    setStatus('inside', '✅ Di dalam area kerja');
    if (!sudahAbsenHariIni()) {
      catatAbsen(jarak);
    }
  } else if (dalamRadius && !akurasiCukup) {
    setStatus('waiting', 'Menunggu sinyal GPS lebih akurat...');
  } else {
    setStatus('outside', '❌ Di luar area kerja');
  }
}

function catatAbsen(jarak) {
  const sekarang = Date.now();
  const logs = JSON.parse(localStorage.getItem('absensi_log') || '[]');
  logs.push({ waktu: sekarang, jarak: Math.round(jarak), tanggal: tanggalHariIni() });
  localStorage.setItem('absensi_log', JSON.stringify(logs));

  // kunci anti-ganda
  localStorage.setItem('absensi_last_date', tanggalHariIni());
  localStorage.setItem('absensi_last_time', String(sekarang));

  renderLog();
  renderBanner();
  notifikasi('✅ Absensi berhasil dicatat pukul ' + new Date(sekarang).toLocaleTimeString('id-ID'));
}

function notifikasi(msg) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Absensi GPS', { body: msg });
  }
  console.log('🔔', msg);
}

/* ============================================================
   AMBIL & SIMPAN LOKASI KERJA (otomatis)
   ============================================================ */
function ambilDanSimpanLokasi() {
  if (!navigator.geolocation) {
    alert('Browser tidak mendukung GPS.');
    return;
  }

  btnAmbil.disabled = true;
  btnAmbil.textContent = '⏳ Mengambil lokasi...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const data = simpanLokasiKerja(latitude, longitude, accuracy);

      renderSetupCard();
      renderBanner();

      notifikasi('📍 Lokasi kerja tersimpan: ' + data.lat + ', ' + data.lng);
      alert(
        '✅ Lokasi kerja berhasil disimpan!\n\n' +
        'Latitude: ' + data.lat + '\n' +
        'Longitude: ' + data.lng + '\n' +
        'Akurasi: ±' + data.akurasi + ' m\n\n' +
        'Absen otomatis sekarang aktif.'
      );

      navigator.geolocation.getCurrentPosition(prosesPosisi, () => {}, {
        enableHighAccuracy: true, maximumAge: 0, timeout: 15000
      });
    },
    (err) => {
      btnAmbil.disabled = false;
      renderSetupCard();
      alert('❌ Gagal ambil lokasi: ' + err.message + '\n\nPastikan:\n• GPS aktif\n• Izin lokasi diberikan\n• Halaman diakses via HTTPS');
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

/* ============================================================
   START TRACKING
   ============================================================ */
function startTracking() {
  if (!navigator.geolocation) {
    setStatus('outside', 'GPS tidak didukung browser');
    return;
  }
  setStatus('waiting', 'Mendeteksi lokasi...');

  watchId = navigator.geolocation.watchPosition(
    prosesPosisi,
    (err) => {
      setStatus('outside', 'Gagal GPS: ' + err.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );

  timerId = setInterval(() => {
    navigator.geolocation.getCurrentPosition(prosesPosisi, () => {}, {
      enableHighAccuracy: true, maximumAge: 5000, timeout: 15000
    });
  }, CHECK_INTERVAL);
}

/* ============================================================
   RESET ABSEN HARI INI
   ============================================================ */
function resetAbsenHariIni() {
  if (!confirm('Reset absen hari ini? (riwayat tidak dihapus, hanya bisa absen lagi hari ini)')) return;
  localStorage.removeItem('absensi_last_date');
  localStorage.removeItem('absensi_last_time');
  renderBanner();
  notifikasi('Absen hari ini di-reset. Absen otomatis aktif kembali.');
}

/* ============================================================
   INIT
   ============================================================ */
renderLog();
renderBanner();
renderSetupCard();
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
startTracking();
