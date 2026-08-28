# 桃園裝修區臺 排班表系統

Web-based duty schedule viewer for 桃園裝修區臺 (GN0N00003) shift tables.

## 功能

- **月曆視圖** - 以月曆方式顯示每日排班，點擊日期查看詳情
- **員工排班** - 依員工查詢個人排班曆與統計
- **統計報表** - 班別人數分布、工時排行、需求vs實際達成率
- **班別圖例** - 7種班別彩色標示

## 班別說明

| 班別 | 時間 | 說明 |
|------|------|------|
| 上班日-早 | 08:00~17:00 | 早班 |
| 上班日-小 | 17:00~00:00 | 小夜班 |
| 上班日-大 | 00:00~08:00 | 大夜班 |
| 假日-早 | 08:00~16:00 | 假日早班 |
| 假日-小 | 16:00~00:00 | 假日小夜班 |
| 假日-大 | 00:00~08:00 | 假日大夜班 |
| 強制補休 | 08:30~16:30 | 補休 |

## 啟動方式

```bash
# 方式 1: 直接執行
G:\python-3.13.12-embed-amd64\python.exe app.py

# 方式 2: 使用 batch 檔
start_server.bat
```

瀏覽器開啟: http://127.0.0.1:5000

## 專案結構

```
web_duty/
├── app.py              # Flask 主程式 + CSV 解析
├── start_server.bat    # 啟動腳本
├── data/
│   └── GN0N00003202609.csv  # 排班 CSV 資料
├── templates/
│   ├── base.html       # 基礎版型 (導覽列)
│   ├── index.html      # 首頁 (員工概覽)
│   ├── calendar.html   # 月曆視圖
│   ├── employee.html   # 員工排班查詢
│   └── stats.html      # 統計報表
└── static/
    └── style.css       # 全域樣式
```

## API 端點

| 端點 | 說明 |
|------|------|
| `GET /api/schedule/<filename>` | 取得完整排班資料 |
| `GET /api/employee/<filename>/<code>` | 取得特定員工排班 |
| `GET /api/stats/<filename>` | 取得統計資料 |

## 新增月份資料

將新的 CSV 檔案放入 `data/` 目錄，網站會自動讀取。
"# duty_web" 
