// htyq-lite-slash.js — Đăng ký lệnh Slash (Bản hoàn chỉnh v2.1.0)
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.0
//   - Thêm lệnh /world (Chuyển đổi bảng, Trạng thái, Suy luận thủ công)
//   - Thêm lệnh /memory (Triệu hồi, Tóm tắt, Thống kê)
//   - Thêm lệnh /htyq status (Tổng hợp trạng thái)
//   - Thêm lệnh /htyq evolve (Biến thể suy luận thủ công)
//   - Tăng cường gợi ý lỗi và hướng dẫn sử dụng
//   - Tương thích giao diện đăng ký slash của ST phiên bản mới và cũ
// ============================================================

window.HTYQ_LITE_SLASH = (function() {
  const core = window.HTYQ_LITE_CORE;
  const memory = window.HTYQ_LITE_MEMORY;
  const evolution = window.HTYQ_LITE_EVOLUTION;
  const ui = window.HTYQ_LITE_UI;

  // ========== /world ==========
  async function handleWorld(args) {
    const state = core.loadState();
    if (args === 'status') {
      const eventsActive = state.events.filter(e => e.status !== '已爆发').length;
      const eventsErupted = state.events.filter(e => e.status === '已爆发').length;
      return `🌍 **Trạng Thái Thế Giới**\nVòng: ${state.round}\nTóm Tắt: ${state.worldDigest}\nDanh Vọng: Giang Hồ「${state.reputation.jianghu}」 Quan Phủ「${state.reputation.official}」\nChuỗi Sự Kiện: ${eventsActive} Đang Hoạt Động / ${eventsErupted} Đã Bùng Nổ\nHuyết Cừu: ${state.bloodFeudMemo.length}\nKý Ức: ${state.memories.length} Mục / ${state.chapterSummaries.length} Tóm Tắt Chương / ${state.volumeSummaries.length} Tóm Tắt Quyển\nThực Thể Cảm Xúc: ${Object.keys(state.emotionMap).length}`;
    } else if (args === 'evolve' || args === '') {
      // Suy luận thủ công
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      const lastMsg = ctx?.chat?.[ctx.chat.length - 1];
      const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
      const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';
      const success = await evolution.evolve(state, userMsg, aiMsg);
      if (ui && ui.refresh) ui.refresh();
      return success ? '🔄 Suy luận thủ công đã kích hoạt, thế giới tiến lên 1 vòng' : '❌ Suy luận thủ công thất bại, trạng thái thế giới không đổi';
    } else if (args === 'toggle') {
      if (ui && ui.togglePanel) {
        ui.togglePanel();
        return 'Đã chuyển đổi bảng điều khiển';
      }
      return 'Mô khối UI chưa tải';
    } else {
      return `🌍 **Cách Dùng /world**\n/world — Suy luận thủ công 1 vòng\n/world status — Hiển thị trạng thái thế giới\n/world evolve — Suy luận thủ công\n/world toggle — Chuyển đổi bảng điều khiển`;
    }
  }

  // ========== /memory ==========
  async function handleMemory(args) {
    const state = core.loadState();
    if (!args || args === 'help') {
      return `📚 **Cách Dùng /memory**\n/memory recall <Từ Khóa> — Triệu hồi ký ức theo nhãn\n/memory search <Từ Khóa> — Tìm kiếm thông minh (Giống recall)\n/memory summarize — Gộp tóm tắt chương 10 vòng gần nhất\n/memory stats — Thống kê ký ức`;
    }
    if (args.startsWith('recall ') || args.startsWith('search ')) {
      const keyword = args.includes(' ') ? args.slice(args.indexOf(' ') + 1).trim() : '';
      if (!keyword) return 'Vui lòng cung cấp từ khóa, ví dụ: /memory recall Trương Tam';
      const tags = [keyword];
      const recalled = memory.recallMemories(state, tags, 10);
      if (recalled.length === 0) return 'Không tìm thấy ký ức liên quan';
      let result = '📖 **Ký Ức Liên Quan**\n';
      for (const m of recalled) {
        result += `[Vòng ${m.round}] [★${'★'.repeat(Math.min(3, m.importance))}] ${m.summary}\n`;
      }
      return result;
    } else if (args === 'summarize') {
      const lastRound = state.round;
      const start = Math.max(1, lastRound - 9);
      await memory.mergeChapterSummary(state, start, lastRound);
      return `📚 Đã gộp tóm tắt chương từ vòng ${start}-${lastRound}`;
    } else if (args === 'stats') {
      return `📊 **Thống Kê Ký Ức**\nKý Ức Gốc: ${state.memories.length} Mục\nTóm Tắt Chương: ${state.chapterSummaries.length} Chương\nTóm Tắt Quyển: ${state.volumeSummaries.length} Quyển\nThực Thể Cảm Xúc: ${Object.keys(state.emotionMap).length} Thực Thể\nVòng Hiện Tại: ${state.round}`;
    } else {
      return handleMemory('help');
    }
  }

  // ========== /htyq ==========
  async function handleHtyq(args) {
    if (!args || args === 'help') {
      return `🧠 **Danh Sách Lệnh HTYQ Lite**\n/world — Liên quan đến suy luận thế giới\n/memory — Quản lý ký ức\n/htyq status — Hiển thị trạng thái tổng thể\n/htyq evolve — Suy luận thủ công\n/htyq reload — Khởi động lại plugin`;
    }
    if (args === 'status') {
      return await handleWorld('status');
    }
    if (args === 'evolve') {
      return await handleWorld('evolve');
    }
    if (args === 'reload') {
      window.__HTYQ_LITE_LOADED__ = false;
      window.location.reload();
      return 'Đang tải lại...';
    }
    return handleHtyq('help');
  }

  // ========== Đăng Ký ==========
  function registerCommands() {
    const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
    if (!ctx) {
      console.warn('[HTYQ Lite] Không thể lấy context, lệnh slash chưa được đăng ký');
      return;
    }
    if (ctx.slashCommand && typeof ctx.slashCommand.register === 'function') {
      ctx.slashCommand.register('world', handleWorld);
      ctx.slashCommand.register('memory', handleMemory);
      ctx.slashCommand.register('htyq', handleHtyq);
      console.log('[HTYQ Lite] Lệnh slash đã đăng ký (/world, /memory, /htyq)');
    } else if (typeof registerSlashCommand === 'function') {
      registerSlashCommand('world', handleWorld);
      registerSlashCommand('memory', handleMemory);
      registerSlashCommand('htyq', handleHtyq);
    } else {
      console.warn('[HTYQ Lite] Không tìm thấy giao diện đăng ký lệnh slash');
    }
  }

  return { registerCommands };
})();
