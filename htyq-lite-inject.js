// Xây dựng ngữ cảnh bơm (ký ức + trạng thái bảng điều khiển + thế giới thư), hỗ trợ trọng số địa điểm và thực thể hoạt động, tăng giới hạn độ dài
// Bản hoàn chỉnh: bao gồm chuỗi sự kiện, thế lực, lưu ngôn, huyết cừu, danh vọng, cảm xúc, chuỗi nhân quả, quan hệ thế lực, kinh tế
window.HTYQ_LITE_INJECT = (function() {
  const core = window.HTYQ_LITE_CORE;
  const memory = window.HTYQ_LITE_MEMORY;
  const tagsGen = window.HTYQ_LITE_TAGS;
  const worldbook = window.HTYQ_LITE_WORLDBOOK;

  async function buildContext(chatHistory, worldState, tags) {
    // Trích xuất địa điểm hiện tại (lấy loại location đầu tiên từ nhãn)
    const currentLocation = tags.find(t => t.startsWith('location:'))?.split(':')[1] || null;
    // Trích xuất thực thể hoạt động
    const activeEntities = tags.filter(t => worldState.emotionMap[t] !== undefined);
    
    const recalled = memory.recallMemories(worldState, tags, 10, currentLocation);
    const worldbookTexts = worldbook.matchEntries(tags, 5);

    // Phần ký ức
    let memoryText = '';
    if (recalled.length) {
      memoryText = recalled.map(m => {
        const star = '★'.repeat(Math.min(3, m.importance));
        let line = `[${star}] ${m.summary} (Vòng ${m.round})`;
        if (m.tags.entities?.length) line += ` Liên Quan: ${m.tags.entities.join(',')}`;
        if (m.emotion && Object.keys(m.emotion).length) line += ` Cảm Xúc: ${JSON.stringify(m.emotion)}`;
        return line;
      }).join('\n');
    } else {
      memoryText = 'Không có ký ức liên quan';
    }

    // Tóm tắt bảng điều khiển (Bản cường hóa)
    const eventsText = worldState.events.map(e => {
      const remaining = e.totalRounds - e.currentRound;
      let status = '';
      if (remaining <= 0) status = '🔥 Bùng Nổ Ngay Lập Tức';
      else if (remaining === 1) status = '⚠️ Còn 1 vòng, sắp bùng nổ';
      else status = `Còn ${remaining} vòng`;
      return `${e.name}(Lv.${e.level}) ${e.stage} ${status}`;
    }).join('；') || '无';
    
    const factionsText = worldState.factions.map(f => `${f.name} (Lực Ngưng Tụ: ${f.cohesion})`).join('；') || 'Không';
    const rumorsText = worldState.rumors.slice(0,3).map(r => r.content).join('；') || 'Không';
    
    // Chi tiết Huyết Cừu (Cường hóa)
    let bloodText = 'Không';
    if (worldState.bloodFeudMemo && worldState.bloodFeudMemo.length) {
      bloodText = worldState.bloodFeudMemo.map(b => 
        `${b.faction} (${b.status}, Lý do: ${b.reason}, Lần tấn công tới khoảng ${b.nextAttackRound || '?'} vòng sau)`
      ).join('；');
    }
    
    // Danh Vọng
    const rep = worldState.reputation;
    const repText = `Giang Hồ: ${rep.jianghu} Quan Phủ: ${rep.official} Dân Gian: ${rep.folk} Hắc Đạo: ${rep.underworld}`;
    
    // Cảm Xúc
    const emotionText = Object.entries(worldState.emotionMap).slice(0,5).map(([n, e]) => `${n}:${e.attitude}(${e.level})`).join(', ') || 'Không';
    
    // Chuỗi Nhân Quả
    let causalText = 'Không';
    if (worldState.causalChain && worldState.causalChain.length) {
      causalText = worldState.causalChain.map(c => 
        `${c.event}: ${c.progress} → ${c.manifestation || 'Không có biểu hiện cụ thể'}`
      ).join('；');
    }
    
    // Quan Hệ Thế Lực
    let relationText = 'Không';
    if (worldState.factionRelations && worldState.factionRelations.length) {
      relationText = worldState.factionRelations.map(r => 
        `${r.factionA} ↔ ${r.factionB}: ${r.relation} (Xu Hướng: ${r.trend || 'Ổn định'})`
      ).join('；');
    }
    
    // Kinh Tế và Vật Tư
    const econ = worldState.economy || {};
    const economyText = `Xu Hướng Thị Trường: ${econ.marketTrend || 'Bình ổn'}, Tình Trạng Quỹ: ${econ.fundsStatus || 'Eo hẹp'}, Tài Nguyên Cốt Lõi: ${(econ.keyResources || []).join(', ') || 'Không'}`;

    const panelText = `
【Tóm Tắt Trạng Thái Thế Giới】
Vòng: ${worldState.round}
Đại Thế Thế Giới: ${worldState.worldDigest}
Chuỗi Sự Kiện: ${eventsText}
Thế Lực: ${factionsText}
Quan Hệ Thế Lực: ${relationText}
Lưu Ngôn: ${rumorsText}
Huyết Cừu: ${bloodText}
Chuỗi Nhân Quả: ${causalText}
Kinh Tế: ${economyText}
Danh Vọng: ${repText}
Cảm Xúc Cốt Lõi: ${emotionText}
    `.trim();

    const worldbookSection = worldbookTexts.length ?
      '【Tham Khảo Thế Giới Thư】\n' + worldbookTexts.map((t,i) => `${i+1}. ${t.length > 800 ? t.substring(0, 800) + '...' : t}`).join('\n') :
      '【Tham Khảo Thế Giới Thư】 Không';

    let finalContext = `
${panelText}

【Ký Ức Liên Quan】
${memoryText}

${worldbookSection}

Chú Ý: Trên đây là bối cảnh thế giới và ký ức gần đây, hãy hòa nhập tự nhiên vào cốt truyện, không thuật lại một cách cứng nhắc.
    `.trim();

    // Giới hạn tổng độ dài không quá 4000 ký tự
    if (finalContext.length > 4000) {
      finalContext = finalContext.substring(0, 4000) + "\n... (Nội dung quá dài đã bị cắt bớt)";
    }
    return finalContext;
  }

  return { buildContext };
})();
