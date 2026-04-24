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

// ทำให้ข้อมูลไม่หายและใช้งานออฟไลน์ได้
db.ref('money_flow').keepSynced(true);

let currentType = 'expense', transactions = [], dailyChart, statsChart;

// หมวดหมู่และสีประจำหมวดหมู่
const categories = ['อาหาร', 'เดินทาง', 'ช้อปปิ้ง', 'บ้าน', 'เงินเดือน', 'True Money Wallet', 'อื่นๆ'];
const catColors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#4ade80'];

// --- 2. Core Functions ---

// ระบบ Dark Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('darkIcon');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun text-yellow-400 text-xl' : 'fa-solid fa-moon text-slate-600 text-xl';
    }
}

// เลือก รายรับ/รายจ่าย
function setType(type) {
    currentType = type;
    const isExp = type === 'expense';
    const btnExp = document.getElementById('btnExp');
    const btnInc = document.getElementById('btnInc');
    if (btnExp && btnInc) {
        btnExp.className = isExp ? 'flex-1 py-4 rounded-xl font-bold text-sm bg-white dark:bg-zinc-800 shadow-sm' : 'flex-1 py-4 rounded-xl font-bold text-sm opacity-40';
        btnInc.className = !isExp ? 'flex-1 py-4 rounded-xl font-bold text-sm bg-white dark:bg-zinc-800 shadow-sm' : 'flex-1 py-4 rounded-xl font-bold text-sm opacity-40';
    }
}

// --- 3. Database & Rendering Logic ---

// ดึงข้อมูล Real-time จาก Firebase
db.ref('money_flow').on('value', snapshot => {
    const data = snapshot.val();
    transactions = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];

    // เรียงวันที่ล่าสุดขึ้นก่อน
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    updateBalance();

    // เช็กว่าอยู่หน้าไหนให้ Render หน้านั้น
    const activePage = document.querySelector('.page.active')?.id;
    if (activePage === 'page-daily') renderDaily();
    if (activePage === 'page-stats') renderStats();
});

// อัปเดตยอดคงเหลือ
function updateBalance() {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const balanceEl = document.getElementById('mainBalance');
    if (balanceEl) {
        balanceEl.innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
}

// ฟังก์ชันบันทึกข้อมูล (ใช้ SweetAlert2)
function saveTransaction() {
    const amtInput = document.getElementById('amountInput');
    const noteInput = document.getElementById('noteInput');
    const catSelect = document.getElementById('categorySelect');
    const editId = document.getElementById('editId').value;

    const amt = parseFloat(amtInput.value);

    // SweetAlert2 แจ้งเตือนเมื่อลืมใส่จำนวนเงิน
    if (!amt) {
        return Swal.fire({
            title: 'ระบุจำนวนเงิน',
            text: 'กรุณาใส่จำนวนเงินก่อนบันทึกนะ',
            icon: 'warning',
            confirmButtonColor: '#6366f1'
        });
    }

    const data = {
        amount: currentType === 'expense' ? -Math.abs(amt) : Math.abs(amt),
        note: noteInput.value || '',
        cat: catSelect.value,
        date: editId ? (transactions.find(t => t.id === editId)?.date || new Date().toISOString()) : new Date().toISOString()
    };

    if (editId) {
        db.ref('money_flow/' + editId).update(data);
    } else {
        db.ref('money_flow').push(data);
    }

    // ล้างค่าในฟอร์ม
    amtInput.value = '';
    noteInput.value = '';
    document.getElementById('editId').value = '';

    // SweetAlert2 แจ้งเตือนสำเร็จ
    Swal.fire({
        title: 'บันทึกสำเร็จ!',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false,
        background: document.body.classList.contains('dark') ? '#111' : '#fff',
        color: document.body.classList.contains('dark') ? '#fff' : '#000'
    });
}

// หน้าประวัติ (กราฟวงกลม)
function renderDaily() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = transactions.filter(t => t.date.startsWith(today));

    const summary = {};
    categories.forEach(c => summary[c] = 0);
    todayTrans.forEach(t => { if (t.amount < 0) summary[t.cat] += Math.abs(t.amount); });

    if (dailyChart) dailyChart.destroy();
    const ctx = document.getElementById('dailyChart');
    if (ctx) {
        dailyChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{ data: Object.values(summary), backgroundColor: catColors, borderWidth: 0 }]
            },
            options: { plugins: { legend: { display: false } }, cutout: '75%' }
        });
    }

    const list = document.getElementById('dailyList');
    if (list) {
        list.innerHTML = todayTrans.length ? todayTrans.map(t => `
            <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl mb-2 active:scale-95 transition-all" onclick="editItem('${t.id}')">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-8 rounded-full" style="background:${catColors[categories.indexOf(t.cat)]}"></div>
                    <div>
                        <p class="font-bold text-sm">${t.cat}</p>
                        <p class="text-[10px] opacity-40">${t.note || '-'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-inter font-black ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</p>
                    <button onclick="event.stopPropagation(); deleteItem('${t.id}')" class="text-[9px] text-rose-500 opacity-50 font-bold uppercase">ลบ</button>
                </div>
            </div>`).join('') : '<div class="py-10 text-center opacity-20 text-xs">วันนี้ยังไม่มีรายการ</div>';
    }
}

// หน้าสถิติ (กราฟแท่ง)
function renderStats() {
    const month = document.getElementById('monthPicker').value;
    const filtered = transactions.filter(t => t.date.startsWith(month));

    const inc = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const summaryDiv = document.getElementById('statsSummary');
    if (summaryDiv) {
        summaryDiv.innerHTML = `
            <div class="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-900/10 text-center">
                <p class="text-[9px] font-bold text-emerald-600 uppercase">รายรับ</p>
                <p class="text-xl font-black text-emerald-500">${inc.toLocaleString()}</p>
            </div>
            <div class="p-4 rounded-3xl bg-rose-50 dark:bg-rose-900/10 text-center">
                <p class="text-[9px] font-bold text-rose-600 uppercase">รายจ่าย</p>
                <p class="text-xl font-black text-rose-500">${exp.toLocaleString()}</p>
            </div>`;
    }

    const catSummary = {};
    categories.forEach(c => catSummary[c] = 0);
    filtered.forEach(t => { if (t.amount < 0) catSummary[t.cat] += Math.abs(t.amount); });

    if (statsChart) statsChart.destroy();
    const ctx = document.getElementById('statsChart');
    if (ctx) {
        statsChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{ data: Object.values(catSummary), backgroundColor: catColors, borderRadius: 8 }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { display: false }, x: { grid: { display: false } } }
            }
        });
    }
}

// สลับหน้าแอป
function showPage(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    el.classList.add('nav-active');
    if (id === 'page-daily') renderDaily();
    if (id === 'page-stats') renderStats();
}

// ฟังก์ชันลบ (ใช้ SweetAlert2 ยืนยัน)
function deleteItem(id) {
    Swal.fire({
        title: 'ลบรายการนี้?',
        text: "ข้อมูลจะถูกลบออกจากระบบถาวร",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f43f5e',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก',
        background: document.body.classList.contains('dark') ? '#111' : '#fff',
        color: document.body.classList.contains('dark') ? '#fff' : '#000'
    }).then((result) => {
        if (result.isConfirmed) {
            db.ref('money_flow/' + id).remove();
            Swal.fire({
                title: 'ลบแล้ว!',
                icon: 'success',
                timer: 800,
                showConfirmButton: false
            });
        }
    });
}

// ฟังก์ชันแก้ไข
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

// เติมหมวดหมู่ใน Select
const catSelect = document.getElementById('categorySelect');
if (catSelect) {
    catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ตั้งค่าเดือนปัจจุบัน
const monthPicker = document.getElementById('monthPicker');
if (monthPicker) {
    monthPicker.value = new Date().toISOString().slice(0, 7);
}

// โหลด Theme และค่าเริ่มต้น
if (localStorage.getItem('theme') === 'dark') toggleDarkMode();
setType('expense');

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
    });
}