// --- 1. Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyA11zPbXEFs-sdIHKaxhkprkoGSGP1whfg",
    authDomain: "ims-fei.firebaseapp.com",
    databaseURL: "https://ims-fei-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ims-fei",
    storageBucket: "ims-fei.firebasestorage.app",
    messagingSenderId: "791711191329",
    appId: "1:791711191329:web:0a4ba03cd5f11eb71bae60"
};

// ตรวจสอบการ Initialize ป้องกันการประกาศซ้ำ
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

// --- ส่วนสำคัญ: ทำให้ข้อมูลไม่หายและใช้งานออฟไลน์ได้ ---
// 1. บังคับให้ดึงข้อมูลจากเครื่องก่อน (ถ้าเคยโหลดไว้แล้ว)
db.ref('money_flow').keepSynced(true);

let currentType = 'expense', transactions = [], dailyChart, statsChart;

// หมวดหมู่และสีประจำหมวดหมู่
const categories = ['อาหาร', 'เดินทาง', 'ช้อปปิ้ง', 'บ้าน', 'เงินเดือน', 'True Money Wallet', 'อื่นๆ'];
const catColors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#4ade80'];

// --- 2. Core Functions ---
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('darkIcon').className = isDark ? 'fa-solid fa-sun text-yellow-400 text-xl' : 'fa-solid fa-moon text-slate-600 text-xl';
}

function setType(type) {
    currentType = type;
    const isExp = type === 'expense';
    document.getElementById('btnExp').className = isExp ? 'flex-1 py-4 rounded-xl font-bold text-sm bg-white dark:bg-zinc-800 shadow-sm' : 'flex-1 py-4 rounded-xl font-bold text-sm opacity-40';
    document.getElementById('btnInc').className = !isExp ? 'flex-1 py-4 rounded-xl font-bold text-sm bg-white dark:bg-zinc-800 shadow-sm' : 'flex-1 py-4 rounded-xl font-bold text-sm opacity-40';
}

// --- 3. Database Listener ---
// ดึงข้อมูลแบบ Real-time และจะทำงานทันทีแม้ไม่มีเน็ต (ถ้ามีข้อมูลแคช)
db.ref('money_flow').on('value', snapshot => {
    const data = snapshot.val();
    transactions = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];

    // เรียงลำดับวันที่ล่าสุดขึ้นก่อน
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    updateBalance();
    if (document.getElementById('page-daily').classList.contains('active')) renderDaily();
    if (document.getElementById('page-stats').classList.contains('active')) renderStats();
});

function updateBalance() {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('mainBalance').innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function saveTransaction() {
    const amt = parseFloat(document.getElementById('amountInput').value);
    const note = document.getElementById('noteInput').value;
    const cat = document.getElementById('categorySelect').value;
    const id = document.getElementById('editId').value;

    if (!amt) return Swal.fire('กรุณาระบุจำนวนเงิน', '', 'warning');

    const data = {
        amount: currentType === 'expense' ? -Math.abs(amt) : Math.abs(amt),
        note,
        cat,
        date: new Date().toISOString()
    };

    if (id) {
        db.ref('money_flow/' + id).update(data);
    } else {
        db.ref('money_flow').push(data);
    }

    // Reset Form
    document.getElementById('amountInput').value = '';
    document.getElementById('noteInput').value = '';
    document.getElementById('editId').value = '';
    Swal.fire({ title: 'บันทึกแล้ว', icon: 'success', timer: 1000, showConfirmButton: false });
}

function renderDaily() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = transactions.filter(t => t.date.startsWith(today));

    // สรุปข้อมูลสำหรับกราฟวงกลม
    const summary = {};
    categories.forEach(c => summary[c] = 0);
    todayTrans.forEach(t => { if (t.amount < 0) summary[t.cat] += Math.abs(t.amount); });

    if (dailyChart) dailyChart.destroy();
    const ctx = document.getElementById('dailyChart').getContext('2d');
    dailyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{ data: Object.values(summary), backgroundColor: catColors, borderWidth: 0 }]
        },
        options: { plugins: { legend: { display: false } }, cutout: '70%' }
    });

    document.getElementById('dailyList').innerHTML = todayTrans.map(t => `
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl mb-2 active:scale-95 transition-all" onclick="editItem('${t.id}')">
            <div class="flex items-center gap-3">
                <div class="w-2 h-8 rounded-full" style="background:${catColors[categories.indexOf(t.cat)]}"></div>
                <div>
                    <p class="font-bold text-sm">${t.cat}</p>
                    <p class="text-[10px] opacity-40">${t.note || '-'}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-inter font-black ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</p>
                <button onclick="event.stopPropagation(); deleteItem('${t.id}')" class="text-[10px] text-rose-500 opacity-50">ลบ</button>
            </div>
        </div>`).join('');
}

function renderStats() {
    const month = document.getElementById('monthPicker').value; // YYYY-MM
    const filtered = transactions.filter(t => t.date.startsWith(month));

    const inc = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    document.getElementById('statsSummary').innerHTML = `
        <div class="stat-box bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
            <p class="stat-label">รายรับ</p>
            <p class="stat-value text-emerald-500">${inc.toLocaleString()}</p>
        </div>
        <div class="stat-box bg-rose-50 dark:bg-rose-900/20 text-rose-600">
            <p class="stat-label">รายจ่าย</p>
            <p class="stat-value text-rose-500">${exp.toLocaleString()}</p>
        </div>`;

    const summary = {};
    categories.forEach(c => summary[c] = 0);
    filtered.forEach(t => { if (t.amount < 0) summary[t.cat] += Math.abs(t.amount); });

    if (statsChart) statsChart.destroy();
    statsChart = new Chart(document.getElementById('statsChart'), {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{ data: Object.values(summary), backgroundColor: catColors, borderRadius: 8 }]
        },
        options: { plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false } } } }
    });
}

function showPage(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    el.classList.add('nav-active');
    if (id === 'page-daily') renderDaily();
    if (id === 'page-stats') renderStats();
}

function deleteItem(id) {
    Swal.fire({ title: 'ลบรายการนี้?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', cancelButtonText: 'ยกเลิก', confirmButtonText: 'ลบเลย' })
        .then(r => { if (r.isConfirmed) db.ref('money_flow/' + id).remove(); });
}

function editItem(id) {
    const t = transactions.find(x => x.id == id);
    if (!t) return;
    showPage('page-add', document.querySelector('nav button:first-child'));
    document.getElementById('editId').value = t.id;
    document.getElementById('amountInput').value = Math.abs(t.amount);
    document.getElementById('noteInput').value = t.note || '';
    document.getElementById('categorySelect').value = t.cat;
    setType(t.amount < 0 ? 'expense' : 'income');
}

// --- 4. Initialization ---
// ตั้งค่าเริ่มต้น
document.getElementById('categorySelect').innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
document.getElementById('monthPicker').value = new Date().toISOString().slice(0, 7);

// ดึง Theme เดิมจากเครื่อง
if (localStorage.getItem('theme') === 'dark') toggleDarkMode();

// ลงทะเบียน Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registered!');
        }).catch(err => console.log('SW error:', err));
    });
}