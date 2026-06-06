// htyq-lite-core.js — Cấu trúc dữ liệu và lưu trữ cốt lõi (cách ly theo ID chat)
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.0
//   - updateEmotion thêm bảo vệ suy giảm cảm xúc (giá trị rỗng không ghi vào)
//   - Thêm hàm getEmotionSummary (tóm tắt nhanh trạng thái cảm xúc)
//   - Thêm hàm cleanupState (định kỳ dọn dẹp ký ức hết hạn độ quan trọng thấp)
//   - ensureArrays phòng ngự: Toàn bộ mảng trường dữ liệu tham chiếu đầy đủ
//
// 2026-06-05 v2.3.0
//   - getDefaultState thêm mới inWorldMinutes / lastTimeCheckRound / lastEvolveRound / driveMode
// ============================================================

window.HTYQ_LITE_CORE = (function() {
  const STORAGE_PREFIX = 'htyq_lite_';

  function getDefaultState() {
    return {
      round: 0,
      worldDigest: 'Thế giới đang thức tỉnh, mọi thứ vẫn chưa rõ.',
      events: [],
      factions: [],
      factionRelations: [],
      rumors: [],
      reputation: { jianghu: 'Vô danh', official: 'Vô danh', folk: 'Vô danh', underworld: 'Vô danh' },
      economy: { marketTrend: 'Bình ổn', fundsStatus: 'Eo hẹp', keyResources: [] },
      bloodFeudMemo: [],
      causalChain: [],
      accidentCooldown: 0,
      inWorldMinutes: 0,
      lastTimeCheckRound: 0,
      lastEvolveRound: -1,
      driveMode: 'ai',
      memories: [],
      chapterSummaries: [],
      volumeSummaries: [],
      emotionMap: {},
      lastInjection: null,
      lastUpdated: {}
    };
  }

  function getChatId() {
    try {
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (ctx && ctx.chatId) return ctx.chatId;
      if (typeof chat_id !== 'undefined' && chat_id) return chat_id;
      const urlParams = new URLSearchParams(window.location.search);
      const chatParam = urlParams.get('chat');
      if (chatParam) return chatParam;
    } catch(e) {}
    return 'default';
  }

  // Gộp phòng ngự: Đảm bảo toàn bộ trường mảng đều tồn tại
  function ensureArrays(state) {
    state.memories = state.memories || [];
    state.chapterSummaries = state.chapterSummaries || [];
    state.volumeSummaries = state.volumeSummaries || [];
    state.emotionMap = state.emotionMap || {};
    state.events = state.events || [];
    state.factions = state.factions || [];
    state.factionRelations = state.factionRelations || [];
    state.rumors = state.rumors || [];
    state.bloodFeudMemo = state.bloodFeudMemo || [];
    state.causalChain = state.causalChain || [];
    state.reputation = state.reputation || { jianghu: 'Vô danh', official: 'Vô danh', folk: 'Vô danh', underworld: 'Vô danh' };
    state.economy = state.economy || { marketTrend: 'Bình ổn', fundsStatus: 'Eo hẹp', keyResources: [] };
    state.lastInjection = state.lastInjection || null;
    state.inWorldMinutes = state.inWorldMinutes || 0;
    if (state.lastTimeCheckRound === undefined) state.lastTimeCheckRound = 0;
    if (state.lastEvolveRound === undefined) state.lastEvolveRound = -1;
    if (!state.driveMode) state.driveMode = 'ai';
    return state;
  }

  function loadState() {
    const chatId = getChatId();
    const key = STORAGE_PREFIX + chatId;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        const def = getDefaultState();
        const merged = { ...def, ...saved };
        merged.memories = saved.memories || [];
        merged.chapterSummaries = saved.chapterSummaries || [];
        merged.volumeSummaries = saved.volumeSummaries || [];
        merged.emotionMap = saved.emotionMap || {};
        merged.lastInjection = saved.lastInjection || null;
        // Bổ sung addedRound cho lưu ngôn cũ (nếu bị thiếu)
        if (merged.rumors) {
          for (let i = 0; i < merged.rumors.length; i++) {
            if (!merged.rumors[i].addedRound) merged.rumors[i].addedRound = merged.round;
            if (!merged.rumors[i].heatLevel) merged.rumors[i].heatLevel = merged.rumors[i].heat || 'Trung';
          }
        }
        return ensureArrays(merged);
      } catch(e) { console.warn(e); }
    }
    return ensureArrays(getDefaultState());
  }

  function saveState(state) {
    const chatId = getChatId();
    const key = STORAGE_PREFIX + chatId;
    state.lastUpdated = { chatId, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(state));
  }

  function addMemory(state, memory) {
    if (!state) return;
    if (memory.type === 'round') {
      state.memories.unshift(memory);
      if (state.memories.length > 500) state.memories.pop();
    } else if (memory.type === 'chapter_summary') {
      state.chapterSummaries.unshift(memory);
      if (state.chapterSummaries.length > 50) state.chapterSummaries.pop();
    } else if (memory.type === 'volume_summary') {
      state.volumeSummaries.unshift(memory);
      if (state.volumeSummaries.length > 20) state.volumeSummaries.pop();
    }
    saveState(state);
  }

  function updateEmotion(state, npc, attitude, level, reason) {
    if (!npc) return;
    if (!state.emotionMap) state.emotionMap = {};
    if (!state.emotionMap[npc]) {
      state.emotionMap[npc] = { attitude: 'Trung Lập', level: 'Người Lạ', reasons: [] };
    }
    if (attitude) {
      state.emotionMap[npc].attitude = attitude;
    } else if (attitude !== null) {
      // Bảo vệ rỗng: Nếu truyền null/undefined thì không cập nhật
    }
    if (level) {
      state.emotionMap[npc].level = level;
    }
    if (reason && !state.emotionMap[npc].reasons.includes(reason)) {
      state.emotionMap[npc].reasons.push(reason);
      if (state.emotionMap[npc].reasons.length > 10) {
        state.emotionMap[npc].reasons = state.emotionMap[npc].reasons.slice(-10);
      }
    }
    saveState(state);
  }

  // Tóm tắt nhanh trạng thái cảm xúc (dành cho bơm)
  function getEmotionSummary(state, limit = 5) {
    if (!state.emotionMap) return 'Không';
    const entries = Object.entries(state.emotionMap);
    // Sắp xếp theo cường độ thái độ: Thù Địch > Tín Nhiệm > Cảnh Giác > Trung Lập
    const attitudeOrder = { 'Thù Địch': 0, 'Bất Cộng Đái Thiên': 0, 'Cảnh Giác': 1, 'Tín Nhiệm': 2, 'Thân Thiện': 3, 'Hữu Hảo': 3, 'Trung Lập': 4 };
    entries.sort((a, b) => {
      const ao = attitudeOrder[a[1].attitude] ?? 5;
      const bo = attitudeOrder[b[1].attitude] ?? 5;
      return ao - bo;
    });
    return entries.slice(0, limit).map(([n, e]) => `${n}:${e.attitude}(${e.level})`).join(', ') || 'Không';
  }

  // Dọn dẹp định kỳ: Gỡ bỏ mảnh vỡ ký ức hết hạn độ quan trọng thấp
  function cleanupState(state) {
    if (!state.memories) return;
    const now = state.round;
    const before = state.memories.length;
    state.memories = state.memories.filter(m => {
      if (m.importance >= 3) return true;
      if (m.importance === 2) return now - m.round < 50;
      if (m.importance === 1) return now - m.round < 30;
      return true;
    });
    const after = state.memories.length;
    if (before !== after) {
      saveState(state);
      console.log(`[HTYQ Core] Dọn dẹp ký ức: ${before} → ${after} (Đã gỡ bỏ ${before - after} mục)`);
    }
  }

  // Sao chép liên chat: Sao chép trạng thái chat hiện tại sang chat đích (Dành cho Admin)
  function copyStateTo(targetChatId) {
    const sourceKey = STORAGE_PREFIX + getChatId();
    const raw = localStorage.getItem(sourceKey);
    if (!raw) return false;
    const targetKey = STORAGE_PREFIX + targetChatId;
    localStorage.setItem(targetKey, raw);
    return true;
  }

  // ========== Thêm nhanh Sự Kiện / Thế Lực / Lưu Ngôn ==========
  function addEvent(state, event) {
    if (!state.events) state.events = [];
    const idx = state.events.findIndex(e => e.name === event.name);
    if (idx !== -1) {
      state.events[idx] = { ...state.events[idx], ...event };
    } else {
      state.events.unshift(event);
    }
    if (state.events.length > 20) state.events.pop();
    saveState(state);
  }

  function addFaction(state, faction) {
    if (!state.factions) state.factions = [];
    const idx = state.factions.findIndex(f => f.name === faction.name);
    if (idx !== -1) {
      state.factions[idx] = { ...state.factions[idx], ...faction };
    } else {
      state.factions.unshift(faction);
    }
    if (state.factions.length > 15) state.factions.pop();
    saveState(state);
  }

  function addRumor(state, rumor) {
    if (!state.rumors) state.rumors = [];
    if (!rumor.addedRound) rumor.addedRound = state.round;
    if (!rumor.heatLevel) rumor.heatLevel = rumor.heat || 'Trung';
    state.rumors.unshift(rumor);
    if (state.rumors.length > 30) state.rumors.pop();
    saveState(state);
  }

  return {
    getDefaultState,
    getChatId,
    loadState,
    saveState,
    addMemory,
    updateEmotion,
    getEmotionSummary,
    cleanupState,
    copyStateTo,
    addEvent,
    addFaction,
    addRumor
  };
})();
