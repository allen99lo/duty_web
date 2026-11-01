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
app.secret_key = os.environ.get("SECRET_KEY", "duty-schedule-dev-key")

# ============================================================
# CSV 解析模組
# ============================================================

# 員工代碼對照表（備援：CSV 無法取得姓名時使用）
MEMBER_MAP = {
    "CA": "張日曜", "CN": "孫景泰", "CO": "秦桔萬",
    "CP": "邱冠霖", "CQ": "官郁庭", "CR": "方振彬", "CS": "陳信憲",
    "MA": "詹文欽", "MB": "黃榮國", "NA": "范振宇",
    "NG": "王金誠", "NH": "王瑞發", "NI": "彭偉慎",
    "NM": "劉暐丞", "NN": "黃金鐘",
    "RA": "林森發", "RH": "劉錦郎", "RJ": "余金原",
    "RO": "張哲維", "RS": "陳志偉", "SA": "范振宇",
    "TA": "黃經洲", "TC": "洪柜峰",
    "TD": "林宏儒", "TE": "呂明峯", "TF": "周育稔", "TG": "許世勳",
    "TH": "羅應順", "NF": "許敦智",
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


def _is_valid_name(name):
    """姓名須含中文字且無缺字標記"""
    if not name or "?" in name or "？" in name:
        return False
    return any("\u4e00" <= ch <= "\u9fff" for ch in name)


def build_member_map(rows):
    """掃描 CSV 員工統計區，動態建立 代碼→姓名 對照；無效時回退內建表"""
    member_map = dict(MEMBER_MAP)
    for row in rows:
        if not row or len(row) < 2:
            continue
        code = row[0].strip()
        name = row[1].strip()
        if not code or not name:
            continue
        if not (code.isascii() and code.isalpha() and 2 <= len(code) <= 3):
            continue
        if name in ("員工姓名", "姓名"):
            continue
        if _is_valid_name(name):
            member_map[code] = name
    return member_map


def parse_employee_rows(rows, member_map):
    """掃描整份 CSV 的員工統計列（代碼在第 0 欄、姓名在第 1 欄）"""
    employees = []
    for row in rows:
        if not row or len(row) < 2:
            continue
        code = row[0].strip()
        name = row[1].strip()
        if not code or not (code.isascii() and code.isalpha() and 2 <= len(code) <= 3):
            continue
        if name in ("員工姓名", "姓名") or not name:
            continue

        shift_req = {}
        shift_keys = ["上班日-早", "上班日-小", "上班日-大", "假日-早", "假日-小", "假日-大"]
        for j, key in enumerate(shift_keys):
            val = row[2 + j].strip() if (2 + j) < len(row) and row[2 + j].strip() else "0"
            try:
                shift_req[key] = int(val)
            except ValueError:
                shift_req[key] = 0

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
            "full_name": member_map.get(code, name),
            "shift_requirements": shift_req,
            "total_hours": total_hours,
            "overtime_hours": overtime_hours,
        })
    return employees


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
    m = re.search(r'(\d{4})/(\d{2})', title)
    if m:
        year_month = f"{m.group(1)}-{m.group(2)}"

    # 動態從 CSV 建立代碼對照（優先 CSV，備援內建）
    member_map = build_member_map(rows)

    # 解析每日排班
    days = []
    for i in range(4, len(rows)):
        row = rows[i]
        day_num = row[0].strip() if row and row[0].strip() else ""
        weekday = row[1].strip() if len(row) > 1 and row[1].strip() else ""

        if not day_num or not day_num.isdigit():
            continue
        day_num = int(day_num)
        if day_num < 1 or day_num > 31:
            continue

        shifts = {}
        for group in SHIFT_GROUPS:
            members = []
            for col_idx in group["cols"]:
                if col_idx < len(row):
                    code = row[col_idx].strip()
                    if code and code != "\u3000" and code != "":
                        members.append({
                            "code": code,
                            "name": member_map.get(code, code),
                            "position": POSITION_LABELS[group["cols"].index(col_idx)]
                        })
                    else:
                        members.append(None)
                else:
                    members.append(None)
            shifts[group["name"]] = members

        is_weekend = weekday in ["六", "日"]

        days.append({
            "day": day_num,
            "weekday": weekday,
            "weekday_num": WEEKDAY_NAMES.index(weekday) if weekday in WEEKDAY_NAMES else -1,
            "is_weekend": is_weekend,
            "shifts": shifts,
        })

    # 員工統計表（動態掃描，不受固定列號限制）
    employees = parse_employee_rows(rows, member_map)

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
        "member_map": member_map,
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

    try:
        data = parse_duty_csv(file_path)
    except Exception as e:
        return jsonify({"error": f"CSV 解析失敗: {e}"}), 500
    return jsonify(data)


@app.route("/api/employee/<filename>/<code>")
def api_employee_detail(filename, code):
    """API: 取得特定員工的排班詳情"""
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": f"檔案不存在: {filename}"}), 404

    try:
        data = parse_duty_csv(file_path)
    except Exception as e:
        return jsonify({"error": f"CSV 解析失敗: {e}"}), 500
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


def compute_file_stats(data):
    """計算單一班表檔案的統計資料"""
    # 每日各班別人數
    daily_stats = []
    for day in data["days"]:
        stat = {"day": day["day"], "weekday": day["weekday"], "shifts": {}}
        for group_name, members in day["shifts"].items():
            count = sum(1 for m in members if m is not None)
            stat["shifts"][group_name] = count
        daily_stats.append(stat)

    # 每班別實際排班總人數
    actual_by_shift = defaultdict(int)
    for stat in daily_stats:
        for group_name, count in stat["shifts"].items():
            actual_by_shift[group_name] += count

    # 每班別需求人數（員工統計表加總）
    required_by_shift = defaultdict(int)
    for e in data["employees"]:
        for group_name, cnt in e["shift_requirements"].items():
            required_by_shift[group_name] += cnt

    # 員工工時排行
    emp_ranking = sorted(data["employees"], key=lambda x: x["total_hours"], reverse=True)

    total_hours = sum(e["total_hours"] for e in data["employees"])
    overtime_hours = sum(e["overtime_hours"] for e in data["employees"])
    emp_count = len(data["employees"])

    return {
        "daily_stats": daily_stats,
        "employee_ranking": emp_ranking,
        "total_days": len(data["days"]),
        "total_employees": emp_count,
        "total_hours": total_hours,
        "overtime_hours": overtime_hours,
        "avg_hours": round(total_hours / emp_count) if emp_count else 0,
        "max_hours": max((e["total_hours"] for e in data["employees"]), default=0),
        "actual_by_shift": dict(actual_by_shift),
        "required_by_shift": dict(required_by_shift),
    }


@app.route("/api/stats/<filename>")
def api_stats(filename):
    """API: 取得單一檔案統計資料"""
    file_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": f"檔案不存在: {filename}"}), 404

    try:
        data = parse_duty_csv(file_path)
    except Exception as e:
        return jsonify({"error": f"CSV 解析失敗: {e}"}), 500

    return jsonify(compute_file_stats(data))


@app.route("/api/stats_multi")
def api_stats_multi():
    """API: 取得多個班表檔案的合併統計資料（files=檔1.csv,檔2.csv,...）"""
    files_param = request.args.get("files", "")
    filenames = [f.strip() for f in files_param.split(",") if f.strip()]
    filenames = list(dict.fromkeys(filenames))  # 移除重複
    if not filenames:
        return jsonify({"error": "未選擇任何班表檔案"}), 400

    files_out = []
    errors = []
    merged_emps = {}
    merged_shift_required = defaultdict(int)
    merged_shift_actual = defaultdict(int)

    for fn in filenames:
        file_path = os.path.join(DATA_DIR, fn)
        if not os.path.exists(file_path):
            errors.append(f"檔案不存在: {fn}")
            continue
        try:
            data = parse_duty_csv(file_path)
        except Exception as e:
            errors.append(f"{fn} 解析失敗: {e}")
            continue

        stats = compute_file_stats(data)

        # 合併員工統計（跨月份累加）
        for e in data["employees"]:
            agg = merged_emps.setdefault(e["code"], {
                "code": e["code"],
                "name": e["full_name"],
                "total_hours": 0,
                "overtime_hours": 0,
                "actual_shifts": 0,
                "shift_counts": defaultdict(int),
                "months": [],
            })
            if e["full_name"]:
                agg["name"] = e["full_name"]
            agg["total_hours"] += e["total_hours"]
            agg["overtime_hours"] += e["overtime_hours"]
            emp_actual = data["employee_stats"].get(e["code"])
            if emp_actual:
                agg["actual_shifts"] += emp_actual["total"]
                for group_name, cnt in emp_actual["shifts"].items():
                    agg["shift_counts"][group_name] += cnt
            agg["months"].append({
                "filename": fn,
                "year_month": data["year_month"],
                "total_hours": e["total_hours"],
                "overtime_hours": e["overtime_hours"],
            })

        for group_name, cnt in stats["required_by_shift"].items():
            merged_shift_required[group_name] += cnt
        for group_name, cnt in stats["actual_by_shift"].items():
            merged_shift_actual[group_name] += cnt

        files_out.append({
            "filename": fn,
            "title": data["title"],
            "year_month": data["year_month"],
            "total_days": stats["total_days"],
            "employee_count": stats["total_employees"],
            "total_hours": stats["total_hours"],
            "overtime_hours": stats["overtime_hours"],
            "avg_hours": stats["avg_hours"],
            "max_hours": stats["max_hours"],
            "shift_actual": stats["actual_by_shift"],
            "shift_required": stats["required_by_shift"],
            "daily_stats": stats["daily_stats"],
        })

    # 合併後員工排行
    ranking = sorted(merged_emps.values(), key=lambda x: x["total_hours"], reverse=True)
    for r in ranking:
        r["shift_counts"] = dict(r["shift_counts"])

    # 合併後班別需求 vs 實際
    shift_comparison = []
    for group in SHIFT_GROUPS:
        name = group["name"]
        required = merged_shift_required[name]
        actual = merged_shift_actual[name]
        shift_comparison.append({
            "name": name,
            "label": name,
            "time": group["time"],
            "required": required,
            "actual": actual,
            "rate": round(actual / required * 100) if required else 0,
        })

    total_hours = sum(r["total_hours"] for r in ranking)
    overtime_hours = sum(r["overtime_hours"] for r in ranking)

    return jsonify({
        "files": files_out,
        "errors": errors,
        "merged": {
            "file_count": len(files_out),
            "total_days": sum(f["total_days"] for f in files_out),
            "employee_count": len(ranking),
            "total_hours": total_hours,
            "overtime_hours": overtime_hours,
            "avg_hours": round(total_hours / len(ranking)) if ranking else 0,
            "max_hours": max((r["total_hours"] for r in ranking), default=0),
            "employee_ranking": ranking,
            "shift_comparison": shift_comparison,
        },
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

    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("  排班表網站 - Duty Schedule Web Application")
    print(f"  http://127.0.0.1:{port}")
    print("=" * 60)
    app.run(debug=True, host="0.0.0.0", port=port)
