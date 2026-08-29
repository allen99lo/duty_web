var SHIFT_INFO = {
    "\u4E0A\u73ED\u65E5-\u65E9": { color: "#4CAF50", css: "s", time: "08:00~17:00", label: "\u65E9\u73ED" },
    "\u4E0A\u73ED\u65E5-\u5C0F": { color: "#2196F3", css: "e", time: "17:00~00:00", label: "\u5C0F\u591C" },
    "\u4E0A\u73ED\u65E5-\u5927": { color: "#9C27B0", css: "n", time: "00:00~08:00", label: "\u5927\u591C" },
    "\u5047\u65E5-\u65E9":   { color: "#FF9800", css: "hd", time: "08:00~16:00", label: "\u5047\u65E5\u65E9" },
    "\u5047\u65E5-\u5C0F":   { color: "#F44336", css: "he", time: "16:00~00:00", label: "\u5047\u65E5\u5C0F" },
    "\u5047\u65E5-\u5927":   { color: "#795548", css: "hn", time: "00:00~08:00", label: "\u5047\u65E5\u5927" },
    "\u5F37\u5236\u88DC\u4F11":  { color: "#607D8B", css: "comp", time: "08:30~16:30", label: "\u88DC\u4F11" }
};
var POS = ["S","A","B","C","D","E"];
var scheduleData = null;

function loadSchedule() {
    if (!currentFile) return;
    document.getElementById('calendarGrid').innerHTML = '<div class="loading">\u8F09\u5165\u4E2D</div>';
    fetch('/api/schedule/' + currentFile)
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            scheduleData = data;
            renderCalendar();
        })
        .catch(function() {
            document.getElementById('calendarGrid').innerHTML = '<div class="empty-state"><h3>\u8F09\u5165\u5931\u6557</h3></div>';
        });
}

function renderCalendar() {
    if (!scheduleData) return;
    var d = scheduleData;
    var legend = document.getElementById('legend');
    var legendHtml = '';
    var keys = Object.keys(SHIFT_INFO);
    for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var info = SHIFT_INFO[name];
        legendHtml += '<div class="legend-item"><span class="legend-color" style="background:' + info.color + '"></span><span>' + name + '</span></div>';
    }
    legend.innerHTML = legendHtml;

    var grid = document.getElementById('calendarGrid');
    var html = '';
    var weekdays = ['\u4E00','\u4E8C','\u4E09','\u56DB','\u4E94','\u516D','\u65E5'];
    for (var w = 0; w < weekdays.length; w++) {
        html += '<div class="calendar-header">' + weekdays[w] + '</div>';
    }
    var firstWeekday = d.days.length > 0 ? d.days[0].weekday_num : 0;
    for (var j = 0; j < firstWeekday; j++) {
        html += '<div class="calendar-day" style="opacity:0.3"></div>';
    }
    d.days.forEach(function(day) {
        var weekendClass = day.is_weekend ? ' weekend' : '';
        var nameLines = '';
        var groupKeys = Object.keys(day.shifts);
        for (var g = 0; g < groupKeys.length; g++) {
            var groupName = groupKeys[g];
            var members = day.shifts[groupName];
            var filled = members.filter(function(m) { return m !== null; });
            if (filled.length > 0) {
                var info = SHIFT_INFO[groupName];
                var css = info ? info.css : '';
                var label = info ? info.label : groupName;
                var names = filled.map(function(m) { return m.name; }).join(' ');
                nameLines += '<div class="shift-name-line"><span class="shift-badge ' + css + '" style="font-size:9px">' + label + '</span> <span class="shift-names">' + names + '</span></div>';
            }
        }
        html += '<div class="calendar-day' + weekendClass + '" onclick="showDayDetail(' + day.day + ')"><div class="day-num">' + day.day + ' <span style="font-size:11px;color:#888">' + day.weekday + '</span></div><div class="shifts-names">' + nameLines + '</div></div>';
    });
    grid.innerHTML = html;
}

function showDayDetail(dayNum) {
    if (!scheduleData) return;
    var day = null;
    for (var i = 0; i < scheduleData.days.length; i++) {
        if (scheduleData.days[i].day === dayNum) { day = scheduleData.days[i]; break; }
    }
    if (!day) return;
    document.getElementById('modalTitle').textContent = dayNum + '\u65E5 (' + day.weekday + ') \u6392\u73ED\u8A73\u60C5';
    var html = '<table class="shift-table"><thead><tr><th>\u73ED\u5225</th><th>\u6642\u9593</th>';
    for (var p = 0; p < POS.length; p++) { html += '<th>\u4F4D\u7F6E ' + POS[p] + '</th>'; }
    html += '</tr></thead><tbody>';
    var groupKeys = Object.keys(day.shifts);
    for (var g = 0; g < groupKeys.length; g++) {
        var groupName = groupKeys[g];
        var members = day.shifts[groupName];
        var info = SHIFT_INFO[groupName] || {};
        html += '<tr>';
        html += '<td style="background:' + (info.color || '#ccc') + ';color:white;font-weight:bold">' + groupName + '</td>';
        html += '<td>' + (info.time || '') + '</td>';
        for (var m = 0; m < members.length; m++) {
            if (members[m]) {
                html += '<td class="member-cell" style="cursor:pointer" onclick="event.stopPropagation();window.location=\'/employee?code=' + members[m].code + '\'">' + members[m].code + '<br><small>' + members[m].name + '</small></td>';
            } else {
                html += '<td style="color:#ccc">-</td>';
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('dayModal').classList.add('show');
}

function closeModal() {
    document.getElementById('dayModal').classList.remove('show');
}

document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });
document.getElementById('dayModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
if (currentFile) loadSchedule();
