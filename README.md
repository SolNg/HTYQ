# HTYQ-LITE (Động Cơ Sống)

**HTYQ-LITE** (hay còn gọi là **Động Cơ Sống**) là một bản mod mở rộng (Extension) dành cho trình giả lập nhập vai **SillyTavern**. Được thiết kế đặc biệt dành cho các bối cảnh Tu Tiên, Cổ Trang hoặc Thế Giới Mở, bản mod này thổi hồn vào thế giới xung quanh nhân vật của bạn, biến một cuộc trò chuyện tĩnh thành một vũ trụ sống động, có tính liên tục và tự vận hành.

Thay vì thế giới chỉ xoay quanh nhân vật chính (Player), Động Cơ Sống sẽ tự động suy diễn các sự kiện ngầm, quản lý các mối quan hệ thế lực, diễn tiến thời gian và lưu trữ ký ức thông minh, giúp trải nghiệm Roleplay (Nhập vai) của bạn trở nên sâu sắc và chân thực hơn bao giờ hết.

## 🌟 Tính Năng Nổi Bật

### 1. ⏳ Hệ Thống Thời Gian Thông Minh
Tích hợp một đồng hồ in-game chuyên dụng để theo dõi **Thời Gian Thế Giới**. 
- **Chế Độ AI:** Hệ thống tự động phân tích cốt truyện để tính toán thời gian trôi qua, kích hoạt suy diễn thế giới khi đến thời điểm thích hợp. (Hỗ trợ bắt từ khóa thông minh như "ba ngày sau", "vào sáng mai").
- **Chế Độ Thủ Công:** Tùy chỉnh tự động suy diễn theo số vòng hội thoại (round) nhất định.

### 2. 🌍 Động Cơ Suy Diễn Thế Giới (World Evolution)
Khi thời gian trôi qua, hệ thống sẽ gọi các API ngầm để mô phỏng "phía sau bức màn" của thế giới, bao gồm:
- **Chuỗi Sự Kiện:** Các sự kiện thế giới tự động phát triển, thăng cấp hoặc kết thúc.
- **Thế Lực & Quan Hệ:** Các môn phái, quốc gia, hay tổ chức sẽ có sự thay đổi về tài nguyên, độ đoàn kết và tương tác (kết minh, thù địch) với nhau.
- **Danh Tiếng & Tin Đồn:** Các hành động của bạn sẽ tạo ra danh tiếng trong Giang Hồ, Quan Phủ, Dân Gian và Hắc Đạo, từ đó sinh ra các tin đồn lan truyền khắp nơi.

### 3. 🧠 Quản Lý Ký Ức & Cảm Xúc Tiên Tiến
Một cơ chế bộ nhớ độc lập giúp AI không bao giờ "quên" những chi tiết cốt lõi:
- **Trích Xuất Nhãn (Tagging):** Tự động phân loại ký ức theo Thực Thể, Chủ Đề, Địa Điểm.
- **Lưu Trữ Phân Cấp:** Tóm tắt ký ức qua từng Vòng -> Chương -> Quyển để giữ cho ngữ cảnh (context) của AI luôn sạch sẽ mà vẫn nhớ được cốt truyện dài.
- **Nhồi (Injection) Ký Ức Động:** Chỉ gọi lại những ký ức thực sự liên quan đến ngữ cảnh hiện tại.
- **Sổ Tay Huyết Cừu & Cảm Xúc:** Theo dõi thái độ, ân oán tình thù giữa các NPC và Player.

### 4. 🎛️ Bảng Điều Khiển Trực Quan (Control Panel)
Extension cung cấp một giao diện điều khiển (UI) với 5 thẻ (Tabs) tiện dụng ngay trong giao diện SillyTavern:
- **Tổng Quan:** Xem tóm tắt thế giới, danh tiếng và sự kiện hiện tại.
- **Thế Giới:** Phân tích chi tiết các thế lực, quan hệ và chuỗi nhân quả.
- **Ký Ức:** Quản lý và tìm kiếm lại các diễn biến cũ.
- **Cài Đặt:** Điều chỉnh các kết nối API, mô hình AI tự động.
- **Động Cơ:** Các công cụ gỡ lỗi (debug) và tùy chỉnh nhịp độ thời gian.

---
**Hướng Dẫn Cài Đặt:** Đặt thư mục `HTYQ-LITE-main` vào thư mục `public/extensions/` của cấu trúc tệp SillyTavern và khởi động lại ứng dụng. Bảng điều khiển Động Cơ Sống có thể được mở bằng phím tắt biểu tượng Trái Đất (🌐) phía trên thanh nhập liệu.
