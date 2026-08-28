import sys, os
sys.path.insert(0, r'G:\Program_Testing\duty_table_Generator\web_duty')
os.chdir(r'G:\Program_Testing\duty_table_Generator\web_duty')
from app import parse_duty_csv

data = parse_duty_csv(r'G:\Program_Testing\duty_table_Generator\web_duty\data\GN0N00003202609.csv')
print("Title:", data["title"])
print("Year-Month:", data["year_month"])
print("Days:", len(data["days"]))
print("Employees:", len(data["employees"]))
print("Employee stats:", len(data["employee_stats"]))
print()

d1 = data["days"][0]
print("Day %d (%s):" % (d1["day"], d1["weekday"]))
for gn, ms in d1["shifts"].items():
    filled = [m["code"] for m in ms if m]
    if filled:
        print("  %s: %s" % (gn, filled))
print()

e1 = data["employees"][0]
print("Employee: %s - %s" % (e1["code"], e1["full_name"]))
print("  Requirements:", e1["shift_requirements"])
print("  Total hours:", e1["total_hours"])
print()

# Show all employees
print("=== All Employees ===")
for e in data["employees"]:
    print("  %s - %s | Total: %dh" % (e["code"], e["full_name"], e["total_hours"]))
