import sys, os, io, threading, time, urllib.request, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
os.chdir(r'G:\Program_Testing\duty_table_Generator\web_duty')
sys.path.insert(0, r'G:\Program_Testing\duty_table_Generator\web_duty')

from app import app

def run():
    app.run(debug=False, host='127.0.0.1', port=5000, use_reloader=False)

t = threading.Thread(target=run, daemon=True)
t.start()
time.sleep(2)

# Fetch schedule API
with urllib.request.urlopen('http://127.0.0.1:5000/api/schedule/GN0N00003202609.csv', timeout=5) as resp:
    data = json.loads(resp.read())

print('Keys:', list(data.keys()))
print('Employees count:', len(data.get('employees', [])))
if data.get('employees'):
    e = data['employees'][0]
    print('First employee keys:', list(e.keys()))
    print('First employee:', e)
else:
    print('NO EMPLOYEES!')

# Also check if the dropdown would be populated
print()
print('=== populateEmpSelect output ===')
for emp in data.get('employees', [])[:5]:
    print('  %s - %s' % (emp['code'], emp.get('full_name', emp.get('name', ''))))
