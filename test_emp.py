import sys, os, io, threading, time, urllib.request, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
os.chdir(r'G:\Program_Testing\duty_table_Generator\web_duty')
sys.path.insert(0, r'G:\Program_Testing\duty_table_Generator\web_duty')

from app import app

def run():
    app.run(debug=False, host='127.0.0.1', port=5000, use_reloader=False)

t = threading.Thread(target=run, daemon=True)
t.start()
time.sleep(2)

# Fetch employee page
with urllib.request.urlopen('http://127.0.0.1:5000/employee', timeout=5) as resp:
    html = resp.read().decode('utf-8')

# Find currentFile
m = re.search(r"let currentFile = '([^']*)'", html)
if m:
    print('currentFile = "%s"' % m.group(1))
else:
    print('currentFile NOT FOUND')

# Find key lines
for i, line in enumerate(html.split('\n'), 1):
    s = line.strip()
    if 'currentFile' in s or 'loadSchedule' in s or 'empSelect' in s:
        print('L%d: %s' % (i, s[:120]))
