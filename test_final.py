import sys, os, io, urllib.request, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Test employee page HTML
with urllib.request.urlopen('http://127.0.0.1:5000/employee', timeout=5) as resp:
    html = resp.read().decode('utf-8')

# Check all key elements
checks = {
    'currentFile assignment': 'let currentFile' in html,
    'currentFile has value': "GN0N00003202609" in html,
    'loadSchedule call': 'loadSchedule()' in html,
    'empSelect dropdown': 'id="empSelect"' in html,
    'populateEmpSelect func': 'populateEmpSelect' in html,
    'selectEmployee func': 'selectEmployee' in html,
    'onFileChange func': 'onFileChange' in html,
}

print('=== Employee Page Checks ===')
for k, v in checks.items():
    print('  %s: %s' % (k, 'OK' if v else 'MISSING'))

# Test schedule API
with urllib.request.urlopen('http://127.0.0.1:5000/api/schedule/GN0N00003202609.csv', timeout=5) as resp:
    data = json.loads(resp.read())

print()
print('=== Schedule API ===')
print('  employees count: %d' % len(data.get('employees', [])))
print('  first 3:')
for e in data.get('employees', [])[:3]:
    print('    %s - %s' % (e['code'], e.get('full_name', '')))

# Test the index page too
with urllib.request.urlopen('http://127.0.0.1:5000/', timeout=5) as resp:
    index_html = resp.read().decode('utf-8')

print()
print('=== Index Page ===')
print('  has currentFile: %s' % ('let currentFile' in index_html))
print('  has CSV select: %s' % ('fileSelect' in index_html))
has_csv = 'GN0N00003202609' in index_html
print('  has CSV filename in select: %s' % has_csv)
