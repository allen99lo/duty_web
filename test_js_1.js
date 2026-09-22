
window.onerror = function(msg, url, line, col, err) {
    var el = document.getElementById('jsDebug');
    if(el){el.style.display='block';el.textContent='JS Error: '+msg+' (line '+line+')';}
    return false;
};
var _dbg = document.getElementById('jsDebug');
if(_dbg){_dbg.style.display='block';_dbg.textContent='JS loaded, currentFile='+(typeof currentFile!=='undefined'?currentFile:'UNDEF');}
const SHIFT_INFO = {
    "上班日-早": { color: "#4CAF50", css: "s", time: "08:00~17:00", label: "早班" },
    "上班日-小": { color: "#2196F3", css: "e", time: "17:00~00:00", label: "小夜" },
    "上班日-大": { color: "#9C27B0", css: "n", time: "00:00~08:00", label: "大夜" },
    "假日-早":   { color: "#FF9800", css: "hd", time: "08:00~16:00", label: "假日早" },
    "假日-小":   { color: "#F44336", css: "he", time: "16:00~00:00", label: "假日小" },
    "假日-大":   { color: "#795548", css: "hn", time: "00:00~08:00", label: "假日大" },
    "強制補休":  { color: "#607D8B", css: "comp", time: "08:30~16:30", label: "補休" },
};

let scheduleData = null;
let empData = null;

async function loadSchedule() {
    if (!currentFile) return;
    try {
        const resp = await fetch(`/api/schedule/${currentFile}`);
        scheduleData = await resp.json();
        populateEmpSelect();
        // Check URL param
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            document.getElementById('empSelect').value = code;
            selectEmployee(code);
        }
    } catch(e) {
        console.error(e);
    }
}

function populateEmpSelect() {
    if (!scheduleData) return;
    const sel = document.getElementById('empSelect');
    sel.innerHTML = '<option value="">-- 請選擇 --</option>';
    scheduleData.employees.forEach(emp => {
        sel.innerHTML += `<option value="${emp.code}">${emp.code} - ${emp.full_name}</option>`;
    });
}

async function selectEmployee(code) {
    if (!code || !currentFile) {
        document.getElementById('empDetail').style.display = 'none';
        document.getElementById('empEmpty').style.display = 'block';
        return;
    }

    try {
        const resp = await fetch(`/api/employee/${currentFile}/${code}`);
        empData = await resp.json();
        renderEmployee();
    } catch(e) {
        console.error(e);
    }
}

function renderEmployee() {
    if (!empData || !scheduleData) return;

    document.getElementById('empEmpty').style.display = 'none';
    document.getElementById('empDetail').style.display = 'block';

    // Header
    document.getElementById('detailCode').textContent = empData.code;
    document.getElementById('detailName').textContent = empData.info?.full_name || empData.code;
    document.getElementById('detailInfo').textContent =
        `月總工時: ${empData.info?.total_hours || 0}h | 延長工時: ${empData.info?.overtime_hours || 0}h`;

    // Stats
    const shiftCounts = {};
    empData.schedule.forEach(s => {
        shiftCounts[s.shift] = (shiftCounts[s.shift] || 0) + 1;
    });
    document.getElementById('detailStats').innerHTML = Object.entries(SHIFT_INFO).map(([name, info]) => {
        const count = shiftCounts[name] || 0;
        const req = empData.info?.shift_requirements?.[name] || 0;
        const status = count >= req ? '✅' : count > 0 ? '⚠️' : '';
        return `<div class="stat-box">
            <div class="stat-value" style="color:${info.color}">${count}/${req}</div>
            <div class="stat-label">${info.label} ${status}</div>
        </div>`;
    }).join('');

    // Mini calendar
    renderEmpCalendar();

    // Detail table - 按日期排序，同日多班都顯示
    const tbody = document.getElementById('detailBody');
    const sorted = empData.schedule.sort((a,b) => a.day - b.day || a.time.localeCompare(b.time));
    tbody.innerHTML = sorted.map(s => {
        const info = SHIFT_INFO[s.shift] || {};
        return `<tr>
            <td>${s.day}日</td>
            <td>${s.weekday}</td>
            <td style="background:${info.color};color:white;font-weight:bold">${s.shift}</td>
            <td>${s.time}</td>
            <td><strong>${s.position}</strong></td>
        </tr>`;
    }).join('');

    document.getElementById('empInfo').textContent =
        `${empData.code} - ${empData.info?.full_name || ''} | 共 ${empData.total_shifts} 班`;
}

function renderEmpCalendar() {
    if (!scheduleData || !empData) return;

    // 同日可能有多個班別，用 array 存
    const empShiftMap = {};
    empData.schedule.forEach(s => {
        if (!empShiftMap[s.day]) empShiftMap[s.day] = [];
        empShiftMap[s.day].push(s);
    });

    const grid = document.getElementById('empCalendar');
    let html = '';

    ['一','二','三','四','五','六','日').forEach(w => {
        html += `<div class="calendar-header">${w}</div>`;
    });

    const firstWeekday = scheduleData.days.length > 0 ? scheduleData.days[0].weekday_num : 0;
    for (let i = 0; i < firstWeekday; i++) {
        html += '<div class="calendar-day" style="opacity:0.3"></div>';
    }

    scheduleData.days.forEach(day => {
        const shifts = empShiftMap[day.day] || [];
        const hasShift = shifts.length > 0;
        const weekendClass = day.is_weekend ? ' weekend' : '';
        const highlightClass = hasShift ? ' today' : '';

        let badges = '';
        shifts.forEach(s => {
            const info = SHIFT_INFO[s.shift];
            badges += `<span class="shift-badge ${info?.css || ''}">${info?.label || s.shift}</span>`;
        });

        html += `<div class="calendar-day${weekendClass}${highlightClass}">
            <div class="day-num">${day.day} <span style="font-size:11px;color:#888">${day.weekday}</span></div>
            <div class="shifts-mini">${badges}</div>
        </div>`;
    });

    grid.innerHTML = html;
}

if (currentFile) loadSchedule();
