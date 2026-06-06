// htyq-lite-memory.js — Trích xuất ký ức, lưu trữ, tóm tắt 3 lớp, triệu hồi, cảm xúc
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.0
//   - Tăng cường hệ thống cảm xúc: hỗ trợ nhiều cấp độ thái độ cảm xúc hơn (Hữu Hảo→Thân Thiết→Tín Nhiệm→Chí Giao)
//   - Phát hiện thay đổi cảm xúc: so sánh thái độ cũ, ghi lại nguyên nhân thay đổi
//   - Tăng cường lưu trữ cảm xúc bền vững: gọi updateEmotion hoàn thiện hơn
//   - Tối ưu lưu trữ chi tiết ký ức: không còn cắt văn bản gốc làm summary, sử dụng tóm tắt AI
//   - Sửa lỗi shouldStore đánh giá sai số lượng chữ
//   - Thêm nhật ký thay đổi cảm xúc để tiện truy xuất
// ============================================================

window.HTYQ_LITE_MEMORY = (function() {
  const core = window.HTYQ_LITE_CORE;

  let callApiFn = null;
  function getCallApi() {
    if (!callApiFn && window.HTYQ_LITE_EVOLUTION && window.HTYQ_LITE_EVOLUTION.callApi) {
      callApiFn = window.HTYQ_LITE_EVOLUTION.callApi;
    }
    return callApiFn;
  }

  // ========== Thực thể tùy chỉnh ==========
  function getCustomEntities() {
    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    const customEntitiesStr = settings.customEntities || '';
    if (customEntitiesStr) {
      return customEntitiesStr.split(/[,，、]/).map(s => s.trim()).filter(s => s.length >= 2);
    }
    return [];
  }

  // ========== Bảng ánh xạ cấp độ cảm xúc ==========
  const EMOTION_LEVEL_MAP = [
    { fromAttitude: 'Trung Lập',   minCount: 1, toLevel: 'Người Quen' },
    { fromAttitude: 'Thân Thiện',   minCount: 1, toLevel: 'Bằng Hữu' },
    { fromAttitude: 'Tín Nhiệm',   minCount: 2, toLevel: 'Chí Giao' },
    { fromAttitude: 'Hữu Hảo',   minCount: 1, toLevel: 'Bằng Hữu' },
    { fromAttitude: 'Thù Địch',   minCount: 1, toLevel: 'Kẻ Thù' },
    { fromAttitude: 'Cảnh Giác',   minCount: 1, toLevel: 'Đối Tượng Khả Nghi' },
    { fromAttitude: 'Bất Cộng Đái Thiên', minCount: 1, toLevel: 'Tử Cừu' },
  ];

  function determineLevel(attitude, currentLevel) {
    // Nâng/hạ cấp dựa trên cấp độ hiện tại
    const levelHierarchy = ['Người Lạ', 'Người Quen', 'Bằng Hữu', 'Chí Giao', 'Sinh Tử Chi Giao'];
    const negativeHierarchy = ['Người Lạ', 'Đối Tượng Khả Nghi', 'Kẻ Thù', 'Tử Cừu'];
    if (attitude === 'Địch Đối' || attitude === 'Thù Địch') {
      return 'Kẻ Thù';
    }
    if (attitude === 'Bất Cộng Đái Thiên') {
      return 'Tử Cừu';
    }
    if (attitude === 'Tín Nhiệm') {
      const idx = levelHierarchy.indexOf(currentLevel);
      if (idx < 3) return levelHierarchy[idx + 1] || 'Chí Giao';
      return currentLevel;
    }
    if (attitude === 'Thân Thiện' || attitude === 'Hữu Hảo') {
      const idx = levelHierarchy.indexOf(currentLevel);
      if (idx < 2) return levelHierarchy[idx + 1] || 'Bằng Hữu';
      return currentLevel;
    }
    return currentLevel || 'Người Lạ';
  }

  // ========== Tóm tắt thông minh + Tạo nhãn ==========
  async function generateSmartSummaryWithTags(userMsg, aiMsg, round, locationHint = null) {
    const callApi = getCallApi();
    if (!callApi) {
      console.warn('[HTYQ] Không thể lấy callApi, tóm tắt thông minh không khả dụng');
      return null;
    }

    const locationText = locationHint ? `Địa điểm hiện tại: ${locationHint}\n` : '';
    const prompt = `Bạn là một nhân viên ghi chép cốt truyện khách quan và chuyên gia trích xuất nhãn. Vui lòng dựa vào đối thoại dưới đây, hoàn thành hai nhiệm vụ:
1. Dùng khoảng 150 chữ tóm tắt cốt truyện vòng này (chỉ trần thuật sự thật khách quan, không đánh giá).
2. Trích xuất toàn bộ nhãn quan trọng xuất hiện trong đối thoại, điền theo thể loại.

Vòng thứ: Vòng ${round}
${locationText}
Tin nhắn người dùng: ${userMsg.substring(0, 600)}
AI hồi đáp: ${aiMsg.substring(0, 600)}

Vui lòng xuất ra nghiêm ngặt theo định dạng JSON dưới đây, không bao gồm bất kỳ chữ nào khác:
{
  "summary": "Nội dung tóm tắt của bạn...",
  "tags": {
    "entities": ["tên thực thể 1", "tên thực thể 2"],
    "locations": ["địa điểm 1"],
    "factions": ["thế lực 1"],
    "topics": ["chủ đề 1", "chủ đề 2"],
    "emotions": ["cảm xúc 1"]
  }
}

Chú ý:
- entities: tên người, tên quái vật, tên vật phẩm đặc thù v.v. các cá thể cụ thể.
- locations: địa điểm cụ thể (thành thị, căn phòng, kiến trúc v.v.).
- factions: bang phái, tổ chức, gia tộc v.v.
- topics: chủ đề sự kiện cốt lõi (như "giao dịch", "truy sát", "kết minh").
- emotions: bầu không khí chính của vòng này (như "căng thẳng", "thân thiện", "bi thương").
- Mỗi mảng điền tối đa 5 nhãn liên quan nhất, nếu không có thì để trống [].`;

    try {
      const result = await callApi(prompt, 500, 0.4);
      let content = result.trim();
      content = content.replace(/```json\s*/, '').replace(/```\s*/, '');
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) content = jsonMatch[0];
      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || "（Không có tóm tắt）",
        tags: parsed.tags || { entities: [], locations: [], factions: [], topics: [], emotions: [] }
      };
    } catch(e) {
      console.error('[HTYQ] Tóm tắt thông minh+Trích xuất nhãn thất bại:', e);
      return null;
    }
  }

  // ========== Hạ cấp quy tắc: Tổng hợp tóm tắt dựa trên thực thể ==========
  function generateRuleBasedSummary(userMsg, aiMsg, round, tags) {
    const entities = tags.entities?.slice(0, 3) || [];
    const locations = tags.locations?.slice(0, 2) || [];
    const topics = tags.topics?.slice(0, 3) || [];
    const emotions = tags.emotions?.slice(0, 2) || [];

    let summary = `Vòng ${round}`;
    if (locations.length) summary += `, ở ${locations.join('、')}`;
    if (entities.length) summary += `, ${entities.join('、')}`;
    if (topics.length) summary += ` liên quan ${topics.join('、')}`;
    if (emotions.length) summary += `, bầu không khí ${emotions.join('、')}`;

    const actionMatch = (userMsg + ' ' + aiMsg).match(/(?:[，,。]?\s*)([\u4e00-\u9fa5]{2,10}(?:了|着|到|给|向)[\u4e00-\u9fa5]{2,20})/);
    if (actionMatch && actionMatch[1].length < 30) {
      summary += `，${actionMatch[1]}`;
    }
    if (summary.length < 20) {
      summary = `Vòng ${round}: Người dùng và AI đã tiến hành đối thoại.`;
    }
    return summary;
  }

  // ========== Tạo danh sách sự kiện có cấu trúc ==========
  async function generateStructuredEvents(historyText, roundRange, type = 'chapter') {
    const callApi = getCallApi();
    if (!callApi) return null;

    const prompt = `Bạn là một chuyên gia phân tích cốt truyện. Vui lòng tóm tắt toàn bộ tình tiết quan trọng trong lịch sử đối thoại dưới đây, liệt kê theo trình tự thời gian.
Định dạng yêu cầu:
【Tình Tiết Lịch Sử Quan Trọng】
[Tên sự kiện]: Mô tả ngắn gọn sự kiện (chỉ trần thuật sự thật khách quan, không đánh giá và thêm thắt, không bỏ sót bước ngoặt quan trọng)

Lịch sử đối thoại:
${historyText.substring(0, 2500)}

Yêu cầu:
- Chỉ trần thuật sự thật khách quan
- Theo trình tự thời gian
- Giữ lại các bước ngoặt quan trọng
- Sử dụng ngôn ngữ ngắn gọn rõ ràng

Ví dụ định dạng đầu ra:
【Tình Tiết Lịch Sử Quan Trọng】
[Lần đầu gặp gỡ]: Trương Tam ở Túy Tiên Lâu tiết lộ cho Lý Tứ kế hoạch cướp thương nhân của Huyết Đao Môn.
[Mai phục]: Lý Tứ chuyển tình báo cho quan phủ, thiết lập mai phục ở Thanh Thạch Quan.`;

    try {
      const result = await callApi(prompt, 800, 0.6);
      return result.trim();
    } catch(e) {
      console.warn('[HTYQ] 生成结构化事件失败', e);
      return null;
    }
  }

  // ========== Trích xuất nhãn bằng quy tắc (dùng cho hạ cấp) ==========
  function shouldStore(text) {
    if (!text || text.length < 10) return false;
    const trash = ['xin chào', 'ừ', 'ồ', 'được rồi', 'tạm biệt', 'cảm ơn', 'haha', 'ừm ừm', 'vậy sao', 'thôi được', 'rồi sao nữa', 'thì ra là thế', 'biết rồi', 'không có gì'];
    if (trash.some(t => text === t || text.trim() === t)) return false;
    // Nếu toàn là từ ngữ khí vô nghĩa, không lưu
    if (/^[\sừồahạôiêhaizzứmơờmàthôiđiưnha]*$/.test(text)) return false;
    return true;
  }

  function extractTagsByRules(text) {
    const tags = { entities: [], locations: [], factions: [], topics: [], emotions: [], objects: [] };

    let entityDict = new Set([
      'Trương Tam','Lý Tứ','Vương Ngũ','Triệu Lục','Lưu Ly','Cửu Điều Hiểu','Chính Huy','Mỹ Cầm','Thần Cung Tự','Đại Tiểu Thư',
      'Huyết Đao Môn','Thiên Cơ Các','Quan Phủ','Hắc Thị','Thương Hội','Bang Phái','Liên Minh','Triều Đình','Cái Bang','Thiếu Lâm','Võ Đang',
      'Túy Tiên Lâu','Thanh Thạch Quan','Công Tước Gia','Hội Khách Sảnh','Học Viện','Cửu Điều Gia'
    ]);
    const custom = getCustomEntities();
    custom.forEach(e => entityDict.add(e));

    const entityPattern = new RegExp(`(?<![\\u4e00-\\u9fa5])(?:${Array.from(entityDict).join('|')})(?![\\u4e00-\\u9fa5])`, 'g');
    let match;
    while ((match = entityPattern.exec(text)) !== null) {
      const word = match[0];
      if (['Lưu Ly','Cửu Điều Hiểu','Chính Huy','Mỹ Cầm','Thần Cung Tự','Đại Tiểu Thư','Trương Tam','Lý Tứ'].includes(word)) tags.entities.push(word);
      else if (['Công Tước Gia','Hội Khách Sảnh','Túy Tiên Lâu','Thanh Thạch Quan','Học Viện'].includes(word)) tags.locations.push(word);
      else if (['Huyết Đao Môn','Thiên Cơ Các','Quan Phủ','Triều Đình','Cái Bang','Cửu Điều Gia'].includes(word)) tags.factions.push(word);
      else tags.entities.push(word);
    }

    const locPattern = /(?:ở|đi|đến|về|tới|tiến về|đi vào|rời khỏi|nằm ở|đạt tới)([\u4e00-\u9fa5]{2,4})/gu;
    while ((match = locPattern.exec(text)) !== null) {
      let loc = match[1];
      const blacklist = ['gì','thế nào','cái này','cái kia','không có','có thể','biết','nhưng mà','bởi vì','cho nên','đã','hay là','hoặc là','và'];
      if (!blacklist.includes(loc) && loc.length >= 2) tags.locations.push(loc);
    }

    const topicKeywords = ['tình báo','giao dịch','báo phục','thích sát','kết minh','phản bội','treo thưởng','bảo vệ','truy sát','đàm phán','bí mật','kế hoạch','cam kết','đe dọa','cầu cứu','giúp đỡ','tín nhiệm','hôn ước','tị hiềm','nhìn chằm chằm','căng thẳng','chiến đấu','trộm cắp','lừa gạt','chạy trốn','truy tung','mai phục','tiến công','phòng ngự','trinh sát','nội gián','hối lộ','thẩm phán','xử tử','vượt ngục','bắt cóc','giải cứu','phục cừu'];
    tags.topics = topicKeywords.filter(k => text.includes(k));

    const emotionKeywords = ['căng thẳng','uy nghiêm','sợ hãi','khai tâm','phẫn nộ','bi thương','kinh ngạc','chán ghét','tín nhiệm','thích','ghét','hận','yêu','khủng cụ','an tâm','cảm động','áy náy','kích động','tuyệt vọng','hy vọng'];
    tags.emotions = emotionKeywords.filter(k => text.includes(k));

    for (let k in tags) tags[k] = [...new Set(tags[k])];
    return tags;
  }

  function calculateImportance(text, tags) {
    let score = 1;
    if (tags.entities && tags.entities.length > 0) score += 1;
    if (tags.topics && tags.topics.length > 0) score += 2;
    if (text.includes('giết') || text.includes('chết') || text.includes('máu') || text.includes('thù')) score += 2;
    if (text.includes('cam kết') || text.includes('đe dọa') || text.includes('giao dịch') || text.includes('kết minh')) score += 1;
    if (text.includes('yêu') || text.includes('hận') || text.includes('thích')) score += 1;
    if (text.length > 100) score += 1;
    if (tags.topics && (tags.topics.includes('báo phục') || tags.topics.includes('truy sát') || tags.topics.includes('báo thù') || tags.topics.includes('phục cừu'))) score += 2;
    return Math.min(5, Math.max(1, score));
  }

  // ========== Trích xuất cảm xúc (bản tăng cường) ==========
  function extractEmotion(text, entities) {
    const emotions = [];
    for (const entity of entities) {
      let attitude = null;
      let reason = '';
      let impliedLevel = null;

      // Cảm xúc tích cực
      if (text.includes('thích') || text.includes('yêu') || text.includes('yêu sâu đậm')) {
        attitude = 'Thân Thiện'; reason = 'Bộc lộ hảo cảm trong đối thoại'; impliedLevel = 'Bằng Hữu';
      }
      if (text.includes('tín nhiệm') || text.includes('tin cậy') || text.includes('yên tâm')) {
        attitude = 'Tín Nhiệm'; reason = 'Thiết lập quan hệ tín nhiệm'; impliedLevel = 'Chí Giao';
      }
      if (text.includes('giúp đỡ') || text.includes('hỗ trợ') || text.includes('cứu') || text.includes('bảo vệ')) {
        if (!attitude) { attitude = 'Thân Thiện'; reason = 'Cung cấp giúp đỡ'; impliedLevel = 'Bằng Hữu'; }
      }
      if (text.includes('cảm ơn') || text.includes('cảm kích') || text.includes('đa tạ')) {
        if (!attitude) { attitude = 'Thân Thiện'; reason = 'Bày tỏ cảm ơn'; }
      }

      // Cảm xúc tiêu cực
      if (text.includes('hận') || text.includes('cừu hận') || text.includes('oán hận')) {
        attitude = 'Bất Cộng Đái Thiên'; reason = 'Sinh ra thâm cừu đại hận'; impliedLevel = 'Tử Cừu';
      }
      if (text.includes('ghét') || text.includes('chán ghét') || text.includes('phản cảm')) {
        if (attitude !== 'Bất Cộng Đái Thiên') { attitude = 'Thù Địch'; reason = 'Thể hiện sự phản cảm'; impliedLevel = 'Kẻ Thù'; }
      }
      if (text.includes('giết') || text.includes('báo thù') || text.includes('phục cừu')) {
        if (!attitude || attitude !== 'Bất Cộng Đái Thiên') { attitude = 'Thù Địch'; reason = 'Liên quan xung đột bạo lực'; impliedLevel = 'Kẻ Thù'; }
      }
      if (text.includes('đe dọa') || text.includes('cảnh cáo') || text.includes('nguy hiểm')) {
        if (!attitude) { attitude = 'Cảnh Giác'; reason = 'Bị đe dọa hoặc cảnh cáo'; impliedLevel = 'Đối Tượng Khả Nghi'; }
      }

      if (attitude) {
        emotions.push({ entity, attitude, reason, impliedLevel });
      }
    }
    return emotions;
  }

  // ========== Hàm lưu trữ chính ==========
  async function storeMemoryFromRound(state, userMsg, aiMsg, round) {
    const combined = (userMsg + ' ' + aiMsg).substring(0, 1500);
    if (!shouldStore(combined)) return null;

    let summary = null;
    let tags = null;
    let importance = 2;
    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    const useSmart = settings.smartTagging !== false;

    if (useSmart) {
      try {
        let locationHint = null;
        const locMatch = combined.match(/(?:在|于)([\u4e00-\u9fa5]{2,4})/);
        if (locMatch) locationHint = locMatch[1];
        const smartResult = await generateSmartSummaryWithTags(userMsg, aiMsg, round, locationHint);
        if (smartResult) {
          summary = smartResult.summary || "（Không có tóm tắt）";
          tags = {
            entities: smartResult.tags.entities || [],
            locations: smartResult.tags.locations || [],
            factions: smartResult.tags.factions || [],
            topics: smartResult.tags.topics || [],
            emotions: smartResult.tags.emotions || [],
            objects: smartResult.tags.objects || []
          };
          importance = calculateImportance(combined, tags);
        } else {
          tags = extractTagsByRules(combined);
          summary = generateRuleBasedSummary(userMsg, aiMsg, round, tags);
          importance = calculateImportance(combined, tags);
        }
      } catch(e) {
        console.warn('[HTYQ] Tóm tắt thông minh thất bại, hạ cấp xuống quy tắc', e);
        tags = extractTagsByRules(combined);
        summary = generateRuleBasedSummary(userMsg, aiMsg, round, tags);
        importance = calculateImportance(combined, tags);
      }
    } else {
      tags = extractTagsByRules(combined);
      summary = generateRuleBasedSummary(userMsg, aiMsg, round, tags);
      importance = calculateImportance(combined, tags);
    }

    // Gộp thực thể tùy chỉnh
    const customEntities = getCustomEntities();
    if (customEntities.length && tags) {
      for (const ce of customEntities) {
        if (!tags.entities.includes(ce)) tags.entities.push(ce);
      }
    }

    const memory = {
      id: `mem_${Date.now()}_${round}`,
      type: 'round',
      summary: summary,
      context: summary,  // Lưu tóm tắt AI tạo ra làm context (không phải văn bản gốc)
      tags: tags,
      emotion: {},
      importance: importance,
      round: round,
      roundRange: null
    };
    core.addMemory(state, memory);
    console.log(`[HTYQ Memory] Lưu trữ ký ức (độ quan trọng ${importance}): ${summary.substring(0, 80)}...`);

    // ===== Cập nhật cảm xúc (bản tăng cường) =====
    const emotions = extractEmotion(combined, tags.entities || []);
    for (const em of emotions) {
      const currentEmotion = state.emotionMap[em.entity];
      const oldAttitude = currentEmotion?.attitude || 'Trung Lập';
      const newLevel = em.impliedLevel || determineLevel(em.attitude, currentEmotion?.level || 'Người Lạ');
      
      // Phát hiện thay đổi cảm xúc
      if (oldAttitude !== em.attitude) {
        console.log(`[HTYQ Emotion] Thay đổi cảm xúc: ${em.entity} ${oldAttitude} → ${em.attitude} (${em.reason})`);
        
        // Nếu từ Thân Thiện biến thành Thù Địch, ghi vào sổ tay huyết cừu
        if (em.attitude === 'Bất Cộng Đái Thiên' && (oldAttitude === 'Thân Thiện' || oldAttitude === 'Tín Nhiệm')) {
          if (!state.bloodFeudMemo.some(b => b.faction === em.entity)) {
            state.bloodFeudMemo.push({
              faction: em.entity,
              reason: em.reason || 'Đảo ngược cảm xúc: Từ Thân Thiện biến thành Bất Cộng Đái Thiên',
              status: 'Đang theo dõi',
              lastActionRound: state.round,
              nextAttackRound: state.round + Math.floor(Math.random() * 6) + 5,
              attackCount: 0
            });
            console.log(`[HTYQ Emotion] Ký lục huyết cừu thêm mới: ${em.entity}`);
          }
        }
      }

      core.updateEmotion(state, em.entity, em.attitude, newLevel, em.reason);
    }

    // Nếu không có kích hoạt cảm xúc nào nhưng tên thực thể có trong bản đồ cảm xúc, kiểm tra xem có khác với thái độ cũ không
    // (Vòng lặp này đã được xử lý ở trên)

    return memory;
  }

  // ========== Tóm tắt chương ==========
  async function mergeChapterSummary(state, startRound, endRound) {
    const memories = state.memories.filter(m => m.round >= startRound && m.round <= endRound && m.type === 'round');
    if (memories.length === 0) return;

    const combined = memories.map(m => `[Vòng ${m.round}] ${m.summary}`).join('\n');
    let structuredEvents = null;
    let fallbackSummary = `Vòng ${startRound}-${endRound}: ${memories.map(m => m.summary).join('；')}`.substring(0, 500);

    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    if (settings.smartTagging !== false) {
      try {
        structuredEvents = await generateStructuredEvents(combined, [startRound, endRound], 'chapter');
      } catch(e) { console.warn('[HTYQ] Tạo sự kiện có cấu trúc chương thất bại', e); }
    }

    // Gộp nhãn
    const mergedTags = { entities: new Set(), locations: new Set(), factions: new Set(), topics: new Set(), emotions: new Set() };
    for (const m of memories) {
      if (m.tags) {
        for (const key of Object.keys(mergedTags)) {
          if (Array.isArray(m.tags[key])) m.tags[key].forEach(t => mergedTags[key].add(t));
        }
      }
    }
    const tagsObj = {};
    for (const [k, v] of Object.entries(mergedTags)) tagsObj[k] = Array.from(v);

    const chapter = {
      id: `chap_${startRound}_${endRound}`,
      type: 'chapter_summary',
      summary: structuredEvents || fallbackSummary,
      context: structuredEvents ? combined : '',
      tags: tagsObj,
      emotion: {},
      importance: 4,
      round: endRound,
      roundRange: [startRound, endRound],
      structured: !!structuredEvents
    };
    core.addMemory(state, chapter);

    // Dọn dẹp ký ức gốc có độ quan trọng thấp (sau khi giữ lại tóm tắt chương, ký ức gốc có thể giảm lượng)
    const toDelete = memories.filter(m =>
      m.importance < 3 &&
      !m.tags.topics?.includes('báo phục') &&
      !m.tags.topics?.includes('truy sát') &&
      !m.tags.topics?.includes('phục cừu')
    );
    for (const del of toDelete) {
      const idx = state.memories.findIndex(m => m.id === del.id);
      if (idx !== -1) state.memories.splice(idx, 1);
    }
    core.saveState(state);
    console.log(`[HTYQ Memory] Tóm tắt chương đã tạo (${startRound}-${endRound}), giữ lại ${memories.length - toDelete.length} ký ức cốt lõi`);
  }

  async function mergeVolumeSummary(state, startRound, endRound) {
    const chapters = state.chapterSummaries.filter(m => m.round >= startRound && m.round <= endRound);
    if (chapters.length === 0) return;

    const combined = chapters.map(c => c.summary).join('\n\n');
    let structuredEvents = null;
    let fallbackSummary = `Tóm tắt quyển(${startRound}-${endRound}): ${chapters.map(c => c.summary.substring(0, 100)).join('；')}`.substring(0, 800);

    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    if (settings.smartTagging !== false) {
      try {
        structuredEvents = await generateStructuredEvents(combined, [startRound, endRound], 'volume');
      } catch(e) { console.warn('[HTYQ] Tạo sự kiện có cấu trúc quyển thất bại', e); }
    }

    const volume = {
      id: `vol_${startRound}_${endRound}`,
      type: 'volume_summary',
      summary: structuredEvents || fallbackSummary,
      context: structuredEvents ? combined : '',
      tags: { topics: ['summary', 'volume'] },
      emotion: {},
      importance: 5,
      round: endRound,
      roundRange: [startRound, endRound],
      structured: !!structuredEvents
    };
    core.addMemory(state, volume);
    core.saveState(state);
    console.log(`[HTYQ Memory] Tóm tắt quyển đã tạo (${startRound}-${endRound})`);
  }

  // ========== Triệu hồi ký ức (Tăng cường: hỗ trợ trọng số cảm xúc) ==========
  function recallMemories(state, tags, maxCount = 10, currentLocation = null) {
    let allMemories = [...state.memories, ...state.chapterSummaries, ...state.volumeSummaries];
    let scored = allMemories.map(mem => {
      let score = 0;
      const memTags = mem.tags || {};

      // Khớp thực thể (trọng số cao)
      if (memTags.entities) {
        score += memTags.entities.filter(e => tags.includes(e)).length * 2;
      }
      // Khớp địa điểm (bao gồm điều chỉnh trọng số địa điểm hiện tại)
      if (memTags.locations) {
        let locScore = memTags.locations.filter(l => tags.includes(l)).length;
        if (currentLocation && memTags.locations.includes(currentLocation)) {
          locScore *= 1.5;  // Trọng số địa điểm hiện tại x1.5
        } else if (currentLocation && memTags.locations.length && !memTags.locations.includes(currentLocation)) {
          locScore *= 0.3;  // Trọng số địa điểm xung đột x0.3 (không phải về 0)
        }
        score += locScore;
      }
      // Khớp thế lực
      if (memTags.factions) {
        score += memTags.factions.filter(f => tags.includes(f)).length;
      }
      // Khớp chủ đề (trọng số cao)
      if (memTags.topics) {
        score += memTags.topics.filter(t => tags.includes(t)).length * 1.5;
      }

      // Điểm cộng thêm cho thực thể hoạt động
      const activeEntities = tags.filter(t => memTags.entities && memTags.entities.includes(t));
      score += activeEntities.length * 0.2 * (mem.importance || 1);

      // Trọng số độ quan trọng
      if (mem.importance >= 4) score += 3;
      else if (mem.importance === 3) score += 1;

      // Trọng số thời gian
      const age = state.round - (mem.round || 0);
      if (age < 10) score += 2;
      else if (age < 30) score += 1;

      return { mem, score };
    });
    scored.sort((a,b) => b.score - a.score);
    return scored.slice(0, maxCount).map(s => s.mem);
  }

  // ========== Công cụ gỡ lỗi ==========
  window.HTYQ_DEBUG_MEMORY = () => {
    const state = core.loadState();
    console.log('=== HTYQ Memory Debug ===');
    console.log('Số lượng ký ức gốc:', state.memories.length);
    console.log('Số lượng tóm tắt chương:', state.chapterSummaries.length);
    console.log('Số lượng tóm tắt quyển:', state.volumeSummaries.length);
    console.log('Thực thể cảm xúc:', Object.keys(state.emotionMap).length);
    console.log('5 tóm tắt ký ức gần nhất:', state.memories.slice(0,5).map(m => ({ round: m.round, summary: m.summary })));
    console.log('Ảnh chụp cảm xúc:', state.emotionMap);
  };

  return {
    storeMemoryFromRound,
    recallMemories,
    mergeChapterSummary,
    mergeVolumeSummary
  };
})();
