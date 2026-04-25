// --- 1. Settings & Firebase ---
let currentType = 'expense';
let transactions = [];
let statsChartInstance = null;
const categories = ['อาหาร', 'เดินทาง', 'ช้อปปิ้ง', 'บ้าน', 'เงินเดือน', 'True Money Wallet', 'อื่นๆ'];
const catColors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#4ade80'];

const firebaseConfig = {
    apiKey: "AIzaSyA11zPbXEFs-sdIHKaxhkprkoGSGP1whfg",
    authDomain: "ims-fei.firebaseapp.com",
    databaseURL: "https://ims-fei-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ims-fei",
    storageBucket: "ims-fei.firebasestorage.app",
    messagingSenderId: "791711191329",
    appId: "1:791711191329:web:0a4ba03cd5f11eb71bae60"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// เปิดระบบดึงข้อมูลมาเก็บไว้ในเครื่องเบื้องหลัง
db.ref('money_flow').keepSynced(true);

// --- 2. Core Logic ---

// ฟังข้อมูล Real-time
db.ref('money_flow').on('value', snap => {
    const data = snap.val();
    transactions = data ? Object.keys(data).map(id => ({ id, ...data[id] })) : [];
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    updateUI();
});

function saveTransaction() {
    const amt = document.getElementById('amountInput');
    const note = document.getElementById('noteInput');
    const cat = document.getElementById('categorySelect');
    const editId = document.getElementById('editId').value;

    if (!amt.value || parseFloat(amt.value) <= 0) {
        return Swal.fire({ title: 'กรุณากรอกจำนวนเงิน', icon: 'warning' });
    }

    const data = {
        amount: currentType === 'expense' ? -Math.abs(parseFloat(amt.value)) : Math.abs(parseFloat(amt.value)),
        note: note.value.trim() || 'ไม่มีบันทึก',
        cat: cat.value,
        date: editId ? (transactions.find(t => t.id === editId)?.date || new Date().toISOString()) : new Date().toISOString()
    };

    try {
        // บันทึกลง Local Database ทันที (Firebase จะส่งขึ้น Cloud เมื่อมีเน็ต)
        if (editId) {
            db.ref('money_flow/' + editId).update(data);
        } else {
            db.ref('money_flow').push(data);
        }

        Swal.fire({ 
            title: navigator.onLine ? 'บันทึกสำเร็จ' : 'บันทึกไว้ในเครื่องแล้ว', 
            icon: 'success', 
            timer: 1000, 
            showConfirmButton: false 
        });

        amt.value = ''; 
        note.value = ''; 
        document.getElementById('editId').value = '';
        
    } catch (e) {
        console.error(e);
    }
}

function updateUI() {
    // คำนวณยอดเงินจากตัวแปร transactions ที่มีข้อมูลล่าสุดในเครื่อง
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    const balanceDisplay = document.getElementById('mainBalance');
    if (balanceDisplay) {
        balanceDisplay.innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }

    // วาดหน้าจอตามหน้าที่เปิดอยู่
    const activePage = document.querySelector('.page.active')?.id;
    if (activePage === 'page-add') renderCategories(); // วาด Categories ทุกครั้งที่อยู่หน้านี้
    if (activePage === 'page-daily') renderDaily();
    if (activePage === 'page-stats') renderStats();
}

// ฟังก์ชันวาดหมวดหมู่ (เพื่อแก้ปัญหา Categories หายตอน Offline)
function renderCategories() {
    const catSel = document.getElementById('categorySelect');
    if (catSel && catSel.innerHTML === "") { // วาดเฉพาะถ้ายังไม่มีข้อมูล
        catSel.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

function renderDaily() {
    const list = document.getElementById('dailyList');
    if (!list) return;
    if (transactions.length === 0) {
        list.innerHTML = '<div class="text-center py-20 opacity-20 font-bold text-sm">ไม่มีประวัติรายการ</div>';
        return;
    }
    list.innerHTML = transactions.map(t => `
        <div class="flex justify-between items-center p-5 bg-white dark:bg-zinc-900 rounded-3xl mb-3 shadow-sm border border-slate-50 dark:border-zinc-800 active:scale-95 transition-all" onclick="editItem('${t.id}')">
            <div class="flex items-center gap-4">
                <div class="w-2 h-8 rounded-full" style="background:${catColors[categories.indexOf(t.cat)] || '#ccc'}"></div>
                <div>
                    <p class="font-bold text-sm text-slate-800 dark:text-white">${t.cat}</p>
                    <p class="text-[10px] opacity-40 font-medium">${new Date(t.date).toLocaleDateString('th-TH')} • ${t.note}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-black ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</p>
                <button onclick="event.stopPropagation(); deleteItem('${t.id}')" class="text-[9px] text-rose-500 opacity-30 font-black uppercase tracking-tighter hover:opacity-100">Delete</button>
            </div>
        </div>`).join('');
}

function renderStats() {
    const monthPicker = document.getElementById('monthPicker');
    if (!monthPicker) return;
    const month = monthPicker.value;
    const filtered = transactions.filter(t => t.date.startsWith(month));
    const inc = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const summary = document.getElementById('statsSummary');
    if (summary) {
        summary.innerHTML = `
            <div class="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-900/10 text-center border border-emerald-100 dark:border-zinc-800/50">
                <p class="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">รายรับ</p>
                <p class="text-xl font-black text-emerald-500">${inc.toLocaleString()}</p>
            </div>
            <div class="p-5 rounded-3xl bg-rose-50 dark:bg-rose-900/10 text-center border border-rose-100 dark:border-zinc-800/50">
                <p class="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">รายจ่าย</p>
                <p class="text-xl font-black text-rose-500">${exp.toLocaleString()}</p>
            </div>`;
    }

    const ctx = document.getElementById('statsChart');
    if (ctx) {
        if (statsChartInstance) statsChartInstance.destroy();
        const isDark = document.documentElement.classList.contains('dark');
        const dataByCat = categories.map(cat => filtered.filter(t => t.cat === cat && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0));

        statsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: categories, datasets: [{ data: dataByCat, backgroundColor: catColors, borderWidth: 0 }] },
            options: {
                plugins: { legend: { display: true, position: 'bottom', labels: { color: isDark ? '#fff' : '#666', font: { size: 10, family: 'Anuphan' }, boxWidth: 10 } } },
                cutout: '78%', responsive: true, maintainAspectRatio: false
            }
        });
    }

    const statsList = document.getElementById('statsList');
    if (statsList) {
        statsList.innerHTML = filtered.length === 0 ? '<p class="text-center py-10 opacity-30 text-xs font-bold uppercase">No data</p>' :
            filtered.map(t => `
            <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800 mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-1 h-6 rounded-full" style="background:${catColors[categories.indexOf(t.cat)] || '#ccc'}"></div>
                    <div class="leading-tight">
                        <p class="font-bold text-xs text-slate-800 dark:text-white">${t.cat}</p>
                        <p class="text-[9px] opacity-40">${new Date(t.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</p>
                    </div>
                </div>
                <p class="font-black text-xs ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</p>
            </div>`).join('');
    }
}

function showPage(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.add('opacity-50'));
    el.classList.remove('opacity-50');
    updateUI();
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.className = isDark ? 'fa-solid fa-sun text-yellow-400 text-xl' : 'fa-solid fa-moon text-slate-600 text-xl';
    updateUI();
}

function setType(type) {
    currentType = type;
    const btnExp = document.getElementById('btnExp'), btnInc = document.getElementById('btnInc');
    if (type === 'expense') {
        btnExp.className = 'flex-1 py-4 rounded-xl font-bold bg-white dark:bg-zinc-800 shadow-sm transition-all dark:text-white';
        btnInc.className = 'flex-1 py-4 rounded-xl font-bold opacity-40 transition-all text-slate-400';
    } else {
        btnInc.className = 'flex-1 py-4 rounded-xl font-bold bg-white dark:bg-zinc-800 shadow-sm transition-all dark:text-white';
        btnExp.className = 'flex-1 py-4 rounded-xl font-bold opacity-40 transition-all text-slate-400';
    }
}

function editItem(id) {
    const t = transactions.find(x => x.id == id);
    if (!t) return;
    showPage('page-add', document.querySelector('nav button:first-child'));
    document.getElementById('editId').value = t.id;
    document.getElementById('amountInput').value = Math.abs(t.amount);
    document.getElementById('noteInput').value = t.note === 'ไม่มีบันทึก' ? '' : t.note;
    document.getElementById('categorySelect').value = t.cat;
    setType(t.amount < 0 ? 'expense' : 'income');
}

function deleteItem(id) {
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "ไม่สามารถกู้คืนข้อมูลได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบรายการนี้',
        cancelButtonText: 'ยกเลิก'
    }).then(res => {
        if (res.isConfirmed) db.ref('money_flow/' + id).remove();
    });
}

window.onload = () => {
    renderCategories(); // วาดหมวดหมู่ทันทีเมื่อโหลด
    const monPick = document.getElementById('monthPicker');
    if (monPick) monPick.value = new Date().toISOString().slice(0, 7);
    
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        const icon = document.getElementById('darkIcon');
        if (icon) icon.className = 'fa-solid fa-sun text-yellow-400 text-xl';
    }
    setType('expense');
    updateUI();
};