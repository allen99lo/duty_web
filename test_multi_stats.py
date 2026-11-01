# 臨時測試：多檔合併統計 API
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app

c = app.app.test_client()

# 一般情況：多檔
r = c.get('/api/stats_multi?files=GN0N00003202601.csv,GN0N00003202602.csv,GN0N00003202609.csv')
d = r.get_json()
print('status', r.status_code)
print('files', [f['filename'] for f in d['files']])
print('errors', d['errors'])
m = d['merged']
print('merged:', {k: m[k] for k in ['file_count', 'total_days', 'employee_count', 'total_hours', 'overtime_hours', 'avg_hours', 'max_hours']})
print('top3:', [(e['code'], e['name'], e['total_hours'], e['overtime_hours'], e['actual_shifts'], len(e['months'])) for e in m['employee_ranking'][:3]])
print('shift_cmp:', [(s['name'], s['required'], s['actual'], s['rate']) for s in m['shift_comparison']])
f = d['files'][0]
print('file0:', f['year_month'], f['total_days'], f['employee_count'], f['avg_hours'], f['max_hours'], 'daily=', len(f['daily_stats']))

# 單檔
r1 = c.get('/api/stats_multi?files=GN0N00003202609.csv')
d1 = r1.get_json()
print('single:', r1.status_code, d1['merged']['file_count'], d1['merged']['total_days'])

# 檔案不存在
r2 = c.get('/api/stats_multi?files=NOPE.csv')
d2 = r2.get_json()
print('missing:', r2.status_code, d2['files'], d2['errors'], d2['merged']['file_count'])

# 未選擇檔案
r3 = c.get('/api/stats_multi')
print('empty:', r3.status_code, r3.get_json())

# 舊單檔 API 仍正常
r4 = c.get('/api/stats/GN0N00003202609.csv')
d4 = r4.get_json()
print('old api:', r4.status_code, sorted(d4.keys()))

# 統計頁面可渲染
r5 = c.get('/stats')
print('stats page:', r5.status_code, 'file-check' in r5.get_data(as_text=True))
