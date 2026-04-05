# NNUDM Web Thời Trang (Node.js + PostgreSQL)

Hướng dẫn chạy dự án từ đầu cho máy mới (chưa có database).

## 1) Yêu cầu cài đặt

- Node.js `>= 18`
- npm `>= 9`
- Docker Desktop (khuyến nghị để chạy PostgreSQL nhanh)

Kiểm tra nhanh:

```powershell
node -v
npm -v
docker -v
```

## 2) Cấu trúc dự án

- `backend/`: API Node.js (Express + PostgreSQL)
- `frontend/`: giao diện HTML/CSS/JS
- `backend/db/migrations/`: các file SQL migration

## 3) Chạy PostgreSQL bằng Docker (khuyến nghị)

Từ thư mục gốc dự án:

```powershell
docker run --name fashion-postgres `
  -e POSTGRES_PASSWORD=password `
  -e POSTGRES_DB=fashion_db `
  -p 5432:5432 `
  -d postgres:16
```

Kiểm tra container:

```powershell
docker ps
```

## 4) Cấu hình biến môi trường backend

Tạo file `backend/.env` (copy từ `backend/.env.example`):

```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/fashion_db
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
FRONTEND_URL=http://localhost:5500
MAIL_USER=yourmail@gmail.com
MAIL_PASS=your_app_password
```

Lưu ý:
- Nếu gặp lỗi `DB connection error: getaddrinfo ENOTFOUND ...`, thường là sai host trong `DATABASE_URL`.
- Host đúng local Docker là `localhost` (không phải `base`).

## 5) Khởi tạo database schema (bắt buộc)

Chạy lần lượt các migration sau:

1. `001_init.sql`
2. `002_incremental_phuc_orders_payments.sql`
3. `003_incremental_tan_reviews.sql`
4. `004_incremental_dat_wishlists_flashsales.sql`

Lệnh PowerShell (không dùng `<` vì PowerShell báo lỗi):

```powershell
Get-Content -Raw ".\backend\db\migrations\001_init.sql" | docker exec -i fashion-postgres psql -U postgres -d fashion_db
Get-Content -Raw ".\backend\db\migrations\002_incremental_phuc_orders_payments.sql" | docker exec -i fashion-postgres psql -U postgres -d fashion_db
Get-Content -Raw ".\backend\db\migrations\003_incremental_tan_reviews.sql" | docker exec -i fashion-postgres psql -U postgres -d fashion_db
Get-Content -Raw ".\backend\db\migrations\004_incremental_dat_wishlists_flashsales.sql" | docker exec -i fashion-postgres psql -U postgres -d fashion_db
```

## 6) Cài dependency và chạy backend

```powershell
cd backend
npm install
npm start
```

Khi chạy thành công, console sẽ có:
- `connected to PostgreSQL`
- `Server running on port 3000`

Test nhanh API:

```powershell
curl http://localhost:3000/api/v1
```

## 7) Chạy frontend

### Cách A (dễ nhất): VSCode Live Server
- Mở thư mục `frontend/`
- Chuột phải `index.html` -> `Open with Live Server`
- URL thường là: `http://localhost:5500`

### Cách B: dùng serve

```powershell
npx serve frontend -l 5500
```

## 8) Tạo tài khoản test

Bạn có thể đăng ký user thường bằng API:

`POST http://localhost:3000/api/v1/auth/register`

```json
{
  "username": "user_api_01",
  "password": "123456Aa@",
  "email": "user_api_01@example.com",
  "fullName": "User API 01",
  "phone": "0900000001"
}
```

Nếu cần quyền admin cho user này:

```powershell
docker exec -it fashion-postgres psql -U postgres -d fashion_db -c "UPDATE users SET role_id=1 WHERE username='user_api_01';"
```

Đăng nhập:
- Username: `user_api_01`
- Password: `123456Aa@`


##9) Lỗi thường gặp

1. `The '<' operator is reserved for future use`  
Nguyên nhân: dùng `< file.sql` trên PowerShell.  
Cách đúng: `Get-Content -Raw file.sql | docker exec -i ... psql ...`

2. `DB connection error: getaddrinfo ENOTFOUND ...`  
Nguyên nhân: sai host trong `DATABASE_URL`.  
Cách sửa: dùng `localhost:5432` khi DB chạy local Docker.

3. Không load ảnh upload  
Kiểm tra backend đã chạy và route static `/uploads` đang hoạt động.

---

Nếu cần reset DB từ đầu:

```powershell
docker rm -f fashion-postgres
docker volume prune -f
```

Sau đó tạo lại container và chạy lại migration từ bước 3 -> bước 5.
