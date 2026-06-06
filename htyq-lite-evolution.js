// htyq-lite-evolution.js — Gọi API tiến hóa + Bắt buộc kích hoạt chuỗi sự kiện + Tự động truy sát huyết cừu
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.0
//   - Tăng cường forceTriggerEvents: sự kiện đếm ngược về 0 bắt buộc bùng nổ, đưa ra biểu hiện cốt truyện hợp lý
//   - Tăng cường advanceBloodFeud: huyết cừu không bao giờ treo, tạo hành động truy sát mỗi 5-10 vòng
//   - Cơ chế treo chuỗi sự kiện: cho phép trạng thái "treo-chuẩn bị vòng ngoài" và ghi lại nguyên nhân cùng điều kiện khôi phục
//   - Thúc đẩy chuỗi sự kiện: khi còn 1 vòng, tự động đánh dấu "sắp bùng nổ" để ảnh hưởng đến nhãn dự đoán
//   - Tăng cường decayRumors: thêm đột biến tin đồn (có thể đột biến thành tin đồn khác)
// 2026-06-05 v2.2.0
//   - Trong callEvolutionAPI await tagsGen.generatePredictionTags (phối hợp cải tiến bất đồng bộ)
// ============================================================

window.HTYQ_LITE_EVOLUTION = (function() {
  const core = window.HTYQ_LITE_CORE;
  const memory = window.HTYQ_LITE_MEMORY;
  const tagsGen = window.HTYQ_LITE_TAGS;
  const worldbook = window.HTYQ_LITE_WORLDBOOK;

  // ========== Hàm gọi API chung ==========
  async function callApi(prompt, maxTokens = 2000, temperature = 0.7) {
    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    const apiMode = settings.apiMode || 'tavern';
    let customUrl = settings.customUrl || '';
    const customKey = settings.customKey || '';
    const customModel = settings.customModel || 'gpt-3.5-turbo';

    if (apiMode === 'tavern') {
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (!ctx) throw new Error('Không thể lấy ngữ cảnh SillyTavern');
      if (typeof ctx.generateRaw !== 'function') throw new Error('Môi trường hiện tại không hỗ trợ generateRaw, vui lòng chuyển sang chế độ API tùy chỉnh');

      try {
        let result;
        try {
          result = await ctx.generateRaw({
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: temperature,
            stream: false
          });
        } catch (e) {
          result = await ctx.generateRaw({
            prompt: prompt,
            max_tokens: maxTokens,
            temperature: temperature,
            should_stream: false
          });
        }
        if (typeof result !== 'string') result = result.text || String(result);
        return result;
      } catch (err) {
        console.error('[HTYQ API] gọi chế độ tavern thất bại', err);
        throw new Error('Gọi Tavern API thất bại: ' + err.message);
      }
    } else {
      if (!customUrl) throw new Error('Chưa cấu hình URL API tùy chỉnh');
      const fullUrl = normalizeApiUrl(customUrl);
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customKey}` },
        body: JSON.stringify({
          model: customModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature,
          max_tokens: maxTokens
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.choices[0].message.content;
    }
  }

  function normalizeApiUrl(url) {
    let u = url.trim().replace(/\/+$/, '');
    if (!u) return '';
    if (u.endsWith('/chat/completions')) return u;
    if (u.endsWith('/v1')) return u + '/chat/completions';
    return u + '/v1/chat/completions';
  }

  // ========== Kích hoạt cứng chuỗi sự kiện (Bản tăng cường) ==========
  function forceTriggerEvents(state) {
    let triggered = false;
    for (const ev of state.events) {
      const remaining = ev.totalRounds - ev.currentRound;

      // Xử lý trạng thái treo
      if (ev.stage === 'Treo' && ev.suspendCondition) {
        // Mỗi lần lặp kiểm tra điều kiện treo có thỏa mãn không (thông qua nhãn để đánh giá ngữ cảnh có thay đổi không)
        // Quy tắc đơn giản: treo quá 3 vòng tự động khôi phục
        if (ev.suspendRounds === undefined) ev.suspendRounds = 0;
        ev.suspendRounds++;
        if (ev.suspendRounds >= 3) {
          ev.stage = 'Lên Men';
          ev.suspendRounds = 0;
          delete ev.suspendCondition;
          delete ev.suspendReason;
          core.addMemory(state, {
            id: `event_resume_${Date.now()}_${ev.name}`,
            type: 'round',
            summary: `Khôi phục sự kiện: ${ev.name} đã khôi phục từ trạng thái treo.`,
            context: ev.suspendResumeNote || ev.desc,
            tags: { topics: ['event'] },
            importance: 3,
            round: state.round,
          });
          triggered = true;
        }
        ev.currentRound++;
        continue;
      }

      if (remaining <= 0 && ev.status !== 'Đã Bùng Nổ') {
        ev.status = 'Đã Bùng Nổ';
        ev.stage = 'Đã Bùng Nổ';
        triggered = true;

        // Ký ức: Sự kiện bùng nổ
        core.addMemory(state, {
          id: `event_${Date.now()}_${ev.name}`,
          type: 'round',
          summary: `‼️ Sự kiện bùng nổ: ${ev.name}! ${ev.desc}`,
          context: ev.desc,
          tags: { topics: ['event', 'critical', 'eruption'] },
          importance: 5,
          round: state.round,
        });
        console.log(`[HTYQ Evolution] 🚨 Bắt buộc kích hoạt sự kiện: ${ev.name}`);

      } else if (remaining <= 1 && ev.stage !== 'Đã Bùng Nổ' && ev.stage !== 'Treo') {
        // Còn 1 vòng: đánh dấu là sắp bùng nổ, nhưng không bắt buộc thúc đẩy
        // Khi tạo nhãn sẽ ảnh hưởng đến trọng số nhãn dự đoán
        ev.stage = 'Sắp Bùng Nổ';
        ev.currentRound++;
        console.log(`[HTYQ Evolution] ⚠️ Sự kiện sắp bùng nổ: ${ev.name}`);
      } else if (remaining > 0 && ev.stage !== 'Đã Bùng Nổ' && ev.stage !== 'Treo') {
        ev.currentRound++;
        if (remaining <= 2) {
          // Còn 2 vòng thì vào giai đoạn lên men
          if (ev.stage === 'Nảy Mầm') ev.stage = 'Lên Men';
          console.log(`[HTYQ Evolution] Thúc đẩy sự kiện: ${ev.name} (${ev.currentRound}/${ev.totalRounds})`);
        }
      }
    }
    if (triggered) core.saveState(state);
    return triggered;
  }

  // ========== Tự động truy sát huyết cừu (Bản tăng cường: Không bao giờ treo, tuần hoàn 5-10 vòng) ==========
  function advanceBloodFeud(state) {
    if (!state.bloodFeudMemo || !state.bloodFeudMemo.length) return false;
    let advanced = false;
    for (const bf of state.bloodFeudMemo) {
      if (bf.status === 'Đã Kết Thúc') continue;

      // Khởi tạo chu kỳ truy sát lần đầu
      if (!bf.nextAttackRound) {
        bf.nextAttackRound = state.round + Math.floor(Math.random() * 6) + 5; // Sau 5-10 vòng
        bf.status = bf.status || 'Đang Theo Dõi';
        bf.attackCount = bf.attackCount || 0;
      }

      // Đạt đến số vòng truy sát
      if (state.round >= bf.nextAttackRound) {
        bf.lastActionRound = state.round;
        bf.attackCount = (bf.attackCount || 0) + 1;

        if (bf.attackCount >= 5) {
          // Có thể kết thúc sau 5 lần truy sát
          bf.status = 'Đã Kết Thúc';
          core.addMemory(state, {
            id: `bf_end_${Date.now()}_${bf.faction}`,
            type: 'round',
            summary: `Kết thúc huyết cừu: Cuộc truy sát của ${bf.faction} đã tạm dừng.`,
            context: '',
            tags: { topics: ['revenge', 'settled'] },
            importance: 4,
            round: state.round,
          });
        } else {
          bf.status = 'Đang Truy Sát';
          // Lần tấn công tiếp theo: Sau 5-10 vòng
          bf.nextAttackRound = state.round + Math.floor(Math.random() * 6) + 5;

          core.addMemory(state, {
            id: `bf_${Date.now()}_${bf.faction}`,
            type: 'round',
            summary: `⚠️ Hành động huyết cừu: ${bf.faction} phái ra người truy sát (lần ${bf.attackCount}). Nguyên nhân: ${bf.reason}`,
            context: '',
            tags: { topics: ['revenge', '追杀', '战斗'] },
            importance: 5,
            round: state.round,
          });
          console.log(`[HTYQ Evolution] 🔪 Truy sát huyết cừu #${bf.attackCount}: ${bf.faction}`);
        }
        advanced = true;
      } else if (bf.status === 'Đang Truy Sát' && (state.round - bf.lastActionRound) >= 3) {
        // Đang truy sát nhưng đã qua 3 vòng không có hành động → Đang theo dõi
        bf.status = 'Đang Theo Dõi';
      }
    }
    if (advanced) core.saveState(state);
    return advanced;
  }

  // ========== Gọi API tiến hóa ==========
  async function callEvolutionAPI(state, userMsg, aiMsg) {
    let chatHistory = [];
    try {
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (ctx && ctx.chat) chatHistory = ctx.chat;
    } catch(e) { console.warn('[HTYQ] Lấy lịch sử trò chuyện thất bại', e); }

    let tags = [];
    if (tagsGen && typeof tagsGen.generatePredictionTags === 'function') {
      tags = await tagsGen.generatePredictionTags(chatHistory, state);
    }

    let worldbookTexts = [];
    if (worldbook && typeof worldbook.matchEntries === 'function') {
      worldbookTexts = worldbook.matchEntries(tags, 5);
    }

    const worldbookSection = worldbookTexts.length > 0
      ? `\n## Kiến thức bối cảnh của thế giới hiện tại (Từ Thế Giới Thư)\n${worldbookTexts.map((t,i) => `${i+1}. ${t.substring(0, 300)}`).join('\n')}\n`
      : '';

    const engineRules = `
## Quy tắc bắt buộc tiến hóa thế giới (Phải tuân thủ nghiêm ngặt)

1. **Chuỗi sự kiện**: Duy trì ít nhất 1~3 sự kiện. Mỗi sự kiện phải có: name, level(1-4), stage(Nảy Mầm/Lên Men/Đến Gần/Đã Bùng Nổ/Dư Âm), currentRound, totalRounds(3-8), desc, trigger.
   - Nếu có sổ tay huyết cừu, phải tạo chuỗi sự kiện tương ứng.
   - Chuỗi sự kiện đã có sẽ thúc đẩy theo vòng (currentRound++), nếu currentRound >= totalRounds thì stage đổi thành "Đã Bùng Nổ".
   - Không cho phép tình trạng "còn 1 vòng kéo dài 5 vòng". Nếu cốt truyện cần trì hoãn, phải giải thích nguyên nhân treo trong bảng điều khiển (reason/suspendCondition/suspendResumeNote).
2. **Thế lực**: Duy trì ít nhất 3 thế lực. Mỗi thế lực phải có: name, cohesion(Đoàn Kết/Lỏng Lẻo/Phân Liệt), resources(Dồi Dào/Căng Thẳng/Khô Kiệt), currentGoal(chuỗi), attentionToUser(Không/Quan Sát/Lôi Kéo/Bài Xích).
   - Nếu thế lực ít hơn 3, phải tạo thế lực mới.
3. **Tin đồn**: Tạo ít nhất 2 tin đồn. Mỗi tin đồn bao gồm: content, scope(khu vực), credibility(Cao/Trung Bình/Thấp), source, heat(nhiệt độ).
4. **Tóm tắt thế giới (world_digest)**: 150-200 chữ, mô tả quá trình diễn biến ngầm của thế giới vòng này (sự kiện thúc đẩy, tiến hóa tin đồn, NPC hành động độc lập, thay đổi nhóm), **Cấm nhắc đến {{user}}**.
5. **Danh tiếng (economy/reputation)**: Có thể tinh chỉnh marketTrend, fundsStatus v.v. dựa trên nội dung đối thoại.
6. **Nếu không có thay đổi, không được trả về mảng rỗng. Phải tạo ít nhất một tin đồn hoặc một thay đổi nhỏ của sự kiện.**
7. **Tiến độ nhóm**: Mỗi thế lực phải chứa mô tả tiến độ (chỉ văn bản), độ đoàn kết, dự trữ tài nguyên cần dao động định kỳ.
8. **timeEstimateMinutes**: Bắt buộc điền. Dựa trên nội dung đối thoại để ước tính thời gian thực tế đã trôi qua trong thế giới, đơn vị phút. Tán gẫu 1-5 phút, cảnh bình thường 5-30 phút, cảnh vượt thời gian thì ước tính theo thực tế (như "ba ngày sau" điền 4320). Ít nhất 1 phút, nhiều nhất 10080 phút (7 ngày).

9. **Sổ tay huyết cừu (bloodFeudMemo)**: Khi cốt truyện sinh ra huyết cừu không thể hóa giải (như nhân vật cốt lõi bị giết, người thân bị hại), phải thêm mục vào mảng này. Định dạng: [{ faction, reason, status, lastActionRound, nextAttackRound }]. status khởi tạo là "Đang Theo Dõi". Mục đã có có thể cập nhật trạng thái (như "Đang Truy Sát", "Đã Kết Thúc"). Mảng này do mô hình duy trì.
10. **Quan hệ thế lực (factionRelations)**: Tùy chọn nhưng khuyến nghị. Khi quan hệ giữa các thế lực thay đổi, xuất mảng này. Mỗi mục có định dạng: { factionA, factionB, relation, level, trend }. relation chỉ có thể dùng: Huyết Minh/Minh Hữu/Hữu Hảo/Trung Lập/Lạnh Nhạt/Căng Thẳng/Địch Đối/Thế Cừu. Không có thay đổi có thể không xuất.
11. **Chuỗi nhân quả (causalChain)**: Tùy chọn. Khi vòng này xảy ra quan hệ nhân quả rõ ràng (Sự kiện A dẫn đến Sự kiện B, hoặc hành động người chơi dẫn đến thay đổi thế lực v.v.) thì xuất. Mỗi mục định dạng: { event, progress, manifestation }. Không có quan hệ nhân quả mạnh mẽ có thể không xuất.
`;

    const prompt = `Bạn là một động cơ tiến hóa thế giới. Sau mỗi vòng đối thoại, thế giới phải tiến thêm một bước.
**Cập nhật trạng thái thế giới nghiêm ngặt theo các quy tắc dưới đây, chỉ xuất JSON, không thêm chữ nào khác.**

${engineRules}
${worldbookSection}

## Trạng thái thế giới hiện tại (Vòng ${state.round})
${JSON.stringify({
  round: state.round,
  events: state.events.map(e => ({ name: e.name, stage: e.stage, currentRound: e.currentRound, totalRounds: e.totalRounds })),
  factions: state.factions.map(f => ({ name: f.name, cohesion: f.cohesion, resources: f.resources })),
  rumors: state.rumors.slice(0,3),
  reputation: state.reputation,
  economy: state.economy,
  bloodFeudMemo: state.bloodFeudMemo,
  factionRelations: state.factionRelations,
  causalChain: state.causalChain
}, null, 2)}

## Đối thoại vòng này
Người dùng: ${userMsg.substring(0, 500)}
AI: ${aiMsg.substring(0, 500)}

## Ví dụ định dạng xuất JSON
{
  "events": [
    { "name": "Huyết Đao Môn Tầm Cừu", "level": 2, "stage": "Lên Men", "currentRound": 2, "totalRounds": 4, "desc": "Huyết Đao Môn đã phái người theo dõi", "trigger": "{{user}} đã giết đệ tử Huyết Đao Môn" }
  ],
  "factions": [
    { "name": "Huyết Đao Môn", "cohesion": "Đoàn Kết", "resources": "Dồi Dào", "currentGoal": "Phục Cừu", "attentionToUser": "Bài Xích" }
  ],
  "rumors": [
    { "content": "Có người ở Thanh Thạch Quan nhìn thấy quan binh thiết lập chốt chặn", "scope": "Thanh Thạch Quan", "credibility": "Cao", "source": "Thương nhân chứng kiến", "heat": "Trung Bình" }
  ],
  "economy": { "marketTrend": "Bình Ổn", "fundsStatus": "Thiếu Thốn" },
  "reputation": { "jianghu": "Vô Danh", "official": "Vô Danh", "folk": "Vô Danh", "underworld": "Vô Danh" },
  "world_digest": "Sự kiện phục cừu của Huyết Đao Môn tiếp tục thúc đẩy, đã vào giai đoạn lên men; gần Thanh Thạch Quan xuất hiện tin đồn quan binh thiết lập chốt chặn, thương khách bắt đầu đi đường vòng; mâu thuẫn nội bộ bang phái trong thành gia tăng.",
  "causalChain": [
    { "event": "Huyết Đao Môn Phục Cừu", "progress": "Lệnh truy nã khiến người trên giang hồ bắt đầu chú ý {{user}}", "manifestation": "Ánh mắt ông chủ khách sạn nhìn {{user}} trở nên khác lạ" }
  ],
  "timeEstimateMinutes": 15,
  "factionRelations": [
    { "factionA": "Huyết Đao Môn", "factionB": "Thiên Cơ Các", "relation": "Địch Đối", "level": 2, "trend": "Xấu Đi" }
  ],
  "bloodFeudMemo": [
    { "faction": "Huyết Đao Môn", "reason": "{{user}} đã giết thiếu chủ Huyết Đao Môn", "status": "Đang Truy Sát", "lastActionRound": 2, "nextAttackRound": 7 }
  ]
}

Chú ý: Nếu mô hình không thể tạo đủ nội dung, thà tạo nội dung mặc định hợp lý (như "Thế giới bình yên không có sự kiện lớn"), cũng không được trả về mảng rỗng.`;

    try {
      const rawResult = await callApi(prompt, 2000, 0.7);
      let content = rawResult.trim();
      content = content.replace(/```json/g, '').replace(/```/g, '').trim();

      let update = null;
      try {
        update = JSON.parse(content);
      } catch(e) {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          try { update = JSON.parse(match[0]); } catch(e2) {}
        }
      }
      if (!update) update = {};

      // Chịu lỗi tên trường
      if (update.event && !update.events) update.events = [update.event];
      if (update.faction && !update.factions) update.factions = [update.faction];
      if (update.rumor && !update.rumors) update.rumors = [update.rumor];

      // Đảm bảo mảng tồn tại
      update.events = update.events || [];
      update.factions = update.factions || [];
      update.rumors = update.rumors || [];
      update.economy = update.economy || {};
      update.reputation = update.reputation || {};
      update.world_digest = update.world_digest || state.worldDigest;
      update.causalChain = update.causalChain || [];
      update.factionRelations = update.factionRelations || [];
      update.bloodFeudMemo = update.bloodFeudMemo || [];

      // Nếu tất cả trống, bổ sung một tin đồn mặc định
      if (update.rumors.length === 0 && update.events.length === 0 && update.factions.length === 0) {
        update.rumors.push({
          content: 'Thế giới bình yên không có sự kiện lớn',
          scope: 'Toàn Vực',
          credibility: 'Thấp',
          source: 'Lời đồn chợ búa',
          heat: 'Lạnh'
        });
      }

      // Áp dụng cập nhật
      for (const ev of update.events) core.addEvent(state, ev);
      for (const fac of update.factions) core.addFaction(state, fac);
      for (const rum of update.rumors) core.addRumor(state, rum);
      if (Object.keys(update.economy).length) Object.assign(state.economy, update.economy);
      if (Object.keys(update.reputation).length) Object.assign(state.reputation, update.reputation);
      if (update.world_digest) state.worldDigest = update.world_digest;

      // Chuỗi nhân quả: Xóa trùng và gộp
      if (update.causalChain.length) {
        for (const cc of update.causalChain) {
          const existingIdx = state.causalChain.findIndex(ex => ex.event === cc.event);
          if (existingIdx !== -1) {
            state.causalChain[existingIdx] = cc;
          } else {
            state.causalChain.unshift(cc);
          }
        }
        if (state.causalChain.length > 20) state.causalChain.pop();
      }

      // Quan hệ thế lực: Xóa trùng và gộp
      if (update.factionRelations.length) {
        for (const fr of update.factionRelations) {
          const existingIdx = state.factionRelations.findIndex(ex =>
            (ex.factionA === fr.factionA && ex.factionB === fr.factionB) ||
            (ex.factionA === fr.factionB && ex.factionB === fr.factionA)
          );
          if (existingIdx !== -1) {
            state.factionRelations[existingIdx] = fr;
          } else {
            state.factionRelations.unshift(fr);
          }
        }
        if (state.factionRelations.length > 30) state.factionRelations.pop();
      }

      // Sổ tay huyết cừu: Gộp
      if (update.bloodFeudMemo.length) {
        for (const bf of update.bloodFeudMemo) {
          const existingIdx = state.bloodFeudMemo.findIndex(ex => ex.faction === bf.faction);
          if (existingIdx !== -1) {
            state.bloodFeudMemo[existingIdx] = { ...state.bloodFeudMemo[existingIdx], ...bf };
          } else {
            state.bloodFeudMemo.unshift(bf);
          }
        }
        // Giữ lại mục đã kết thúc một thời gian để tiện truy xuất
        state.bloodFeudMemo = state.bloodFeudMemo.filter(bf => {
          if (bf.status === 'Đã Kết Thúc') {
            return (state.round - (bf.lastActionRound || 0)) < 20;
          }
          return true;
        });
        if (state.bloodFeudMemo.length > 15) state.bloodFeudMemo.pop();
      }

      // v2.3.0: Lưu kết quả gốc của lần tiến hóa này (bao gồm timeEstimateMinutes)
      state.lastEvolveResult = update;
      core.saveState(state);
      return true;
    } catch(e) {
      console.error('Gọi API tiến hóa thất bại', e);
      return false;
    }
  }

  // ========== Lão hóa và đột biến tin đồn ==========
  function decayRumors(state) {
    if (!state.rumors || state.rumors.length === 0) return;
    const now = state.round;
    const toRemove = [];
    const toMutate = [];
    for (let i = 0; i < state.rumors.length; i++) {
      const rumor = state.rumors[i];
      const age = now - (rumor.addedRound || now);
      const heatMap = { 'Lạnh': 0, 'Thấp': 1, 'Trung Bình': 2, 'Cao': 3, 'Nóng': 4 };
      let heatVal = heatMap[rumor.heatLevel] || 2;
      let decay = 0.2 + age * 0.05;
      heatVal = Math.max(0, heatVal - decay);
      let newHeatLevel = 'Lạnh';
      if (heatVal >= 3) newHeatLevel = 'Nóng';
      else if (heatVal >= 2) newHeatLevel = 'Trung Bình';
      else if (heatVal >= 1) newHeatLevel = 'Thấp';
      else newHeatLevel = 'Lạnh';
      rumor.heatLevel = newHeatLevel;
      rumor.heat = newHeatLevel;

      const credibilityMap = { 'Cao': 3, 'Trung Bình': 2, 'Thấp': 1 };
      let credVal = credibilityMap[rumor.credibility] || 2;
      credVal = Math.max(1, credVal - age * 0.1);
      if (credVal <= 1) rumor.credibility = 'Thấp';
      else if (credVal <= 2) rumor.credibility = 'Trung Bình';
      else rumor.credibility = 'Cao';

      // Nhiệt độ là Lạnh và tuổi vượt quá 5 vòng → Xóa bỏ
      if (newHeatLevel === 'Lạnh' && age >= 5) {
        toRemove.push(i);
      }
      // Nhiệt độ là Nóng và tuổi vượt quá 8 vòng và trúng xác suất ngẫu nhiên → Đột biến (tin đồn cũ đột biến thành phiên bản mới)
      if (newHeatLevel === 'Nóng' && age >= 8 && Math.random() < 0.15) {
        toMutate.push(i);
      }
    }

    // Xóa bỏ
    for (let i = toRemove.length - 1; i >= 0; i--) {
      state.rumors.splice(toRemove[i], 1);
    }

    // Đột biến
    for (const idx of toMutate) {
      const oldRumor = state.rumors[idx];
      const mutated = {
        content: `Tin đồn có biến: ${oldRumor.content.substring(0, 20)}... (Chi tiết đã tiến hóa đến mức không nhận ra)`,
        scope: oldRumor.scope,
        credibility: 'Thấp',
        source: 'Lời đồn đột biến',
        heat: 'Lạnh',
        heatLevel: 'Lạnh',
        addedRound: now
      };
      state.rumors.push(mutated);
    }

    if (toRemove.length || toMutate.length) {
      core.saveState(state);
      console.log(`[HTYQ Evolution] Lão hóa tin đồn: Xóa bỏ ${toRemove.length} điều, đột biến ${toMutate.length} điều, còn lại ${state.rumors.length} điều`);
    }
  }

  // ========== Cổng tiến hóa thống nhất ==========
  async function evolve(state, userMsg, aiMsg) {
    const backup = JSON.parse(JSON.stringify(state));

    forceTriggerEvents(state);
    advanceBloodFeud(state);

    const apiSuccess = await callEvolutionAPI(state, userMsg, aiMsg);

    if (apiSuccess) {
      state.round++;
      state.lastEvolveRound = state.round;
      decayRumors(state);
      core.saveState(state);

      // Mỗi 20 vòng dọn dẹp kho ký ức một lần
      if (state.round % 20 === 0) {
        core.cleanupState(state);
      }
      return true;
    } else {
      Object.assign(state, backup);
      core.saveState(state);
      console.warn('[HTYQ Evolution] Tiến hóa thất bại, trạng thái đã hoàn tác');
      return false;
    }
  }

  return { forceTriggerEvents, advanceBloodFeud, evolve, callApi, decayRumors };
})();
