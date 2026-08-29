"""
排班表網站 - Duty Schedule Web Application
讀取 CSV 排班資料，提供月曆視圖、員工查詢、統計報表
"""
import os
import csv
import io
import sys
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Flask, render_template, jsonify, request, send_from_directory, redirect, url_for, flash

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

# ============================================================
# CSV 解析模組
# ============================================================

# 員工代碼對照表 (從 member.txt)
MEMBER_MAP = {
    "CA": "張日曜", "CK": "張日曜", "CN": "孫景泰", "CO": "秦桔萬",
    "CP": "邱冠霖", "CQ": "官郁庭", "CR": "方振彬", "CS": "陳信憲",
    "MA": "詹文欽", "MB": "黃榮國", "NA": "范振宇", "NF": "許敦智",
    "NG": "王金誠", "NH": "王瑞發", "NI": "彭偉慎", "NN": "劉暐丞",
    "RA": "林森發", "RB": "黃煜森", "RH": "劉錦郎", "RJ": "余金原",
    "RO": "張哲維", "RS": "陳志偉", "TA": "黃經洲", "TC": "洪柜峰",
    "TD": "林宏儒", "TE": "呂明峯", "TF": "周育稔", "TG": "許世勳",
    "TH": "羅應順", "SA": "范振宇",
}

# 班別定義
SHIFT_GROUPS = [
    {"name": "上班日-早", "time": "08:00~17:00", "cols": list(range(2, 8))},
    {"name": "上班日-小", "time": "17:00~00:00", "cols": list(range(8, 14))},
    {"name": "上班日-大", "time": "00:00~08:00", "cols": list(range(14, 20))},
    {"name": "假日-早",   "time": "08:00~16:00", "cols": list(range(20, 26))},
    {"name": "假日-小",   "time": "16:00~00:00", "cols": list(range(26, 32))},
    {"name": "假日-大",   "time": "00:00~08:00", "cols": list(range(32, 38))},
    {"name": "強制補休", "time": "08:30~16:30", "cols": list(range(38, 44))},
]

POSITION_LABELS = ["S", "A", "B", "C", "D", "E"]

# 顏色配置
SHIFT_COLORS = {
    "上班日-早": "#4CAF50",  # 綠
    "上班日-小": "#2196F3",  # 藍
    "上班日-大": "#9C27B0",  # 紫
    "假日-早":   "#FF9800",  # 橙
    "假日-小":   "#F44336",  # 紅
    "假日-大":   "#795548",  # 棕
    "強制補休": "#607D8B",  # 灰藍
}

WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"]


def read_csv_file(file_path):
    """以 big5 編碼讀取 CSV"""
    encodings = ['big5', 'cp950', 'utf-8-sig', 'utf-8']
    for enc in encodings:
        try:
            with open(file_path, encoding=enc) as f:
                content = f.read()
            return content
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError(f"無法以任何已知編碼讀取 {file_path}")


def parse_duty_csv(file_path):
    """解析排班 CSV，回傳結構化資料"""
    content = read_csv_file(file_path)
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    # 解析標題
    title = rows[0][0] if rows else ""

    # 解析月份 (從標題提取年月)
    import re
    year_month = ""
    if "2026" in title and "09" in title:
        year_month = "2026-09"
    else:
        # 嘗試從標題提取
        import re
        m = re.search(r'(\d{4})/(\d{2})', title)
        if m:
            year_month = f"{m.group(1)}-{m.group(2)}"
    m = re.search(r'(\d{4})/(\d{2})', title)
    if m:
    year_month = f"{m.group(1)}-{m.group(2)}"

    # 解析每日排班 (row 4 ~ row 33, 共30天)
    days = []
    for i in range(4, len(rows)):
        if i >= len(rows):
            break
        row = rows[i]
        day_num = row[0].strip() if row[0].strip() else ""
        weekday = row[1].strip() if len(row) > 1 and row[1].strip() else ""

        if not day_num:
            continue

        # 解析每個班別的人員
        shifts = {}
        for group in SHIFT_GROUPS:
            members = []
            for col_idx in group["cols"]:
                if col_idx < len(row):
                    code = row[col_idx].strip()
                    # 全形空白 or 空白 都視為空
                    if code and code != "\u3000" and code != "":
                        members.append({
                            "code": code,
                            "name": MEMBER_MAP.get(code, code),
                            "position": POSITION_LABELS[group["cols"].index(col_idx)]
                        })
                    else:
                        members.append(None)
                else:
                    members.append(None)
            shifts[group["name"]] = members

        # 判斷是否為假日
        is_weekend = weekday in ["六", "日"]

        days.append({
            "day": int(day_num),
            "weekday": weekday,
            "weekday_num": WEEKDAY_NAMES.index(weekday) if weekday in WEEKDAY_NAMES else -1,
            "is_weekend": is_weekend,
            "shifts": shifts,
        })

    # 解析員工統計表 (row 39 ~ row 65)
    employees = []
    for i in range(39, min(len(rows), 66)):
        row = rows[i]
        code = row[0].strip() if row[0].strip() else ""
        name = row[1].strip() if len(row) > 1 and row[1].strip() else ""

        if not code or code == "製 表":
            continue

        # 班次需求
        shift_req = {}
        shift_keys = ["上班日-早", "上班日-小", "上班日-大", "假日-早", "假日-小", "假日-大"]
        for j, key in enumerate(shift_keys):
            val = row[2 + j].strip() if (2 + j) < len(row) and row[2 + j].strip() else "0"
            try:
                shift_req[key] = int(val)
            except ValueError:
                shift_req[key] = 0

        # 工時
        total_hours = row[8].strip() if len(row) > 8 and row[8].strip() else "0"
        overtime_hours = row[10].strip() if len(row) > 10 and row[10].strip() else "0"

        try:
            total_hours = int(total_hours)
        except ValueError:
            total_hours = 0
        try:
            overtime_hours = int(overtime_hours)
        except ValueError:
            overtime_hours = 0

        employees.append({
            "code": code,
            "name": name,
            "full_name": MEMBER_MAP.get(code, name),
            "shift_requirements": shift_req,
            "total_hours": total_hours,
            "overtime_hours": overtime_hours,
        })

    # 計算每位員工的實際排班統計
    emp_stats = defaultdict(lambda: {"code": "", "name": "", "shifts": defaultdict(int), "total": 0, "days": []})
    for day in days:
        for group_name, members in day["shifts"].items():
            for m in members:
                if m:
                    code = m["code"]
                    emp_stats[code]["code"] = code
                    emp_stats[code]["name"] = m["name"]
                    emp_stats[code]["shifts"][group_name] += 1
                    emp_stats[code]["total"] += 1
                    emp_stats[code]["days"].append({
                        "day": day["day"],
                        "shift": group_name,
                        "position": POSITION_LABELS[day["shifts"][group_name].index(m)]
                    })

    return {
        "title": title,
        "year_month": year_month,
        "days": days,
        "employees": employees,
        "employee_stats": dict(emp_stats),
        "shift_groups": SHIFT_GROUPS,
        "shift_colors": SHIFT_COLORS,
        "member_map": MEMBER_MAP,
    }


# ============================================================
# 路由
# ============================================================

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def get_csv_files():
    """列出 data 目錄下所有 CSV"""
    files = []
    if os.path.exists(DATA_DIR):
        for f in sorted(os.listdir(DATA_DIR)):
            if f.lower().endswith(".csv"):
                files.append(f)
    return files


@app.route("/")
def index():
    """首頁 - 月曆視圖"""
    # 列出可用的 CSV 檔案
    csv_files = []
    if os.path.exists(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            if f.endswith(".csv"):
                csv_files.append(f)
    return render_template("index.html", csv_files=get_csv_files())


@app.route("/api/schedule/<filename>")
def api_schedule(filename):
    """API: 取得排班資料"""
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": f"檔案不存在: {filename}"}), 404

    data = parse_duty_csv(file_path)
    return jsonify(data)


@app.route("/api/employee/<filename>/<code>")
def api_employee_detail(filename, code):
    """API: 取得特定員工的排班詳情"""
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": f"檔案不存在: {filename}"}), 404

    data = parse_duty_csv(file_path)
    code = code.upper()

    # 該員工的所有排班
    schedule = []
    for day in data["days"]:
        for group_name, members in day["shifts"].items():
            for i, m in enumerate(members):
                if m and m["code"] == code:
                    schedule.append({
                        "day": day["day"],
                        "weekday": day["weekday"],
                        "shift": group_name,
                        "position": POSITION_LABELS[i],
                        "time": next(g["time"] for g in SHIFT_GROUPS if g["name"] == group_name),
                    })

    emp_info = next((e for e in data["employees"] if e["code"] == code), None)

    return jsonify({
        "code": code,
        "info": emp_info,
        "schedule": schedule,
        "total_shifts": len(schedule),
    })


@app.route("/api/stats/<filename>")
def api_stats(filename):
    """API: 取得統計資料"""
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": f"檔案不存在: {filename}"}), 404

    data = parse_duty_csv(file_path)

    # 每日各班別人數
    daily_stats = []
    for day in data["days"]:
        stat = {"day": day["day"], "weekday": day["weekday"], "shifts": {}}
        for group_name, members in day["shifts"].items():
            count = sum(1 for m in members if m is not None)
            stat["shifts"][group_name] = count
        daily_stats.append(stat)

    # 員工工時排行
    emp_ranking = sorted(data["employees"], key=lambda x: x["total_hours"], reverse=True)

    return jsonify({
        "daily_stats": daily_stats,
        "employee_ranking": emp_ranking,
        "total_days": len(data["days"]),
        "total_employees": len(data["employees"]),
    })


@app.route("/calendar")
def calendar_view():
    """月曆頁面"""
    return render_template("calendar.html", csv_files=get_csv_files())


@app.route("/employee")
def employee_view():
    """員工頁面"""
    return render_template("employee.html", csv_files=get_csv_files())


@app.route("/stats")
def stats_view():
    """統計頁面"""
    return render_template("stats.html", csv_files=get_csv_files())


@app.route("/upload", methods=["GET", "POST"])
def upload_view():
    """CSV 匯入頁面"""
    if request.method == "POST":
        if "csv_file" not in request.files:
            flash("未選擇檔案", "error")
            return redirect(url_for("upload_view"))

        file = request.files["csv_file"]
        if file.filename == "":
            flash("未選擇檔案", "error")
            return redirect(url_for("upload_view"))

        if file and file.filename.lower().endswith(".csv"):
            filename = file.filename
            save_path = os.path.join(DATA_DIR, filename)
            os.makedirs(DATA_DIR, exist_ok=True)
            file.save(save_path)

            # 驗證 CSV 可解析
            try:
                parse_duty_csv(save_path)
                flash(f"已成功匯入: {filename}", "success")
            except Exception as e:
                flash(f"CSV 解析失敗: {e}", "error")

            return redirect(url_for("upload_view"))
        else:
            flash("僅支援 CSV 檔案", "error")
            return redirect(url_for("upload_view"))

    return render_template("upload.html", csv_files=get_csv_files())


# ============================================================
# 啟動
# ============================================================

if __name__ == "__main__":
    # 複製 CSV 到 data 目錄 (如果不在的話)
    src_csv = r"G:\Program_Testing\duty_table_Generator\SourceCode\GN0N00003202609.csv"
    dst_csv = os.path.join(DATA_DIR, "GN0N00003202609.csv")
    if os.path.exists(src_csv) and not os.path.exists(dst_csv):
        import shutil
        shutil.copy2(src_csv, dst_csv)
        print(f"已複製 CSV 到 {dst_csv}")

    print("=" * 60)
    print("  排班表網站 - Duty Schedule Web Application")
    print("  http://127.0.0.1:5000")
    print("=" * 60)
    app.run(debug=True, host="127.0.0.1", port=5000)
