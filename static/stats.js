var SHIFT_INFO = {
    "\u4E0A\u73ED\u65E5-\u65E9": { color: "#4CAF50", label: "\u65E9\u73ED" },
    "\u4E0A\u73ED\u65E5-\u5C0F": { color: "#2196F3", label: "\u5C0F\u591C" },
    "\u4E0A\u73ED\u65E5-\u5927": { color: "#9C27B0", label: "\u5927\u591C" },
    "\u5047\u65E5-\u65E9":   { color: "#FF9800", label: "\u5047\u65E5\u65E9" },
    "\u5047\u65E5-\u5C0F":   { color: "#F44336", label: "\u5047\u65E5\u5C0F" },
    "\u5047\u65E5-\u5927":   { color: "#795548", label: "\u5047\u65E5\u5927" },
    "\u5F37\u5236\u88DC\u4F11":  { color: "#607D8B", label: "\u88DC\u4F11" }
};

var scheduleData = null;
var statsData = null;

function loadSchedule() {
    if (!currentFile) return;
    Promise.all([
        fetch('/api/schedule/' + currentFile),
        fetch('/api/stats/' + currentFile)
    ]).then(function(resps) {
        return Promise.all(resps.map(function(r) { return r.json(); }));
    }).then(function(results) {
        scheduleData = results[0];
        statsData = results[1];
        renderStats();
    }).catch(function(e) { console.error(e); });
}

function renderStats() {
    if (!scheduleData || !statsData) return;
    var emps = scheduleData.employees;
    var avgH = emps.length ? Math.round(emps.reduce(function(s, e) { return s + e.total_hours; }, 0) / emps.length) : 0;
    var maxH = emps.length ? Math.max.apply(null, emps.map(function(e) { return e.total_hours; })) : 0;
    document.getElementById('sTotalDays').textContent = statsData.total_days;
    document.getElementById('sTotalEmp').textContent = statsData.total_employees;
    document.getElementById('sAvgHours').textContent = avgH + 'h';
    document.getElementById('sMaxHours').textContent = maxH + 'h';
    renderDailyChart();
    renderHoursRanking();
    renderShiftComparison();
}

function renderDailyChart() {
    var ds = statsData.daily_stats;
    var shiftNames = Object.keys(SHIFT_INFO);
    var maxVal = 0;
    ds.forEach(function(d) {
        var vals = Object.values(d.shifts);
        vals.forEach(function(v) { if (v > maxVal) maxVal = v; });
    });
    var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
    shiftNames.forEach(function(name) {
        var info = SHIFT_INFO[name];
        html += '<div class="legend-item"><span class="legend-color" style="background:' + info.color + '"></span><span>' + info.label + '</span></div>';
    });
    html += '</div>';
    html += '<div style="display:flex;align-items:flex-end;gap:2px;height:220px;padding:0 4px;overflow-x:auto">';
    ds.forEach(function(d) {
        var bars = '';
        shiftNames.forEach(function(name) {
            var count = d.shifts[name] || 0;
            var h = maxVal > 0 ? (count / maxVal * 180) : 0;
            var info = SHIFT_INFO[name];
            bars += '<div style="width:8px;height:' + h + 'px;background:' + info.color + ';border-radius:2px 2px 0 0" title="' + info.label + ': ' + count + '\u4EBA"></div>';
        });
        var weekendStyle = (d.weekday === '\u516D' || d.weekday === '\u65E5') ? 'color:#F44336;font-weight:bold' : '';
        html += '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:28px"><div style="display:flex;align-items:flex-end;gap:1px;height:180px">' + bars + '</div><div style="font-size:10px;' + weekendStyle + '">' + d.day + '</div><div style="font-size:9px;color:#999">' + d.weekday + '</div></div>';
    });
    html += '</div>';
    document.getElementById('dailyChart').innerHTML = html;
}

function renderHoursRanking() {
    var emps = scheduleData.employees.slice().sort(function(a, b) { return b.total_hours - a.total_hours; });
    var maxH = emps.length ? emps[0].total_hours : 1;
    var html = '<table class="shift-table"><thead><tr><th>#</th><th>\u4EE3\u78BC</th><th>\u59D3\u540D</th><th>\u6708\u7E3D\u5DE5\u6642</th><th>\u5EF6\u9577\u5DE5\u6642</th><th>\u5206\u5E03</th></tr></thead><tbody>';
    emps.forEach(function(emp, i) {
        var pct = maxH > 0 ? (emp.total_hours / maxH * 100) : 0;
        html += '<tr><td>' + (i + 1) + '</td><td><strong>' + emp.code + '</strong></td><td>' + emp.full_name + '</td><td><strong>' + emp.total_hours + 'h</strong></td><td>' + emp.overtime_hours + 'h</td><td style="text-align:left;padding:4px"><div style="background:#E0E0E0;border-radius:4px;height:16px;width:100%"><div style="background:var(--primary);border-radius:4px;height:100%;width:' + pct + '%"></div></div></td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('hoursRanking').innerHTML = html;
}

function renderShiftComparison() {
    var emps = scheduleData.employees;
    var shiftNames = Object.keys(SHIFT_INFO);
    var html = '<table class="shift-table"><thead><tr><th>\u73ED\u5225</th><th>\u9700\u6C42\u4EBA\u6578/\u6708</th><th>\u5BE6\u969B\u6392\u73ED</th><th>\u9054\u6210\u7387</th></tr></thead><tbody>';
    shiftNames.forEach(function(name) {
        var reqTotal = emps.reduce(function(s, e) { return s + (e.shift_requirements[name] || 0); }, 0);
        var actualTotal = 0;
        scheduleData.days.forEach(function(day) {
            var members = day.shifts[name] || [];
            actualTotal += members.filter(function(m) { return m !== null; }).length;
        });
        var rate = reqTotal > 0 ? Math.round(actualTotal / reqTotal * 100) : 0;
        var rateColor = rate >= 100 ? '#4CAF50' : rate >= 80 ? '#FF9800' : '#F44336';
        var info = SHIFT_INFO[name];
        html += '<tr><td style="background:' + info.color + ';color:white;font-weight:bold">' + info.label + '</td><td>' + reqTotal + '</td><td>' + actualTotal + '</td><td style="color:' + rateColor + ';font-weight:bold">' + rate + '%</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('shiftComparison').innerHTML = html;
}

if (currentFile) loadSchedule();
