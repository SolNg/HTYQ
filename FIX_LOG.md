# 🧠 HTYQ Lite Fix Log — v2.1.0 Báo Cáo Sửa Lỗi

## Tổng Quan

- **Thời Gian**: 2026-06-05 20:41 (Asia/Hong_Kong)
- **Phiên Bản**: 2.0.0 → 2.1.0
- **Số File**: 12 → 13 (Thêm mới FIX_LOG.md)
- **Mô Khối Sửa Lỗi**: 9 file cốt lõi
- **Bao Phủ Lỗi (Bug)**: 6/6 (P0×1 + P1×2 + P2×3)
- **Bổ Sung Chức Năng**: 6 mô khối cốt lõi

---

## 1. Ghi Chú Chi Tiết Sửa Lỗi

### Lỗi 4+5 (P0) Viết Lại Cấu Trúc Bơm (Inject): addOneMessage → registerInjection

**File**: `htyq-lite.js`

| Vấn Đề | Sửa Lỗi |
|:---|:---|
| Sử dụng `ctx.addOneMessage()` để bơm → Gây ô nhiễm lịch sử chat, lộ tin nhắn hệ thống | Đổi sang dùng API bơm prompt của SillyTavern: Tương thích 3 cấp `registerInjection` / `setExtensionPrompt` / mảng `extensionPrompts` |
| Bơm tin nhắn xong có thể kích hoạt vòng lặp sự kiện → Trùng lặp tin nhắn (Lỗi 5) | Nội dung bơm nằm ở tầng prompt, không nằm ở tầng chat, không kích hoạt vòng lặp sự kiện |
| Một số phiên bản ST không hỗ trợ `addOneMessage` | 4 tầng dự phòng: registerInjection → setExtensionPrompt → mảng extensionPrompts → generateOpts → addOneMessage (phương án lùi cuối cùng) |
| Không có khóa chống lặp → Có thể bơm nhiều lần | Thêm khóa chống lặp `window.__HTYQ_INJECTING__`, khối finally đảm bảo giải phóng khóa |
| Tồn đọng dữ liệu bơm khi chuyển đổi Chat / Token | Gọi `unregisterInjection()` trong `onChatLoaded` để dọn dẹp dữ liệu bơm cũ |

### Lỗi 2 (P0) Tính Thông Dụng UI: Không Thể Thoát, Chiếm Màn Hình, Tràn Màn Hình

**File**: `htyq-lite-ui.js`, `style.css`

| Vấn Đề | Sửa Lỗi |
|:---|:---|
| Không thể dùng phím ESC để đóng bảng điều khiển | Thêm lắng nghe sự kiện `keydown` của document cho phím ESC, đóng bảng điều khiển |
| Bấm ra ngoài bảng điều khiển không thể đóng | Trên giao diện máy tính thêm `mousedown` đóng khi click bên ngoài, defer 100ms để tránh thao tác nhầm |
| Sai lệch vị trí bảng điều khiển sau khi resize cửa sổ | Thêm lắng nghe sự kiện `resize`, tự động tính toán lại vị trí bảng điều khiển (máy tính chống tràn màn hình) |
| Tương thích toàn màn hình cho Điện thoại/Máy tính bảng | CSS media query: 480px (Điện thoại toàn màn hình), 768px (Máy tính bảng bo tròn góc trên) |
| Kích thước cố định 520px×620px không tương thích mọi màn hình | Đổi sang kích thước co giãn, điện thoại dùng `100vw × calc(100vh - 70px)` |

### Lỗi 1 (P1) Thời Điểm Mở Suy Luận Mới

**File**: `htyq-lite.js`

| Vấn Đề | Sửa Lỗi |
|:---|:---|
| Cuối `init()` gọi `await onChatLoaded()` → Chat mới lập tức suy luận | Xóa lệnh gọi này, đổi thành tải chậm (lazy load); Gửi lần đầu tiên kiểm tra `if (!worldbookLoaded)` mới tải |
| `lastInjectedRound` không thiết lập lại khi chuyển chat | Thiết lập lại `lastInjectedRound = -1` trong `onChatLoaded` |
| Thiếu kiểm tra rỗng đối với chat mới | Thêm `if (chat.length === 0)` để đóng băng suy luận, thiết lập `state.round = 0` |

### Lỗi 3 (P1) Xếp Chữ CSS

**File**: `style.css`

| Vấn Đề | Sửa Lỗi |
|:---|:---|
| Chữ trong thẻ (card) thiếu `line-height` | Thiết lập đồng nhất: `.htyq-lite-view` 1.6, `.htyq-lite-card` 1.5, phần tử con 1.6 |
| Thiếu `word-break` | Thêm `word-break: break-word` |
| Danh sách không có khoảng cách | Thêm `ul padding-left:16px`, `li margin-bottom:4px`, phần tử giả `•` chấm tròn |
| Mục ký ức không có khoảng cách | Thêm `line-height:1.5` cho `.htyq-lite-memory-item`, xếp chữ chi tiết/khối mã |

### Lỗi 6 (P2) Tồn Đọng Bảng Điều Khiển Cũ

**File**: `htyq-lite-ui.js`, `htyq-lite.js`

| Vấn Đề | Sửa Lỗi |
|:---|:---|
| `panelVisible` không thiết lập lại khi chuyển chat | Thêm hàm `resetUI()`: `panelVisible=false, currentTab='overview', display='none'` |
| Tồn đọng dữ liệu bơm cũ | Gọi `unregisterInjection()` trong `onChatLoaded` |
| Rò rỉ bộ lắng nghe toàn cục (global listeners) | Gọi `removeGlobalListeners()` trong `resetUI()` |

---

## 2. Bổ Sung Các Mô Khối Cốt Lõi

| Mô Khối | Trạng Thái | File | Nội Dung Cường Hóa |
|:---|:---:|:---|:---|
| **Tạo Nhãn Dự Đoán** | ✅ Hoàn Thiện | `htyq-lite-tags.js` v2.1.0 | Mở rộng thư viện từ Thực Thể/Địa Điểm/Thế Lực; Trích xuất tên người động (6 mẫu câu như X nói/nói với X/gặp X v.v.); Sắp xếp độ ưu tiên chủ đề; Nhãn ưu tiên sự kiện khẩn cấp |
| **Kích Hoạt Tóm Tắt 3 Cấp** | ✅ Tự Động | `htyq-lite.js` | Tự động gộp tóm tắt Chương mỗi 10 vòng; Tự động gộp tóm tắt Quyển mỗi 50 vòng; Tích hợp trong `onMessageReceived` |
| **Cố Định Hóa Hệ Thống Cảm Xúc** | ✅ Cường Hóa | `htyq-lite-memory.js` + `htyq-lite-core.js` | Ánh xạ cấp độ cảm xúc (Người Lạ → Người Quen → Bạn Bè → Tri Kỷ → Sinh Tử Chi Giao); Phát hiện biến hóa cảm xúc; Đảo ngược Thân Thiện → Thù Địch tự động đưa vào Huyết Cừu; Bảo vệ giá trị rỗng |
| **Ép Buộc Kích Hoạt Chuỗi Sự Kiện** | ✅ Cường Hóa | `htyq-lite-evolution.js` v2.1.0 | Đếm ngược về 0 ép buộc bùng nổ; Cơ chế treo (suspendCondition/suspendReason/suspendRounds 3 vòng tự động khôi phục); Đánh dấu sắp bùng nổ |
| **Huyết Cừu Tự Động Truy Sát** | ✅ Cường Hóa | `htyq-lite-evolution.js` v2.1.0 | Chu kỳ truy sát xoay vòng 5-10 vòng; Tối đa 5 lần attackCount rồi kết liễu; Ghi chú ký ức truy sát lần thứ n; Huyết cừu vĩnh viễn không bị treo (Quy tắc cứng) |
| **Lệnh Slash** | ✅ Hoàn Thiện | `htyq-lite-slash.js` v2.1.0 | `/world` (status/evolve/toggle); `/memory` (recall/summarize/stats); `/htyq` (status/evolve/reload) tương thích ST mới và cũ |

---

## 3. Danh Sách Sửa Đổi File

| # | File | Thao Tác | Nội Dung Cốt Lõi |
|:---:|:---|:---:|:---|
| 1 | `htyq-lite.js` | 🔄 Viết Lại | Cấu trúc bơm (4 tầng dự phòng), Tải chậm, Đóng băng chat mới, Logic thiết lập lại |
| 2 | `htyq-lite-ui.js` | 🔄 Viết Lại | Đóng bằng ESC/Click ngoài/resize, resetUI(), Quản lý sự kiện toàn cục |
| 3 | `style.css` | 🔄 Viết Lại | Media query (480/768px), line-height, word-break, Xếp chữ danh sách |
| 4 | `htyq-lite-tags.js` | 🔄 Viết Lại | Cường hóa thư viện từ, Trích xuất động 6 mẫu câu, Sắp xếp ưu tiên, Gộp thực thể tùy chỉnh |
| 5 | `htyq-lite-core.js` | 🔄 Viết Lại | Phòng thủ ensureArrays, getEmotionSummary, cleanupState, Bảo vệ rỗng |
| 6 | `htyq-lite-evolution.js` | 🔄 Viết Lại | Ép buộc bùng nổ/treo chuỗi sự kiện, Huyết cừu xoay vòng 5-10 vòng, Lưu ngôn dị biến, Dọn dẹp định kỳ |
| 7 | `htyq-lite-memory.js` | 🔄 Viết Lại | Ánh xạ cấp độ cảm xúc, Phát hiện biến hóa cảm xúc, Đảo ngược thái độ → Huyết cừu, Cường hóa trọng số triệu hồi |
| 8 | `htyq-lite-slash.js` | 🔄 Viết Lại | 3 nhóm lệnh (/world /memory /htyq), Gợi ý cách dùng đầy đủ |

**Các File Chưa Sửa Đổi** (Chức năng đã hoàn chỉnh không cần sửa):
- `manifest.json` — Khai báo nội dung chính xác
- `htyq-lite-inject.js` — Cấu trúc nội dung bơm chính xác (Ký ức 3 tầng + Bảng điều khiển + Thế Giới Thư)
- `htyq-lite-worldbook.js` — Tải và khớp Thế Giới Thư chính xác
- `README.md` — Chỉ là chỗ đặt chỗ (placeholder)

---

## 4. Chi Tiết Kỹ Thuật

### Cấu Trúc Bơm (Sửa Lỗi Cốt Lõi Bug 4+5)

```
Cũ: addOneMessage → Tin nhắn hiển thị trong chat → Gây ô nhiễm lịch sử + Vòng lặp sự kiện
                                         ↓
Mới: registerInjection → Tầng ngữ cảnh prompt → Không hiển thị + Tự động kích hoạt mỗi lần tạo
    ↓ (dự phòng)
    setExtensionPrompt → mảng extensionPrompts
    ↓ (dự phòng)
    generateOpts.system_prompt
    ↓ (biện pháp cuối)
    addOneMessage (Có khóa chống lặp)
```

### Vòng Đời Bộ Lắng Nghe Làm Mới

```
showPanel()
  → addGlobalListeners()
     ├── keydown(ESC) → hidePanel()
     ├── mousedown(Click bên ngoài) → hidePanel()
     └── resize(Thay đổi cửa sổ) → Chống tràn màn hình

hidePanel() / resetUI()
  → removeGlobalListeners()
```

### Chuỗi Chuyển Hóa Cảm Xúc → Huyết Cừu

```
Đối thoại phát hiện "giết/cừu hận/bất cộng đái thiên"
  → extractEmotion() phán định thái độ là "Bất Cộng Đái Thiên"
  → So sánh thái độ cũ: Nếu từ Thân Thiện → Thù Địch
  → bloodFeudMemo.push({ faction, reason, status:"Đang truy tung" })
  → advanceBloodFeud() Mỗi 5-10 vòng kích hoạt truy sát
  → Sự kiện truy sát nhập vào kho ký ức (Độ quan trọng 5, vĩnh viễn không suy giảm)
```

---

## 5. So Sánh Trước Và Sau Sửa Lỗi

| Chỉ Tiêu | Trước Khi Sửa | Sau Khi Sửa |
|:---|:---:|:---:|
| Cách thức bơm | addOneMessage (Bơm tin nhắn) | registerInjection (Bơm prompt) |
| Tính hiển thị | Hiển thị tin nhắn hệ thống trong chat | Hoàn toàn ẩn |
| Rủi ro lặp tin nhắn | Cao | Không có (Không thao tác ở tầng chat) |
| Hành vi chat mới | Lập tức suy luận | Đóng băng chờ gửi lần đầu |
| Cách đóng bảng | Chỉ nút X | ESC / Click bên ngoài / Nút X |
| Tương thích điện thoại | Không có | Toàn màn hình + Viền dưới + Không che khung nhập |
| Khoảng cách dòng | 1.0 (Bị ép vào nhau) | 1.5-1.6 (Khoảng cách thoải mái) |
| Thiết lập lại khi chuyển chat | Không thiết lập lại | Thiết lập lại toàn bộ (UI + Bơm + Biến) |
| Cấp độ cảm xúc | 2 Cấp (Thân Thiện/Thù Địch) | 8 Cấp (Người Lạ → Tử Cừu, Có tự động chuyển hóa) |
| Huyết cừu truy sát | Chỉ ghi nhớ không thực thi | Xoay vòng 5-10 vòng, kết liễu sau 5 lần |
| Lệnh Slash | Không có | 3 nhóm lệnh, tương thích ST mới/cũ |
| Treo chuỗi sự kiện | Không hỗ trợ | Hỗ trợ (Nguyên nhân + Điều kiện + Tự động khôi phục) |

---

## 6. Hotfix v2.1.1 (2026-06-05 21:16)

| Lỗi | Sửa Lỗi |
|:---|:---|
| Cường Hóa Bug 1: Lời chào sân của nhân vật vẫn kích hoạt suy luận | `onMessageReceived` thêm điều kiện bảo vệ `chat.length <= 2`: Lời chào sân (1) và tin nhắn đầu của người dùng chưa được phản hồi (2) đều bỏ qua, đợi đến vòng tương tác hoàn chỉnh đầu tiên (≥3) mới khởi động suy luận |

**Vị Trí Code**: `htyq-lite.js` → Dòng 237 `onMessageReceived()`

**Báo Cáo Thẩm Định**: `REVIEW.md` — Agent phụ đã đọc qua toàn bộ 11 file nguồn
**Kết Luận Thẩm Định**: Sửa đổi chính xác ✅, Không có tác dụng phụ ✅, Có thể sử dụng trực tiếp ✅

---

## 7. Kiến Nghị Kế Tiếp

1. **Tối Ưu Đóng Gói**: Hiện tại 8 file JS tải động qua `<script>`, có vấn đề về điều kiện tranh chấp (race condition) và hao phí mạng. Kiến nghị sau này gộp thành một IIFE duy nhất hoặc dùng ESBuild/Rollup đóng gói.
2. **Bộ Đệm API Diễn Hóa**: Lệnh gọi `callEvolutionAPI` tốn kém, có thể cân nhắc ghi nhớ (đầu vào giống nhau thì bỏ qua).
3. **Lưu Trữ Kho Ký Ức**: localStorage lưu trữ 500 mục ký ức có thể vượt quá giới hạn 5MB, khi đạt 300+ mục kiến nghị nén lưu trữ hoặc dùng IndexedDB.
4. **Ca Kiểm Thử (Test Cases)**: Kiến nghị bổ sung dữ liệu mock để kiểm thử logic chuỗi sự kiện và chuỗi chuyển hóa cảm xúc.
---

*Sửa lỗi hoàn tất. Thắng Lợi.* 🧠✨

---

## 8. Báo Cáo Làm Mới UI v2.1.1 (2026-06-05 21:35)

**Mục Tiêu**: Làm mới bảng điều khiển UI, tham số hóa toàn bộ CSS (CSS variables) + Khả năng đóng bảng trên điện thoại

### style.css

| Thay Đổi | Giải Thích |
|:---|:---|
| `:root` Biến CSS | 14 biến ngữ nghĩa (--bg-primary, --accent, --card-radius, v.v.)|
| Thay thế code cứng | Toàn bộ mã màu/khoảng cách/bo góc chuyển sang dùng `var()` |
| Làm mịn font chữ | `html, body { -webkit-font-smoothing: antialiased }` |
| `.htyq-lite-drag-handle` | Thanh chỉ báo kéo trên cùng cho điện thoại |
| `.htyq-lite-handle-bar` | Vạch ngang màu xám ngắn |
| `.htyq-lite-panel-close-mobile` | Nút đóng cho điện thoại (Vị trí tuyệt đối bên phải drag-handle)|
| `.htyq-lite-btn-purple` | Biến thể màu tím cho nút suy luận thủ công |
| `.htyq-lite-btn-danger` | Biến thể màu đỏ cho nút thiết lập lại |
| `.htyq-lite-empty` | Chữ gợi ý trạng thái rỗng |
| `.htyq-memory-results` | Khung chứa kết quả ký ức |
| Tab điện thoại | `min-height: 44px; padding: 10px 0` |
| Padding điện thoại | Góc nhìn `12px 14px` (Gốc 8px)|
| Sticky tabs điện thoại | `position: sticky; top: 0` + nền làm mờ blur |
| `.htyq-lite-button` | Đã xóa (JS không sử dụng)|

### htyq-lite-ui.js

| Thay Đổi | Giải Thích |
|:---|:---|
| Phân nhánh `buildUI` điện thoại | Đổi thành `drag-handle + close-mobile`, xóa toàn bộ inline style |
| Gắn sự kiện nút đóng | Thêm gắn sự kiện `.htyq-lite-panel-close-mobile` |
| `renderOverview` nút suy luận thủ công | Xóa `style="background:#8b5cf6"` → Dùng `.htyq-lite-btn-purple` |
| Chống lặp suy luận thủ công | Trong lúc suy luận `disabled=true` + `textContent='⏳ Đang suy luận...'`, khôi phục sau khi xong |
| Khung chứa stats `renderSettings` | Xóa `<div>` nội tuyến dư thừa (Style đã do `.htyq-memory-stats` cung cấp)|
| Nút thiết lập lại | Xóa `style="background:#ef4444"` → Dùng `.htyq-lite-btn-danger` |
| Gợi ý trạng thái rỗng `renderMemory` | Xóa `style="color:#64748b; padding:8px"` → Dùng `.htyq-lite-empty` |

### Xác Thực

- ✅ `node -c htyq-lite-ui.js` — Không có lỗi cú pháp
- ✅ Toàn bộ JS className gọi class CSS đều đã được định nghĩa
- ✅ Đã loại bỏ code cứng color/background trong inline style
- ✅ `.htyq-lite-button` đã bị xóa khỏi quy tắc CSS (Chỉ còn chú thích nhắc tới)

---

*Làm mới UI hoàn tất.* 🎨✨

---

## 9. Cấu Trúc Nhãn 4 Tầng + Cải Tiến UI Desktop v2.2.0 (2026-06-05 21:45)

**Mục Tiêu**: Tái cấu trúc nhãn thành hệ thống 4 tầng + Cải tiến bảng điều khiển Desktop

### Phần A: Cấu Trúc Nhãn 4 Tầng

**File**: `htyq-lite-tags.js`

| Tầng | Hàm | Giải Thích |
|:---:|:---|:---|
| ① | `extractFromState` (Giữ nguyên) | Nhãn trạng thái bảng điều khiển: Chuỗi sự kiện/Thế lực/Huyết cừu/Danh vọng/Lưu ngôn |
| ② | `extractByAI` (Thêm mới async) | Gọi API diễn hóa để trích xuất ngữ nghĩa nhãn, system prompt độc lập |
| ③ | `extractFromChat` (Cải tạo) | Xóa thư viện từ code cứng, chuyển sang lấy từ tên Thế Giới Thư + Thực thể tùy chỉnh + Biểu thức chính quy |
| ④ | `generatePredictionTags` (Đổi async) | Chấm điểm, lọc trùng, gộp: Nhãn trạng thái 10 điểm > AI 5 điểm > Quy tắc 3 điểm, giới hạn 20 nhãn |

**File**: `htyq-lite.js`
- Thêm `await tagsGen.generatePredictionTags(chatHistory, state)` vào `beforeMessageSend`

**File**: `htyq-lite-evolution.js`
- Thêm `await` đồng bộ vào `callEvolutionAPI` để tương thích tạo nhãn bất đồng bộ

### Phần B: Cải Tiến UI Desktop

**File**: `style.css`

| Thay Đổi | Giải Thích |
|:---|:---|
| Kích thước bảng | `560px × 70vh`, `max-height: 800px`, `min-height: 400px` |
| Thoái hóa màn hình nhỏ | `@media (max-height: 700px)` → `height: 80vh` |
| Nền bán trong suốt Desktop | `background: rgba(15,23,42,0.95)` + `backdrop-filter: blur(8px)` |
| Phân cấp màu ký ức | `.htyq-lite-memory-imp-{5/4/3/1}` → Vàng/Tím/Xanh/Xám |
| Phân loại màu nhãn | `.htyq-tag-{entity/location/faction/topic/emotion/state}` |
| Xem trước nội dung bơm | `.htyq-injection-meta` / `.htyq-injection-preview-text` / `.htyq-injection-detail-toggle` |
| Thu gọn mở rộng | `.htyq-lite-card.collapsed` + `h4::before` Mũi tên(▼/▶) |

**File**: `htyq-lite-ui.js`

| Thay Đổi | Giải Thích |
|:---|:---|
| `renderOverview` | Thêm mới thẻ 🏷️ Nhãn hiện tại (Hiển thị nhãn màu) + thẻ 📝 Xem trước nội dung bơm (Vòng/Độ dài/Thời gian/Nhãn/Tóm tắt nội dung) |
| `renderMemory` | Thẻ ký ức dùng `getImportanceClass()` để thêm viền màu |
| Tương tác thu gọn | Trên Desktop bấm `.htyq-lite-card h4` sẽ chuyển class `.collapsed` |
| Hàm thêm mới | `getImportanceClass` / `renderTagsHtml` / `renderInjectionPreview` / `getTagType` (Dự phòng nội bộ) |

### Xác Thực ✅

| # | Điều Kiện | Trạng Thái |
|:---:|:---|:---:|
| 1 | `generatePredictionTags` là hàm async, chứa 4 tầng xử lý | ✅ |
| 2 | `beforeMessageSend` của `htyq-lite.js` dùng `await` | ✅ |
| 3 | `style.css` chứa nền bán trong suốt desktop + màu phân cấp ký ức + phong cách xem trước + nút thu gọn | ✅ |
| 4 | `renderOverview` chứa khu vực xem trước và khu vực hiển thị nhãn | ✅ |
| 5 | `renderMemory` dùng màu phân cấp quan trọng | ✅ |
| 6 | Tương tác thu gọn hoạt động trên desktop (Event delegation) | ✅ |
| 7 | FIX_LOG.md bổ sung ghi chú cập nhật | ✅ |

---

*Cấu trúc nhãn 4 tầng + Cải tiến UI Desktop hoàn tất.* 🏷️✨

---

## 10. Gộp 3 Thay Đổi Lớn v2.3.0 (2026-06-05 22:17)

**Mục Tiêu**: Làm mới UI phong cách Morandi + Hệ thống thời gian AI + Tab Cài Đặt Động Cơ

---

### Phần A: Làm Mới UI Phong Cách Morandi

**File**: `style.css`

| Thay Đổi | Giải Thích |
|:---|:---|
| Hệ thống màu biến CSS | Đổi toàn bộ sang hệ màu ấm Morandi: `--bg-primary: #1a1820`, `--bg-card: #252230`, `--accent: #c4a8a0` gồm 15 biến |
| Màu sắc nhãn | 6 loại nhãn đều chuyển sang màu Morandi (Hồng xám/Xanh xám/Vàng xám/Tím xám/Đỏ hồng xám/Xanh lá xám) |
| Hệ thống nút bấm | Thống nhất kiểu nút toàn cục (Nền `--bg-surface`, hover viền `--accent`) |
| Giao diện Tab Động Cơ | Thêm mới cụm giao diện bộ chọn chế độ vận hành/khối tham số/nút gỡ lỗi/trạng thái phong ấn/công tắc từ khóa |
| Mũi tên thu/mở | Theo dõi biến màu (`var(--text-muted)`) |
| Điện thoại di động | Dùng chung một bộ biến CSS với desktop, chỉ phân biệt media query cho kích thước/bố cục |

**File**: `htyq-lite-ui.js`

| Thay Đổi | Giải Thích |
|:---|:---|
| `buildUI` | Tab từ 4 mở rộng thành 5: Tổng Quan/Thế Giới/Ký Ức/Cài Đặt/**Động Cơ** |
| `renderOverview` | Thêm dải hiển thị thời gian thế giới phía trên (Có kèm dấu 🔒 phong ấn) |
| `renderEngine` | Thêm hàm mới, dựng 4 khối: Chế độ vận hành/Tham số thủ công/Trạng thái hiện tại/Công cụ gỡ lỗi |
| Chuyển đổi chế độ | Radio chuyển đổi qua lại, chế độ AI thì khu vực tham số thủ công làm mờ, công tắc từ khóa bị ẩn |
| Công cụ gỡ lỗi | 4 nút gỡ lỗi: Ép Hôm Nay/Ép 3 Ngày Sau/Thiết Lập Lại Thời Gian/Suy Luận Ngay Lập Tức |

### Phần B: Hệ Thống Thời Gian Bằng AI

**File**: `htyq-lite-time.js` (Thêm mới)

| Hàm | Giải Thích |
|:---:|:---|
| `calculateTimeIncrement` | Tính toán gia tăng thời gian thế giới theo chế độ. Chế độ AI lấy trung bình `timeEstimateMinutes` do AI trả về + `minutesPerRound`; Chế độ thủ công tùy vào từ khóa hoặc giá trị chuẩn |
| `formatWorldTime` | Định dạng số phút thành "Ngày thứ X - X giờ X phút" |
| `shouldTriggerEvents` | Kiểm tra điểm kích hoạt Sự kiện/Chương/Quyển theo giới hạn bộ số. Giới hạn: 60/480/4320/10080 phút |
| `detectTimeKeywords` | Regex khớp "3 ngày sau/hôm sau/hơn 1 tháng/chớp mắt", hỗ trợ dạng số + đơn vị (VD: "7 ngày sau") |

**File**: `htyq-lite-evolution.js`

| Thay Đổi | Giải Thích |
|:---|:---|
| Chỉ thị prompt | Thêm quy tắc số 8: Yêu cầu bắt buộc trường `timeEstimateMinutes` |
| Ví dụ JSON | Thêm `"timeEstimateMinutes": 15` vào ví dụ đầu ra |
| state.lastEvolveResult | Lưu đối tượng cập nhật gốc sau khi diễn hóa thành công (Chứa timeEstimateMinutes) |
| state.lastEvolveRound | Lưu vòng chat diễn hóa thành công |

**File**: `htyq-lite.js`

| Thay Đổi | Giải Thích |
|:---|:---|
| Mảng MODULES | Thêm `'htyq-lite-time.js'` (Nằm giữa evolution và slash) |
| `beforeMessageSend` | Kiểm tra chế độ vận hành: Chế độ thủ công sẽ kích hoạt suy luận theo khoảng cách vòng chat |
| `onMessageReceived` | Tích hợp thúc đẩy thời gian: Diễn hóa thành công → tính toán gia tăng → cộng dồn vào `inWorldMinutes` → kiểm tra `shouldTriggerEvents` kích hoạt tóm tắt |
| Kích hoạt tóm tắt | Đổi từ cố định số vòng (10/50) sang dựa trên thời gian, khi mô khối thời gian không dùng được thì lùi về tính vòng |

**File**: `htyq-lite-core.js`

| Thay Đổi | Giải Thích |
|:---|:---|
| `getDefaultState` | Thêm 4 trường mới: `inWorldMinutes: 0` / `lastTimeCheckRound: 0` / `lastEvolveRound: -1` / `driveMode: 'ai'` |
| `ensureArrays` | Bảo vệ tương thích trường mới |

### Phần C: Ma Trận Trạng Thái Chế Độ Vận Hành

| Chế Độ | Kích Hoạt Suy Luận | Nguồn Thời Gian | Hiển Thị Trên Bảng | Nhận Diện Từ Khóa |
|:---|:---|:---|:---:|:---:|
| **AI Vận Hành** | Mỗi vòng `onMessageReceived` | AI trả về + Chuẩn người dùng | ✅ Bình Thường | Tích hợp trong AI |
| **Thủ Công + Bật Từ Khóa** | Theo khoảng cách vòng `beforeMessageSend` | `minutesPerRound` + Thêm từ khóa | ✅ Hiển Thị (Kèm dấu hiệu) | ✅ Cộng thêm thời gian + Kích hoạt |
| **Thủ Công + Tắt Từ Khóa** | Theo khoảng cách vòng `beforeMessageSend` | Cố định `minutesPerRound` | 🔒 Icon Phong Ấn | ❌ |

### Xác Thực ✅

| # | Điều Kiện | Trạng Thái |
|:---:|:---|:---:|
| 1 | Toàn bộ màu `style.css` là hệ màu ấm Morandi, không có màu xanh lạnh `#0f172a` | ✅ |
| 2 | `buildUI` có 5 Tab (overview/world/memory/settings/engine) | ✅ |
| 3 | Hàm `renderEngine` dựng 4 khối | ✅ |
| 4 | Ở chế độ AI, khối tham số thủ công bị làm mờ/ẩn | ✅ |
| 5 | Ở chế độ Thủ công, biểu tượng 🔒 hiển thị tại vị trí thời gian | ✅ |
| 6 | Ở chế độ AI, checkbox công tắc từ khóa ẩn đi | ✅ |
| 7 | `htyq-lite-time.js` chứa 4 hàm | ✅ |
| 8 | `getDefaultState()` có 4 trường mới | ✅ |
| 9 | `manifest.json` cập nhật phiên bản | ✅ |
| 10 | Có sao lưu `.bak` trước khi sửa | ✅ |
| 11 | FIX_LOG.md có ghi chú bản cập nhật v2.3.0 | ✅ |
| 12 | Tổng thể không có lỗi cú pháp | ✅ |

---

*Gộp 3 Thay Đổi Lớn HTYQ Lite v2.3.0 Morandi hoàn tất.* 🎨⏱️⚙️✨
