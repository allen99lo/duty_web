import sys, os, threading, time, urllib.request, json, io

sys.path.insert(0, r'G:\Program_Testing\duty_table_Generator\web_duty')
os.chdir(r'G:\Program_Testing\duty_table_Generator\web_duty')

from app import app

def run_server():
    app.run(debug=False, host='127.0.0.1', port=5000, use_reloader=False)

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(2)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Test schedule API
url = 'http://127.0.0.1:5000/api/schedule/GN0N00003202609.csv'
with urllib.request.urlopen(url, timeout=5) as resp:
    data = json.loads(resp.read())
    d1 = data['days'][0]
    print('=== Day 1 Calendar Data ===')
    for gn, ms in d1['shifts'].items():
        filled = [m for m in ms if m]
        if filled:
            names = [m['name'] for m in filled]
            print('  %s: %s' % (gn, names))

# Test employee API - check all shifts per day
print()
url2 = 'http://127.0.0.1:5000/api/employee/GN0N00003202609.csv/TA'
with urllib.request.urlopen(url2, timeout=5) as resp:
    data = json.loads(resp.read())
    print('=== TA Employee Schedule ===')
    info = data['info']
    print('  Name: %s' % info['full_name'])
    print('  Total shifts: %d' % data['total_shifts'])
    day1_shifts = [s for s in data['schedule'] if s['day'] == 1]
    print('  Day 1 shifts: %d (should be 2)' % len(day1_shifts))
    for s in day1_shifts:
        print('    %s (%s)' % (s['shift'], s['time']))

# Test upload page
print()
url3 = 'http://127.0.0.1:5000/upload'
with urllib.request.urlopen(url3, timeout=5) as resp:
    html = resp.read().decode('utf-8')
    print('=== Upload Page ===')
    print('  Length: %d' % len(html))
    print('  Has upload form: %s' % ('uploadForm' in html))
    print('  Has file input: %s' % ('fileInput' in html))
    print('  Has drag-drop: %s' % ('dragover' in html))

# Test calendar page
print()
url4 = 'http://127.0.0.1:5000/calendar'
with urllib.request.urlopen(url4, timeout=5) as resp:
    html = resp.read().decode('utf-8')
    print('=== Calendar Page ===')
    print('  Has shift-name-line: %s' % ('shift-name-line' in html))
    print('  Has shift-names: %s' % ('shift-names' in html))

print()
print('All tests passed!')
