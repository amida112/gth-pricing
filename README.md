# GTH Pricing — Hệ thống quản lý bảng giá gỗ

## Cách triển khai (dành cho người không biết lập trình)

### Cách 1: Deploy bằng Vercel (Khuyến nghị — Miễn phí)

**Bước 1: Tạo tài khoản**
1. Vào https://github.com → Sign up (đăng ký miễn phí)
2. Vào https://vercel.com → Sign up with GitHub

**Bước 2: Upload code lên GitHub**
1. Đăng nhập GitHub
2. Nhấn nút "+" góc trên phải → "New repository"
3. Đặt tên: `gth-pricing` → nhấn "Create repository"
4. Trong trang repository mới, nhấn "uploading an existing file"
5. Kéo thả TẤT CẢ file và folder trong thư mục này vào
6. Nhấn "Commit changes"

**Bước 3: Deploy trên Vercel**
1. Đăng nhập Vercel (vercel.com)
2. Nhấn "Add New..." → "Project"
3. Chọn repository `gth-pricing` từ danh sách
4. Nhấn "Deploy"
5. Đợi 1-2 phút, Vercel sẽ cho bạn link dạng: gth-pricing.vercel.app

**Xong!** Chia sẻ link đó cho nhân viên để dùng.

### Cách 2: Chạy trên máy tính (cần cài Node.js)

1. Cài Node.js: https://nodejs.org (chọn LTS)
2. Mở Terminal (Mac) hoặc Command Prompt (Windows)
3. cd vào thư mục này
4. Chạy: `npm install`
5. Chạy: `npm start`
6. Mở trình duyệt: http://localhost:3000
