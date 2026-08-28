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

function loadSchedule() {
    if (!currentFile) return;
    document.getElementById('empGrid').innerHTML = '<div class="loading">\u8F09\u5165\u4E2D</div>';
    fetch('/api/schedule/' + currentFile)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            scheduleData = data;
            renderHome();
        })
        .catch(function(e) {
            document.getElementById('empGrid').innerHTML = '<div class="empty-state"><h3>\u8F09\u5165\u5931\u6557</h3><p>' + e.message + '</p></div>';
        });
}

function renderHome() {
    if (!scheduleData) return;
    var d = scheduleData;
    document.getElementById('totalDays').textContent = d.days.length;
    document.getElementById('totalEmp').textContent = d.employees.length;
    var totalShifts = 0;
    d.days.forEach(function(day) {
        Object.values(day.shifts).forEach(function(members) {
            totalShifts += members.filter(function(m) { return m !== null; }).length;
        });
    });
    document.getElementById('totalShifts').textContent = totalShifts;
    document.getElementById('monthLabel').textContent = d.year_month || '-';

    var legend = document.getElementById('legend');
    var legendHtml = '';
    var keys = Object.keys(SHIFT_INFO);
    for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var info = SHIFT_INFO[name];
        legendHtml += '<div class="legend-item"><span class="legend-color" style="background:' + info.color + '"></span><span>' + name + ' (' + info.time + ')</span></div>';
    }
    legend.innerHTML = legendHtml;

    var grid = document.getElementById('empGrid');
    var empHtml = '';
    for (var j = 0; j < d.employees.length; j++) {
        var emp = d.employees[j];
        var shiftEntries = Object.entries(emp.shift_requirements).filter(function(kv) { return kv[1] > 0; });
        var badges = '';
        for (var k = 0; k < shiftEntries.length; k++) {
            var kn = shiftEntries[k][0];
            var kv = shiftEntries[k][1];
            var si = SHIFT_INFO[kn] || {};
            badges += '<span class="shift-badge ' + (si.css || '') + '" title="' + kn + ': ' + kv + '\u73ED">' + (si.label || kn) + ' ' + kv + '</span>';
        }
        empHtml += '<div class="emp-card" onclick="window.location=\'/employee?code=' + emp.code + '\'"><div class="emp-code">' + emp.code + '</div><div class="emp-name">' + emp.full_name + '</div><div class="emp-hours">\u6708\u7E3D\u5DE5\u6642: ' + emp.total_hours + 'h | \u5EF6\u9577: ' + emp.overtime_hours + 'h</div><div class="emp-shifts">' + badges + '</div></div>';
    }
    grid.innerHTML = empHtml;
}

if (currentFile) loadSchedule();
