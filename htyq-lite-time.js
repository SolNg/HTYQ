// htyq-lite-time.js — Mô khối động cơ thời gian v2.3.0
// ============================================================
// Cung cấp tính toán gia tăng thời gian thế giới, định dạng, kiểm tra ngưỡng, khớp từ khóa
// ============================================================

window.HTYQ_LITE_TIME = (function() {

  // ---------- Trích xuất ước tính thời gian AI ----------
  function getAiTimeEstimate(evolveResult) {
    if (!evolveResult || typeof evolveResult !== 'object') return null;
    if (typeof evolveResult.timeEstimateMinutes === 'number' && !isNaN(evolveResult.timeEstimateMinutes)) {
      return Math.max(0, Math.round(evolveResult.timeEstimateMinutes));
    }
    return null;
  }

  // ---------- Nhận diện từ khóa thông minh (công tắc ở chế độ thủ công) ----------
  function detectTimeKeywords(text) {
    if (!text || typeof text !== 'string') return 0;

    const patterns = [
      // Thời gian cực ngắn
      { regex: /(?:chốc lát|khoảnh khắc|tức thì|nháy mắt|chớp mắt|thoáng chốc|thoáng qua)/gi, minutes: 2 },
      { regex: /(?:tức khắc|trong phút chốc)/gi, minutes: 1 },
      // 1 khắc / nửa canh giờ / 1 canh giờ
      { regex: /một khắc|1 khắc/gi, minutes: 15 },
      { regex: /nửa canh giờ/gi, minutes: 30 },
      { regex: /(?:một|1)?\s?canh giờ/gi, minutes: 60 },
      // nửa ngày / hơn nửa ngày / gần nửa ngày
      { regex: /(?:nửa ngày|nửa buổi)/gi, minutes: 360 },
      // 1 ngày / cả ngày / cả đêm
      { regex: /(?:một|1|cả|trọn)\s?(?:ngày|đêm)/gi, minutes: 1440 },
      // hôm sau / ngày mai / ngày hôm sau / sáng hôm sau
      { regex: /(?:hôm sau|ngày mai|ngày hôm sau|hôm kia|ngày kia)/gi, minutes: 1440 },
      // vài ngày sau / vài ngày
      { regex: /(?:vài ngày(?:\s?sau)?)/gi, minutes: 4320 },
      // mấy ngày sau
      { regex: /mấy\s?(?:ngày|hôm)(?:\s?(?:sau|nữa))?/gi, minutes: 4320 },
      // 3 ngày sau / 3 ngày
      { regex: /(?:ba|3)\s?(?:ngày|hôm)(?:\s?(?:sau|nữa))?/gi, minutes: 4320 },
      // 5 ngày sau / 5 ngày
      { regex: /(?:năm|5)\s?(?:ngày|hôm)(?:\s?(?:sau|nữa))?/gi, minutes: 7200 },
      // 7 ngày sau / 7 ngày
      { regex: /(?:bảy|7)\s?(?:ngày|hôm)(?:\s?(?:sau|nữa))?/gi, minutes: 10080 },
      // 10 ngày sau / 10 ngày
      { regex: /(?:mười|10)\s?(?:ngày|hôm)(?:\s?(?:sau|nữa))?/gi, minutes: 14400 },
      // nửa tháng
      { regex: /nửa\s?tháng/gi, minutes: 21600 },
      // hơn tháng / 1 tháng
      { regex: /(?:hơn tháng|một tháng|1 tháng)/gi, minutes: 43200 },
      // vài tháng / mấy tháng
      { regex: /(?:vài tháng|mấy tháng)/gi, minutes: 129600 },
      // chớp mắt / chớp mắt một cái
      { regex: /thoáng cái|chớp mắt(?: một cái)?/gi, minutes: 5 },
      // lúc này / giờ phút này (không có thời gian trôi)
      { regex: /(?:lúc này|giờ phút này|giờ khắc này|hiện tại)/gi, minutes: 0 },
    ];

    let totalMinutes = 0;
    for (const p of patterns) {
      if (p.regex.test(text)) {
        totalMinutes += p.minutes;
      }
    }

    // Tìm kiếm mẫu số + ngày/tháng (ví dụ "7 ngày sau", "12 ngày sau")
    const numDayPattern = /(\d+)\s*(?:ngày|hôm)(?:\s?(?:sau|nữa))/gi;
    let numMatch;
    while ((numMatch = numDayPattern.exec(text)) !== null) {
      const days = parseInt(numMatch[1], 10);
      if (!isNaN(days) && days > 0 && days <= 365) {
        totalMinutes += days * 1440;
      }
    }

    const numMonthPattern = /(\d+)\s*tháng(?:\s?(?:sau|nữa))/gi;
    while ((numMonthMatch = numMonthPattern.exec(text)) !== null) {
      const months = parseInt(numMonthMatch[1], 10);
      if (!isNaN(months) && months > 0 && months <= 12) {
        totalMinutes += months * 43200;
      }
    }

    return totalMinutes;
  }

  // ---------- Tính toán gia tăng thời gian thế giới vòng này ----------
  function calculateTimeIncrement(evolveResult, chatText, settings) {
    const driveMode = settings.driveMode || 'ai';
    const minutesPerRound = parseInt(settings.minutesPerRound, 10) || 2;
    const smartKeywords = settings.smartKeywords !== false;
    const MIN_KEYWORD = 1;  // Từ khóa đóng góp ít nhất 1 phút (chống bằng 0)

    if (driveMode === 'ai') {
      // Chế độ AI: Lấy ước tính thời gian AI trả về
      const aiEstimate = getAiTimeEstimate(evolveResult);
      if (aiEstimate !== null && aiEstimate > 0) {
        // Lấy trung bình với minutesPerRound do người dùng đặt, tránh việc AI luôn đưa ra giá trị cực nhỏ
        return Math.max(1, Math.round((aiEstimate + minutesPerRound) / 2));
      }
      // AI không trả về thời gian, dùng giá trị chuẩn
      return minutesPerRound;
    }

    // Chế độ thủ công
    if (smartKeywords) {
      const kwMinutes = detectTimeKeywords(chatText || '');
      if (kwMinutes > 0) {
        // Thời gian khớp từ khóa + phút chuẩn lấy trung bình
        return Math.max(MIN_KEYWORD, Math.round((kwMinutes + minutesPerRound) / 2));
      }
    }
    return minutesPerRound;
  }

  // ---------- Định dạng thời gian thành chuỗi dễ đọc ----------
  function formatWorldTime(totalMinutes) {
    if (totalMinutes === 0) return 'Ngày thứ 0 - 0 Giờ';
    if (totalMinutes < 0) return 'Thời gian hỗn loạn';

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;

    let result = `Ngày thứ ${days}`;
    if (hours > 0) result += ` - ${hours} Giờ`;
    if (mins > 0 && hours === 0) result += ` - ${mins} Phút`;
    return result;
  }

  // ---------- Kiểm tra xem có kích hoạt chuỗi sự kiện/tóm tắt không ----------
  function shouldTriggerEvents(oldMinutes, newMinutes) {
    const thresholds = [
      // Ngưỡng tiến triển chuỗi sự kiện (mỗi 1 giờ thế giới)
      { key: 'events', value: 60 },
      // Ngưỡng tóm tắt chương (mỗi 8 giờ thế giới ≈ nửa ngày)
      { key: 'chapter', value: 480 },
      // Ngưỡng tóm tắt quyển (mỗi 3 ngày thế giới)
      { key: 'volume', value: 4320 },
      // Ngưỡng sự kiện trọng đại (mỗi 7 ngày)
      { key: 'major', value: 10080 },
    ];

    const triggered = [];
    for (const t of thresholds) {
      // Kiểm tra oldMinutes dưới ngưỡng và newMinutes đạt hoặc vượt ngưỡng
      // Đồng thời sửa lỗi phát hiện bội số: Nếu trong cùng một khoảng ngưỡng mà vượt qua bội số (ví dụ 120 < 1440 < 2880)
      const oldBlock = Math.floor(oldMinutes / t.value);
      const newBlock = Math.floor(newMinutes / t.value);
      if (newBlock > oldBlock) {
        triggered.push(t.key);
      }
    }

    return triggered;
  }

  return {
    calculateTimeIncrement,
    formatWorldTime,
    shouldTriggerEvents,
    detectTimeKeywords
  };
})();
