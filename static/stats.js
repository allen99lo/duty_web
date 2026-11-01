// Statistics report - support merged stats from multiple schedule files
var SHIFT_INFO = {
    "\u4E0A\u73ED\u65E5-\u65E9": { color: "#4CAF50", label: "\u65E9\u73ED" },
    "\u4E0A\u73ED\u65E5-\u5C0F": { color: "#2196F3", label: "\u5C0F\u591C" },
    "\u4E0A\u73ED\u65E5-\u5927": { color: "#9C27B0", label: "\u5927\u591C" },
    "\u5047\u65E5-\u65E9":   { color: "#FF9800", label: "\u5047\u65E5\u65E9" },
    "\u5047\u65E5-\u5C0F":   { color: "#F44336", label: "\u5047\u65E5\u5C0F" },
    "\u5047\u65E5-\u5927":   { color: "#795548", label: "\u5047\u65E5\u5927" },
    "\u5F37\u5236\u88DC\u4F11":  { color: "#607D8B", label: "\u88DC\u4F11" }
};

var statsMulti = null;       // /api/stats_multi response data
var activeChartFile = null;  // which file is shown in the daily distribution chart

function getAllFiles() {
    var boxes = document.querySelectorAll('.file-check');
    var files = [];
    for (var i = 0; i < boxes.length; i++) files.push(boxes[i].value);
    return files;
}

function getSelectedFiles() {
    var boxes = document.querySelectorAll('.file-check');
    var files = [];
    for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) files.push(boxes[i].value);
    }
    return files;
}

function setSelectedFiles(files) {
    var boxes = document.querySelectorAll('.file-check');
    for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = files.indexOf(boxes[i].value) >= 0;
    }
}

// short label for a file: prefer parsed year-month, fallback to filename
function fileLabel(f) {
    if (f.year_month) return f.year_month;
    return f.filename.replace(/\.csv$/i, '');
}

// called by base.js when navbar file selector changes -> sync to single file
function onFileChange(val) {
    currentFile = val;
    if (val) setSelectedFiles([val]);
    loadMultiStats();
}

function loadMultiStats() {
    var files = getSelectedFiles();
    var hint = document.getElementById('fileHint');
    if (!files.length) {
        statsMulti = null;
        if (hint) hint.textContent = '\u5C1A\u672A\u52FE\u9078\u4EFB\u4F55\u73ED\u8868\u6A94\u6848';
        renderEmpty();
        return;
    }
    if (hint) hint.textContent = '\u8F09\u5165\u4E2D\u2026';
    fetch('/api/stats_multi?files=' + encodeURIComponent(files.join(',')))
        .then(function(resp) {
            return resp.json().catch(function() {
                throw new Error('\u4F3A\u670D\u5668\u56DE\u61C9\u932F\u8AA4 (HTTP ' + resp.status + ')');
            });
        })
        .then(function(data) {
            if (data.error) throw new Error(data.error);
            statsMulti = data;
            var msg = '\u5DF2\u8F09\u5165 ' + data.merged.file_count + ' \u500B\u73ED\u8868\u6A94\u6848\uFF08\u5408\u4F75\u7D71\u8A08\uFF09';
            if (data.errors && data.errors.length) {
                msg += '\uFF1B\u90E8\u5206\u5931\u6557\uFF1A' + data.errors.join('\uFF1B');
            }
            if (hint) hint.textContent = msg;
            if (!activeChartFile || !data.files.some(function(f) { return f.filename === activeChartFile; })) {
                activeChartFile = data.files.length ? data.files[0].filename : null;
            }
            renderStats();
        })
        .catch(function(e) {
            statsMulti = null;
            if (hint) hint.textContent = '\u8F09\u5165\u5931\u6557\uFF1A' + e.message;
            renderEmpty();
        });
}

function renderEmpty() {
    ['sFileCount', 'sTotalDays', 'sTotalEmp', 'sAvgHours', 'sMaxHours', 'sOvertime'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    var msg = '<div class="empty-state"><h3>\u8ACB\u52FE\u9078\u81F3\u5C11\u4E00\u500B\u73ED\u8868\u6A94\u6848</h3><p>\u52FE\u9078\u5F8C\u6309\u300C\u5957\u7528\u7D71\u8A08\u300D\u4EE5\u7522\u751F\u5408\u4F75\u5831\u8868</p></div>';
    ['monthlySummary', 'dailyChart', 'hoursRanking', 'shiftComparison', 'monthlyShifts'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = msg;
    });
    var tabs = document.getElementById('chartTabs');
    if (tabs) tabs.innerHTML = '';
}

function renderStats() {
    if (!statsMulti) return;
    var m = statsMulti.merged;
    document.getElementById('sFileCount').textContent = m.file_count;
    document.getElementById('sTotalDays').textContent = m.total_days;
    document.getElementById('sTotalEmp').textContent = m.employee_count;
    document.getElementById('sAvgHours').textContent = m.avg_hours + 'h';
    document.getElementById('sMaxHours').textContent = m.max_hours + 'h';
    document.getElementById('sOvertime').textContent = m.overtime_hours + 'h';
    renderMonthlySummary();
    renderChartTabs();
    renderDailyChart();
    renderHoursRanking();
    renderShiftComparison();
    renderMonthlyShifts();
}

function renderMonthlySummary() {
    var files = statsMulti.files;
    var html = '<table class="shift-table"><thead><tr><th>#</th><th>\u6708\u4EFD</th><th>\u6A94\u6848</th><th>\u5929\u6578</th><th>\u54E1\u5DE5\u6578</th><th>\u7E3D\u5DE5\u6642</th><th>\u5E73\u5747\u5DE5\u6642</th><th>\u6700\u9AD8\u5DE5\u6642</th><th>\u5EF6\u9577\u5DE5\u6642</th></tr></thead><tbody>';
    files.forEach(function(f, i) {
        html += '<tr><td>' + (i + 1) + '</td><td><strong>' + (f.year_month || '-') + '</strong></td>' +
            '<td style="text-align:left">' + f.filename + '</td>' +
            '<td>' + f.total_days + '</td><td>' + f.employee_count + '</td>' +
            '<td>' + f.total_hours + 'h</td><td>' + f.avg_hours + 'h</td>' +
            '<td>' + f.max_hours + 'h</td><td>' + f.overtime_hours + 'h</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('monthlySummary').innerHTML = html;
}

function renderChartTabs() {
    var files = statsMulti.files;
    var tabsEl = document.getElementById('chartTabs');
    if (files.length <= 1) { tabsEl.innerHTML = ''; return; }
    var html = '';
    files.forEach(function(f) {
        var cls = f.filename === activeChartFile ? 'chart-tab active' : 'chart-tab';
        html += '<button type="button" class="' + cls + '" data-file="' + f.filename + '">' + fileLabel(f) + '</button>';
    });
    tabsEl.innerHTML = html;
    var tabs = tabsEl.querySelectorAll('.chart-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() {
            activeChartFile = this.getAttribute('data-file');
            renderChartTabs();
            renderDailyChart();
        });
    }
}

function renderDailyChart() {
    var files = statsMulti.files;
    var f = null;
    files.forEach(function(x) { if (x.filename === activeChartFile) f = x; });
    if (!f && files.length) f = files[0];
    var chartEl = document.getElementById('dailyChart');
    if (!f) { chartEl.innerHTML = ''; return; }

    var ds = f.daily_stats;
    var shiftNames = Object.keys(SHIFT_INFO);
    var maxVal = 0;
    ds.forEach(function(d) {
        Object.values(d.shifts).forEach(function(v) { if (v > maxVal) maxVal = v; });
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
    chartEl.innerHTML = html;
}

function renderHoursRanking() {
    var m = statsMulti.merged;
    var files = statsMulti.files;
    var emps = m.employee_ranking;
    var el = document.getElementById('hoursRanking');
    if (!emps.length) { el.innerHTML = '<div class="empty-state"><h3>\u7121\u54E1\u5DE5\u8CC7\u6599</h3></div>'; return; }

    var maxH = emps[0].total_hours || 1;
    var head = '<tr><th>#</th><th>\u4EE3\u78BC</th><th>\u59D3\u540D</th><th>\u5408\u8A08\u5DE5\u6642</th><th>\u5EF6\u9577\u5DE5\u6642</th><th>\u51FA\u52E4\u73ED\u6B21</th>';
    files.forEach(function(f) { head += '<th>' + fileLabel(f) + '</th>'; });
    head += '<th>\u5206\u5E03</th></tr>';

    var html = '<table class="shift-table"><thead>' + head + '</thead><tbody>';
    emps.forEach(function(emp, i) {
        var pct = maxH > 0 ? (emp.total_hours / maxH * 100) : 0;
        var byFile = {};
        emp.months.forEach(function(x) { byFile[x.filename] = x.total_hours; });
        html += '<tr><td>' + (i + 1) + '</td><td><strong>' + emp.code + '</strong></td><td>' + emp.name + '</td>' +
            '<td><strong>' + emp.total_hours + 'h</strong></td><td>' + emp.overtime_hours + 'h</td>' +
            '<td>' + emp.actual_shifts + '</td>';
        files.forEach(function(f) {
            var v = byFile[f.filename];
            html += '<td>' + (v === undefined ? '-' : v + 'h') + '</td>';
        });
        html += '<td style="text-align:left;padding:4px"><div style="background:#E0E0E0;border-radius:4px;height:16px;width:100%"><div style="background:var(--primary);border-radius:4px;height:100%;width:' + pct + '%"></div></div></td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
}

function renderShiftComparison() {
    var rows = statsMulti.merged.shift_comparison;
    var html = '<table class="shift-table"><thead><tr><th>\u73ED\u5225</th><th>\u6642\u9593</th><th>\u9700\u6C42\u4EBA\u6B21(\u5408\u4F75)</th><th>\u5BE6\u969B\u6392\u73ED(\u5408\u4F75)</th><th>\u9054\u6210\u7387</th></tr></thead><tbody>';
    rows.forEach(function(r) {
        var info = SHIFT_INFO[r.name];
        var rateColor = r.rate >= 100 ? '#4CAF50' : r.rate >= 80 ? '#FF9800' : '#F44336';
        html += '<tr><td style="background:' + info.color + ';color:white;font-weight:bold">' + info.label + '</td>' +
            '<td>' + r.time + '</td><td>' + r.required + '</td><td>' + r.actual + '</td>' +
            '<td style="color:' + rateColor + ';font-weight:bold">' + r.rate + '%</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('shiftComparison').innerHTML = html;
}

function renderMonthlyShifts() {
    var files = statsMulti.files;
    var shiftNames = Object.keys(SHIFT_INFO);
    var html = '<table class="shift-table"><thead><tr><th>\u6708\u4EFD</th>';
    shiftNames.forEach(function(name) {
        var info = SHIFT_INFO[name];
        html += '<th><span class="legend-color" style="background:' + info.color + ';vertical-align:middle"></span> ' + info.label + '</th>';
    });
    html += '<th>\u5408\u8A08</th></tr></thead><tbody>';
    files.forEach(function(f) {
        var total = 0;
        html += '<tr><td><strong>' + fileLabel(f) + '</strong><br><span style="font-size:10px;color:#999">' + f.filename + '</span></td>';
        shiftNames.forEach(function(name) {
            var c = f.shift_actual[name] || 0;
            total += c;
            html += '<td>' + c + '</td>';
        });
        html += '<td><strong>' + total + '</strong></td></tr>';
    });
    html += '<tr style="font-weight:bold;background:#E3F2FD"><td>\u5408\u8A08</td>';
    var grand = 0;
    shiftNames.forEach(function(name) {
        var sum = 0;
        files.forEach(function(f) { sum += (f.shift_actual[name] || 0); });
        grand += sum;
        html += '<td>' + sum + '</td>';
    });
    html += '<td>' + grand + '</td></tr>';
    html += '</tbody></table>';
    document.getElementById('monthlyShifts').innerHTML = html;
}

// ---- init: default select all files, merged stats ----
(function() {
    var boxes = document.querySelectorAll('.file-check');
    for (var i = 0; i < boxes.length; i++) {
        boxes[i].addEventListener('change', loadMultiStats);
    }
    var btnAll = document.getElementById('btnSelectAll');
    var btnNone = document.getElementById('btnSelectNone');
    var btnApply = document.getElementById('btnApply');
    if (btnAll) btnAll.addEventListener('click', function() { setSelectedFiles(getAllFiles()); });
    if (btnNone) btnNone.addEventListener('click', function() { setSelectedFiles([]); loadMultiStats(); });
    if (btnApply) btnApply.addEventListener('click', loadMultiStats);
    loadMultiStats();
})();
