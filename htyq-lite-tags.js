// htyq-lite-tags.js — Tạo nhãn dự đoán (Đường ống 4 lớp v2.2.0)
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.0
//   - Tăng cường chế độ phát hiện thực thể/địa điểm/thế lực
//   - Hỗ trợ trích xuất thực thể hoạt động từ kho ký ức
//   - Hỗ trợ tải động từ danh sách thực thể tùy chỉnh
//   - Hỗ trợ văn bản hỗn hợp tiếng Trung và tiếng Anh
//   - Thêm sắp xếp độ ưu tiên của chủ đề
// 2026-06-05 v2.2.0
//   - Kiến trúc đường ống 4 lớp:
//     ① Nhãn trạng thái bảng điều khiển (extractFromState, không đổi)
//     ② Trích xuất ngữ nghĩa AI (extractByAI, thêm mới)
//     ③ Quy tắc bù lấp chỗ trống (extractFromChat, cải tạo)
//     ④ Chấm điểm + Loại bỏ trùng lặp + Gộp (generatePredictionTags, đổi thành async)
//   - extractFromChat loại bỏ thư viện từ hardcode, dùng Thế Giới Thư + thực thể tùy chỉnh + Regex
//   - generatePredictionTags đổi thành async, dùng hệ thống chấm điểm
// ============================================================

window.HTYQ_LITE_TAGS = (function() {
  // Lấy danh sách thực thể tùy chỉnh (từ Cài đặt)
  function getCustomEntities() {
    try {
      const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
      const customEntitiesStr = settings.customEntities || '';
      if (customEntitiesStr) {
        return customEntitiesStr.split(/[,，、]/).map(s => s.trim()).filter(s => s.length >= 2);
      }
    } catch(e) {}
    return [];
  }

  // ========== Lớp ③: Quy tắc bù lấp (Bản cải tạo) ==========
  // Trích xuất nhãn từ lịch sử chat (Dùng Thế Giới Thư + Thực thể tùy chỉnh + Regex, loại bỏ thư viện từ hardcode)
  function extractFromChat(chatHistory, state, maxLen = 5) {
    const entities = new Set();
    const locations = new Set();
    const factions = new Set();
    const topics = new Set();
    const emotions = new Set();

    const recent = chatHistory.slice(-maxLen);
    const text = recent.map(msg => (msg.mes || msg.content || '')).join(' ');

    // --- 1. Bổ sung từ tên Thế Giới Thư ---
    const worldbook = window.HTYQ_LITE_WORLDBOOK;
    if (worldbook && worldbook.getCache) {
      const cache = worldbook.getCache();
      if (Array.isArray(cache)) {
        for (const entry of cache) {
          // entry.tags là từ khóa kích hoạt mục Thế Giới Thư (thực thể/tên/khái niệm)
          if (entry.tags && Array.isArray(entry.tags)) {
            for (const tag of entry.tags) {
              const t = tag.trim();
              if (t.length >= 2 && text.includes(t)) {
                entities.add(t);
              }
            }
          }
        }
      }
    }

    // --- 2. Thực thể tùy chỉnh ---
    const customEntities = getCustomEntities();
    for (const ce of customEntities) {
      if (text.includes(ce)) {
        entities.add(ce);
      }
    }

    // --- 3. Bắt động tên nhân vật: X nói / Nói với X / X biểu thị ... ---
    const namePatterns = [
      /[""「『]([\u4e00-\u9fa5]{2,4})[""」』]/gu,                     // Mẫu "Trương Tam" nói
      /([\u4e00-\u9fa5]{2,4})\s*(?:nói|đạo|kể|hỏi|đáp|hét|gọi|mắng|khóc|cười|giận|than)/gu,  // Mẫu Trương Tam nói
      /(?:đối với|hướng|cùng|với|tới)\s*([\u4e00-\u9fa5]{2,4})\s*(?:nói|đạo|kể|hỏi)/gu,       // Mẫu Nói với Trương Tam
      /(?:đem|bị|để|cho|vì)\s*([\u4e00-\u9fa5]{2,4})/gu,                    // Đem Trương Tam/Bị Trương Tam
      /(?:chỉ thấy|chợt thấy|lại thấy|nhìn thấy|thấy được|thấy)\s*([\u4e00-\u9fa5]{2,4})/gu,          // Thấy Trương Tam
    ];

    const blacklist = new Set([
      'gì','thế nào','cái này','cái kia','không có','có thể','biết','nhưng mà','bởi vì',
      'cho nên','đã','hay là','hoặc là','và','một cái','chính là','không phải','nếu như',
      'mặc dù','sau đó','hơn nữa','có điều','chỉ là','có lẽ','nên','đừng','bọn họ',
      'các ngươi','chúng ta','mọi người','bản thân','thời điểm','chỗ','thứ','chuyện','dáng vẻ'
    ]);

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1];
        if (name.length >= 2 && !blacklist.has(name)) {
          entities.add(name);
        }
      }
    }

    // --- 4. Bắt động địa điểm: ở/đi/đến/về/tới + tên địa danh ---
    const locPattern = /(?:ở|đi|đến|về|tới|tiến về|đi vào|rời khỏi|nằm ở|đạt tới)\s*([\u4e00-\u9fa5]{2,4})/gu;
    const locBlacklist = new Set(['gì','thế nào','cái này','cái kia','không có','có thể','chỗ nào','nơi đó']);
    while ((match = locPattern.exec(text)) !== null) {
      const loc = match[1];
      if (!locBlacklist.has(loc) && loc.length >= 2) {
        locations.add(loc);
      }
    }

    // --- 5. Ánh xạ từ vựng cảm xúc ---
    const emotionKeywords = {
      'Ấm Áp': ['ấm áp','ôn hinh','cảm động','vui mừng','hạnh phúc','ngọt ngào'],
      'Căng Thẳng': ['căng thẳng','áp bách','nguy cấp','khẩn cấp','kiếm bạt nỗ trương'],
      'Bi Thương': ['bi thương','ai thương','bi thống','thê thảm','tuyệt vọng','rơi lệ'],
      'Phẫn Nộ': ['phẫn nộ','nộ hỏa','bạo nộ','phẫn hận','nộ khí trùng thiên'],
      'Sợ Hãi': ['sợ hãi','khủng cụ','kinh sợ','hoảng loạn','run rẩy'],
      'Vui Vẻ': ['vui vẻ','hoan hỉ','khai tâm','cao hứng','du khoái','hoan tiếu'],
      'Thần Bí': ['thần bí','quỷ dị','kỳ quái','cổ quái','kỳ kiều','khả nghi'],
      'Lãng Mạn': ['lãng mạn','ái ý','ái muội','nhu tình','tâm động']
    };
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          emotions.add(emotion);
          break;
        }
      }
    }

    // --- 6. Ánh xạ từ vựng chủ đề ---
    const topicKeywords = {
      'Chiến Đấu': ['chiến đấu','đánh nhau','chéo giết','đối quyết','giao chiến','tỷ võ','đơn đả'],
      'Âm Mưu': ['âm mưu','quỷ kế','cạm bẫy','tính toán','vòng vây','ám toán'],
      'Giao Dịch': ['giao dịch','mua bán','thương gia','thu mua','trao đổi','mặc cả'],
      'Chạy Trốn': ['chạy trốn','đào tẩu','đào mệnh','chạy thoát','truy sát','truy bắt'],
      'Điều Tra': ['điều tra','trinh sát','thám thính','nghe ngóng','tra xét','ám phỏng'],
      'Đàm Phán': ['đàm phán','thương nghị','hiệp thương','giao thiệp','ước định'],
      'Giải Cứu': ['giải cứu','doanh cứu','cứu viện','cứu xuất'],
      'Bái Sư': ['bái sư','thu đồ','đồ đệ','sư phụ','học nghệ'],
      'Tầm Bảo': ['tầm bảo','bảo tàng','bảo vật','bí tịch','thần binh'],
      'Phục Cừu': ['phục cừu','báo thù','báo phục','ân oán','huyết cừu']
    };
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          topics.add(topic);
          break;
        }
      }
    }

    // --- 7. Ánh xạ từ vựng thế lực ---
    const factionKeywords = {
      'Huyết Đao Môn': ['huyết đao','Huyết Đao Môn','Huyết Đao Lão Tổ'],
      'Thiên Cơ Các': ['thiên cơ','Thiên Cơ Các'],
      'Thục Sơn Phái': ['thục sơn','Thục Sơn Phái'],
      'Cái Bang': ['Cái Bang','khất cái','đả cẩu bổng'],
      'Thiếu Lâm': ['thiếu lâm','Thiếu Lâm Tự','hòa thượng'],
      'Võ Đang': ['võ đang','Võ Đang Phái'],
      'Minh Giáo': ['minh giáo','Minh Giáo giáo chúng'],
      'Quan Phủ': ['quan phủ','triều đình','quan binh','nha môn','bổ khoái'],
    };
    for (const [faction, keywords] of Object.entries(factionKeywords)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          factions.add(faction);
          break;
        }
      }
    }

    // Trả về kết quả phân loại (Set chuyển sang Array)
    return {
      entities: Array.from(entities),
      locations: Array.from(locations),
      factions: Array.from(factions),
      topics: Array.from(topics),
      emotions: Array.from(emotions)
    };
  }

  // ========== Lớp ①: Nhãn trạng thái bảng điều khiển (không đổi) ==========
  function extractFromState(state) {
    const tags = [];

    // Chuỗi sự kiện
    for (const ev of state.events || []) {
      const remaining = ev.totalRounds - ev.currentRound;
      if (remaining <= 0) tags.push(`event_immediate:${ev.name}`);
      else if (remaining <= 2) tags.push(`event_critical:${ev.name}`);
      else tags.push(`event:${ev.name}`);
      // Nếu có sự kiện bùng nổ, tự động thêm nhãn chủ đề
      if (ev.stage === 'Đã Bùng Nổ') tags.push('topic:event_erupted');
    }

    // Thế lực
    for (const f of state.factions || []) {
      tags.push(`faction:${f.name}`);
      if (f.attentionToUser === 'Bài Xích' || f.attentionToUser === 'Lôi Kéo') {
        tags.push(`faction_active:${f.name}`);
      }
    }

    // Huyết cừu
    if (state.bloodFeudMemo && state.bloodFeudMemo.length > 0) {
      tags.push('topic:revenge');
      let hasActive = false;
      for (const bf of state.bloodFeudMemo) {
        tags.push(`bloodfeud:${bf.faction}`);
        if (bf.status === 'Đang truy sát') {
          hasActive = true;
          tags.push(`bloodfeud_active:${bf.faction}`);
        }
      }
      if (hasActive) tags.push('bloodfeud_active');
    }

    // Thay đổi danh vọng
    if (state.reputation) {
      if (state.reputation.jianghu !== 'Vô danh') tags.push('topic:reputation');
      if (state.reputation.official !== 'Vô danh') tags.push('topic:official_reputation');
      if (state.reputation.underworld !== 'Vô danh') tags.push('topic:underworld_reputation');
    }

    // Lưu ngôn
    if (state.rumors && state.rumors.length > 0) {
      tags.push('topic:rumor');
      // Trích xuất nội dung lưu ngôn độ hot cao thành nhãn
      const hotRumors = state.rumors.filter(r => (r.heatLevel || r.heat || 'Trung') === 'Nóng');
      for (const r of hotRumors.slice(0, 3)) {
        // Trích xuất từ khóa thực thể trong lưu ngôn
        const words = r.content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
        for (const w of words.slice(0, 3)) {
          if (w.length >= 2) tags.push(`rumor:${w}`);
        }
      }
    }

    // Chuỗi nhân quả
    if (state.causalChain && state.causalChain.length > 0) {
      tags.push('topic:causality');
    }

    // Sự kiện kinh tế
    if (state.economy && (state.economy.fundsStatus !== 'Eo hẹp' || (state.economy.keyResources || []).length > 0)) {
      tags.push('topic:economy');
    }

    // Trích xuất NPC hoạt động từ bản đồ cảm xúc
    if (state.emotionMap) {
      const activeNpcs = Object.entries(state.emotionMap)
        .filter(([_, e]) => e.attitude === 'Thù Địch' || e.attitude === 'Tín Nhiệm' || e.attitude === 'Thân Thiện')
        .slice(0, 5)
        .map(([name]) => name);
      for (const npc of activeNpcs) {
        tags.push(npc);
      }
    }

    return tags;
  }

  // ========== Lớp ②: Trích xuất ngữ nghĩa AI (thêm mới) ==========
  async function extractByAI(chatHistory, state) {
    const evolution = window.HTYQ_LITE_EVOLUTION;
    if (!evolution || typeof evolution.callApi !== 'function') {
      console.warn('[HTYQ Tags] Mô khối tiến hóa không khả dụng, bỏ qua trích xuất nhãn AI');
      return null;
    }

    // Lấy 10 vòng đối thoại gần nhất làm ngữ cảnh
    const recent = chatHistory.slice(-10);
    const conversationText = recent.map(msg => {
      const name = msg.name || (msg.is_user ? 'Người Dùng' : (msg.is_system ? 'Hệ Thống' : 'AI'));
      return `${name}: ${(msg.mes || msg.content || '').substring(0, 300)}`;
    }).join('\n');

    if (!conversationText.trim()) return null;

    const systemPrompt = `Bạn là một chuyên gia trích xuất nhãn. Dựa vào nội dung đối thoại, trích xuất các thông tin quan trọng đã xuất hiện.

Xuất ra mảng JSON, mỗi phần tử là chuỗi, yêu cầu:
1. Tên thực thể (tên người, tên địa danh, tên thế lực, tên vật phẩm) xuất trực tiếp tên
2. Tên địa danh thêm tiền tố "location:", ví dụ "location:Thục Sơn"
3. Tên thế lực thêm tiền tố "faction:", ví dụ "faction:Thục Sơn Phái"
4. Chủ đề cốt lõi thêm tiền tố "topic:", ví dụ "topic:Bái Sư"
5. Bầu không khí cảm xúc hiện tại thêm tiền tố "emotion:", ví dụ "emotion:Ấm Áp"
6. Không xuất ra văn bản khác, chỉ xuất mảng JSON

Ví dụ:
["Lâm Nguyệt Như", "location:Thục Sơn", "faction:Thục Sơn Phái", "topic:Tu Hành", "emotion:Ấm Áp"]`;

    const userMessages = `## Nội dung đối thoại\n${conversationText}\n\n## Đầu ra\nVui lòng dựa vào đối thoại trên xuất ra mảng JSON nhãn, không thêm chữ nào khác.`;

    const result = await evolution.callApi(systemPrompt + '\n\n' + userMessages, 500, 0.3);

    // Phân tích JSON
    try {
      const cleaned = result.trim()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter(t => typeof t === 'string' && t.length >= 2);
      }
      // Thử trích xuất mảng JSON từ văn bản lớn
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        const extracted = JSON.parse(match[0]);
        if (Array.isArray(extracted)) {
          return extracted.filter(t => typeof t === 'string' && t.length >= 2);
        }
      }
    } catch(e) {
      console.warn('[HTYQ Tags] Phân tích nhãn AI thất bại', e.message);
    }
    return null;
  }

  // ========== Hàm chấm điểm ==========
  function scoreTag(tag) {
    if (tag.startsWith('event_immediate:')) return 10;
    if (tag.startsWith('event_critical:')) return 9;
    if (tag.startsWith('bloodfeud_active')) return 9;
    if (tag.startsWith('bloodfeud:')) return 8;
    if (tag.startsWith('faction_active:')) return 8;
    if (tag.startsWith('faction:')) return 7;
    if (tag.startsWith('event:')) return 7;
    if (tag.startsWith('location:')) return 6;
    // Thực thể (không có tiền tố) → Điểm cao
    if (!tag.includes(':')) return 6;
    if (tag.startsWith('rumor:')) return 5;
    if (tag.startsWith('topic:')) return 4;
    if (tag.startsWith('emotion:')) return 3;
    return 2;
  }

  // Phán đoán loại nhãn (dùng để hiển thị UI)
  function getTagType(tag) {
    if (tag.startsWith('location:')) return 'location';
    if (tag.startsWith('faction:')) return 'faction';
    if (tag.startsWith('bloodfeud')) return 'state';
    if (tag.startsWith('event_')) return 'state';
    if (tag.startsWith('event:')) return 'state';
    if (tag.startsWith('topic:')) return 'topic';
    if (tag.startsWith('emotion:')) return 'emotion';
    if (tag.startsWith('rumor:')) return 'topic';
    if (tag.startsWith('faction_active')) return 'faction';
    if (tag.startsWith('bloodfeud_active')) return 'state';
    return 'entity';
  }

  // Gộp thực thể tùy chỉnh
  function mergeCustomEntities(tags) {
    const customs = getCustomEntities();
    for (const ce of customs) {
      if (!tags.includes(ce)) tags.push(ce);
    }
    return tags;
  }

  // ========== Lớp ④: Chấm điểm + Loại bỏ trùng lặp + Gộp (đổi thành async) ==========
  async function generatePredictionTags(chatHistory, worldState) {
    // Lớp ②: Trích xuất AI (bất đồng bộ)
    let aiResult = null;
    try {
      aiResult = await extractByAI(chatHistory, worldState);
    } catch(e) {
      console.warn('[HTYQ Tags] Trích xuất nhãn AI thất bại, hạ cấp xuống quy tắc', e.message);
    }

    // Lớp ① + Lớp ③: Trạng thái + Quy tắc
    const stateTags = extractFromState(worldState);
    const ruleTags = extractFromChat(chatHistory, worldState);

    // Chuyển đổi nhãn quy tắc thành chuỗi có tiền tố
    const ruleTagStrings = [];
    for (const entity of ruleTags.entities) ruleTagStrings.push(entity);
    for (const loc of ruleTags.locations) ruleTagStrings.push(`location:${loc}`);
    for (const faction of ruleTags.factions) ruleTagStrings.push(`faction:${faction}`);
    for (const topic of ruleTags.topics) ruleTagStrings.push(`topic:${topic}`);
    for (const emotion of ruleTags.emotions) ruleTagStrings.push(`emotion:${emotion}`);

    // Dùng Map loại bỏ trùng lặp, ưu tiên giữ điểm cao
    const tagMap = new Map();

    // Lớp ①: Nhãn trạng thái (độ ưu tiên cao nhất) đưa trực tiếp vào chấm điểm
    for (const tag of stateTags) {
      const existing = tagMap.get(tag);
      if (!existing || scoreTag(tag) > existing.score) {
        tagMap.set(tag, {
          tag: tag,
          score: scoreTag(tag),
          source: 'state'
        });
      }
    }

    // Lớp ②: Nhãn AI (độ ưu tiên thứ hai)
    if (aiResult && Array.isArray(aiResult)) {
      for (const tag of aiResult) {
        const s = scoreTag(tag);
        const existing = tagMap.get(tag);
        if (!existing || s > existing.score) {
          tagMap.set(tag, {
            tag: tag,
            score: Math.max(s, 5),  // Nhãn AI giữ đáy 5 điểm
            source: 'ai'
          });
        }
      }
    }

    // Lớp ③: Nhãn quy tắc (độ ưu tiên thứ ba)
    for (const tag of ruleTagStrings) {
      const s = scoreTag(tag);
      const existing = tagMap.get(tag);
      if (!existing || s > existing.score) {
        tagMap.set(tag, {
          tag: tag,
          score: s,
          source: 'rule'
        });
      }
    }

    // Sắp xếp giảm dần theo điểm
    const sorted = Array.from(tagMap.values()).sort((a, b) => b.score - a.score);

    // Lấy 20 nhãn đầu, nhưng đảm bảo giữ lại sự kiện khẩn cấp và huyết cừu
    const urgent = sorted.filter(t =>
      t.tag.startsWith('event_immediate:') ||
      t.tag.startsWith('event_critical:') ||
      t.tag.startsWith('bloodfeud_active')
    );
    const nonUrgent = sorted.filter(t => !urgent.includes(t));
    let combined = [...urgent, ...nonUrgent].slice(0, 20);

    // Trích xuất danh sách tên nhãn
    let finalTags = combined.map(t => t.tag);

    // Gộp thực thể tùy chỉnh (đảm bảo xuất hiện 100%)
    finalTags = mergeCustomEntities(finalTags);

    // Loại bỏ trùng lặp lần cuối
    finalTags = [...new Set(finalTags)];

    // Đảm bảo giới hạn 20 nhãn, ưu tiên giữ sự kiện khẩn cấp
    const urgentFinal = finalTags.filter(t =>
      t.startsWith('event_immediate:') ||
      t.startsWith('event_critical:') ||
      t.startsWith('bloodfeud_active')
    );
    const restFinal = finalTags.filter(t => !urgentFinal.includes(t));
    finalTags = [...urgentFinal, ...restFinal].slice(0, 20);

    console.log(`[HTYQ Tags] Nhãn dự đoán (${finalTags.length} nhãn):`, finalTags);
    return finalTags;
  }

  // Xuất ra getTagType để hiển thị UI
  return {
    generatePredictionTags,
    getTagType
  };
})();
