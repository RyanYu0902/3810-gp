# The Reading Room — REST API 示範指令

本檔供簡報示範使用；指令會對指定資料庫建立、修改或刪除資料。請先準備獨立的示範資料庫及帳號，並依照實際情況替換下列方括號內容。不要把真實密碼或 Cookie 檔案提交到 Git。

## 事前準備

- 先啟動程式，並確認 MongoDB 是可使用交易的 replica set。
- 預先準備管理員和一般會員。Google 登入是可選的；以下示範使用電郵和密碼。
- 將 `BASE` 改成實際伺服器網址。執行登入指令時輸入示範帳號資料；密碼不會顯示在終端機畫面上。
- 從 API 回傳的 JSON 中複製 `_id`；不要輸入方括號。

```bash
BASE="http://localhost:3000"
printf '管理員電郵: '; read -r MANAGER_EMAIL
printf '管理員密碼: '; read -rs MANAGER_PASSWORD; printf '\n'
curl -i -c manager-cookies.txt -X POST "$BASE/login" \
  --data-urlencode "email=$MANAGER_EMAIL" --data-urlencode "password=$MANAGER_PASSWORD"
unset MANAGER_PASSWORD

printf '會員電郵: '; read -r MEMBER_EMAIL
printf '會員密碼: '; read -rs MEMBER_PASSWORD; printf '\n'
curl -i -c member-cookies.txt -X POST "$BASE/login" \
  --data-urlencode "email=$MEMBER_EMAIL" --data-urlencode "password=$MEMBER_PASSWORD"
unset MEMBER_PASSWORD
```

登入成功會回傳重新導向，Cookie 檔案代表登入身分，請妥善保管。若 curl 在沒有互動終端的環境執行，`read -s` 可能不可用。

## 書籍 CRUD（管理員）

先選一個未被使用的 ISBN，替換下方範例。此書不要建立借閱紀錄，才能示範刪除。

```bash
# Create：新增一本書；從回傳 JSON 複製 _id
curl -sS -b manager-cookies.txt -X POST "$BASE/api/books" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Demo Book","author":"Demo Author","isbn":"DEMO-UNIQUE-001","category":"Demo","totalCopies":2}'

# 貼上剛才回傳的 _id
BOOK_ID="[新書的_id]"

# Read：查詢全部書籍及指定書籍
curl -sS -b manager-cookies.txt "$BASE/api/books"
curl -sS -b manager-cookies.txt "$BASE/api/books/$BOOK_ID"

# Update：PUT 需要提供所有可編輯的必要欄位
curl -sS -b manager-cookies.txt -X PUT "$BASE/api/books/$BOOK_ID" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Demo Book Updated","author":"Demo Author","isbn":"DEMO-UNIQUE-001","category":"Demo","totalCopies":3}'

# Delete：只能刪除沒有借閱歷史的書籍；成功回應 HTTP 204
curl -i -b manager-cookies.txt -X DELETE "$BASE/api/books/$BOOK_ID"
```

## 借閱 REST API

使用另一本可借的實體書；可從 `GET /api/books` 的 JSON 中取得 `_id`。示範會改變借閱及館藏狀態。

```bash
LOAN_BOOK_ID="[另一本可借實體書的_id]"

# Create：會員提出借閱；從回傳 JSON 複製 _id
curl -sS -b member-cookies.txt -X POST "$BASE/api/borrow-records" \
  -H 'Content-Type: application/json' -d "{\"bookId\":\"$LOAN_BOOK_ID\"}"
RECORD_ID="[借閱紀錄的_id]"

# Read：會員只會看到自己的紀錄；管理員可以查看所有紀錄
curl -sS -b member-cookies.txt "$BASE/api/borrow-records"
curl -sS -b manager-cookies.txt "$BASE/api/borrow-records"

# Update：管理員批准，再記錄歸還
curl -sS -b manager-cookies.txt -X PUT "$BASE/api/borrow-records/$RECORD_ID" \
  -H 'Content-Type: application/json' -d '{"action":"approve"}'
curl -sS -b manager-cookies.txt -X PUT "$BASE/api/borrow-records/$RECORD_ID" \
  -H 'Content-Type: application/json' -d '{"action":"return"}'

# 另一條路徑：新建一筆 pending 紀錄後，會員可用 DELETE 取消
curl -sS -b member-cookies.txt -X POST "$BASE/api/borrow-records" \
  -H 'Content-Type: application/json' -d "{\"bookId\":\"$LOAN_BOOK_ID\"}"
PENDING_ID="[新 pending 紀錄的_id]"
curl -sS -b member-cookies.txt -X DELETE "$BASE/api/borrow-records/$PENDING_ID"
```

`DELETE /api/borrow-records/:id` 會把待處理請求標記為 `cancelled`，保留歷史紀錄，不會刪除文件。管理員亦可對 pending 紀錄使用 `{"action":"reject"}`；會員亦可使用 `{"action":"cancel"}`。詳細 API 列表見 README。
