var SHIFT_INFO = {
    "\u4E0A\u73ED\u65E5-\u65E9": { color: "#4CAF50", css: "s", time: "08:00~17:00", label: "\u65E9\u73ED" },
    "\u4E0A\u73ED\u65E5-\u5C0F": { color: "#2196F3", css: "e", time: "17:00~00:00", label: "\u5C0F\u591C" },
    "\u4E0A\u73ED\u65E5-\u5927": { color: "#9C27B0", css: "n", time: "00:00~08:00", label: "\u5927\u591C" },
    "\u5047\u65E5-\u65E9":   { color: "#FF9800", css: "hd", time: "08:00~16:00", label: "\u5047\u65E5\u65E9" },
    "\u5047\u65E5-\u5C0F":   { color: "#F44336", css: "he", time: "16:00~00:00", label: "\u5047\u65E5\u5C0F" },
    "\u5047\u65E5-\u5927":   { color: "#795548", css: "hn", time: "00:00~08:00", label: "\u5047\u65E5\u5927" },
    "\u5F37\u5236\u88DC\u4F11":  { color: "#607D8B", css: "comp", time: "08:30~16:30", label: "\u88DC\u4F11" }
};

var scheduleData = null;
var empData = null;

function loadSchedule() {
    if (!currentFile) return;
    fetch('/api/schedule/' + currentFile)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            scheduleData = data;
            populateEmpSelect();
            var params = new URLSearchParams(window.location.search);
            var code = params.get('code');
            if (code) {
                document.getElementById('empSelect').value = code;
                selectEmployee(code);
            }
        })
        .catch(function(e) { console.error(e); });
}

function populateEmpSelect() {
    if (!scheduleData) return;
    var sel = document.getElementById('empSelect');
    sel.innerHTML = '<option value="">-- \u8ACB\u9078\u64C7 --</option>';
    scheduleData.employees.forEach(function(emp) {
        sel.innerHTML += '<option value="' + emp.code + '">' + emp.code + ' - ' + emp.full_name + '</option>';
    });
}

function selectEmployee(code) {
    if (!code || !currentFile) {
        document.getElementById('empDetail').style.display = 'none';
        document.getElementById('empEmpty').style.display = 'block';
        return;
    }
    fetch('/api/employee/' + currentFile + '/' + code)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            empData = data;
            renderEmployee();
        })
        .catch(function(e) { console.error(e); });
}

function renderEmployee() {
    if (!empData || !scheduleData) return;
    document.getElementById('empEmpty').style.display = 'none';
    document.getElementById('empDetail').style.display = 'block';
    document.getElementById('detailCode').textContent = empData.code;
    document.getElementById('detailName').textContent = empData.info ? empData.info.full_name : empData.code;
    document.getElementById('detailInfo').textContent = '\u6708\u7E3D\u5DE5\u6642: ' + (empData.info ? empData.info.total_hours : 0) + 'h | \u5EF6\u9577\u5DE5\u6642: ' + (empData.info ? empData.info.overtime_hours : 0) + 'h';

    var shiftCounts = {};
    empData.schedule.forEach(function(s) {
        shiftCounts[s.shift] = (shiftCounts[s.shift] || 0) + 1;
    });
    var statsHtml = '';
    var keys = Object.keys(SHIFT_INFO);
    for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var info = SHIFT_INFO[name];
        var count = shiftCounts[name] || 0;
        var req = (empData.info && empData.info.shift_requirements) ? (empData.info.shift_requirements[name] || 0) : 0;
        var status = count >= req ? '\u2705' : count > 0 ? '\u26A0\uFE0F' : '';
        statsHtml += '<div class="stat-box"><div class="stat-value" style="color:' + info.color + '">' + count + '/' + req + '</div><div class="stat-label">' + info.label + ' ' + status + '</div></div>';
    }
    document.getElementById('detailStats').innerHTML = statsHtml;

    renderEmpCalendar();

    var tbody = document.getElementById('detailBody');
    var sorted = empData.schedule.slice().sort(function(a, b) { return a.day - b.day || a.time.localeCompare(b.time); });
    var rows = '';
    for (var j = 0; j < sorted.length; j++) {
        var s = sorted[j];
        var si = SHIFT_INFO[s.shift] || {};
        rows += '<tr><td>' + s.day + '\u65E5</td><td>' + s.weekday + '</td><td style="background:' + (si.color || '') + ';color:white;font-weight:bold">' + s.shift + '</td><td>' + s.time + '</td><td><strong>' + s.position + '</strong></td></tr>';
    }
    tbody.innerHTML = rows;

    document.getElementById('empInfo').textContent = empData.code + ' - ' + (empData.info ? empData.info.full_name : '') + ' | \u5171 ' + empData.total_shifts + ' \u73ED';
}

function renderEmpCalendar() {
    if (!scheduleData || !empData) return;
    var empShiftMap = {};
    empData.schedule.forEach(function(s) {
        if (!empShiftMap[s.day]) empShiftMap[s.day] = [];
        empShiftMap[s.day].push(s);
    });
    var grid = document.getElementById('empCalendar');
    var html = '';
    var weekdays = ['\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D', '\u65E5'];
    for (var w = 0; w < weekdays.length; w++) {
        html += '<div class="calendar-header">' + weekdays[w] + '</div>';
    }
    var firstWeekday = scheduleData.days.length > 0 ? scheduleData.days[0].weekday_num : 0;
    for (var i = 0; i < firstWeekday; i++) {
        html += '<div class="calendar-day" style="opacity:0.3"></div>';
    }
    scheduleData.days.forEach(function(day) {
        var shifts = empShiftMap[day.day] || [];
        var hasShift = shifts.length > 0;
        var weekendClass = day.is_weekend ? ' weekend' : '';
        var highlightClass = hasShift ? ' today' : '';
        var badges = '';
        shifts.forEach(function(s) {
            var info = SHIFT_INFO[s.shift];
            badges += '<span class="shift-badge ' + (info ? info.css : '') + '">' + (info ? info.label : s.shift) + '</span>';
        });
        html += '<div class="calendar-day' + weekendClass + highlightClass + '"><div class="day-num">' + day.day + ' <span style="font-size:11px;color:#888">' + day.weekday + '</span></div><div class="shifts-mini">' + badges + '</div></div>';
    });
    grid.innerHTML = html;
}

if (currentFile) loadSchedule();
