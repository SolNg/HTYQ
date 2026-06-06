// htyq-lite.js — Điểm vào: Tải động toàn bộ mô khối, khởi tạo, liên kết sự kiện, bơm API chính
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.1
//   - [Cường hóa Bug 1] onMessageReceived thêm lính gác chat.length<=2, lời dạo đầu không kích hoạt suy luận
//   - [Bug 4+5] Viết lại kiến trúc bơm: addOneMessage → registerInjection / extensionPrompts
//   - [Bug 1] Đóng băng chat mới: Không gọi onChatLoaded() ở cuối init() nữa, đổi thành tải lười worldbook
//   - [Bug 1] onChatLoaded thêm kiểm tra chat rỗng + đặt lại lastInjectedRound
//   - [Bug 6] Gọi ui.resetUI() trong onChatLoaded
//   - Thêm khóa chống re-entry window.__HTYQ_INJECTING__
//   - Tự động khôi phục giao diện khi quy trình suy luận gặp lỗi
// 2026-06-05 v2.2.0
//   - await tagsGen.generatePredictionTags (bất đồng bộ hóa) trong beforeMessageSend
//   - Phối hợp với cải tạo đường ống 4 lớp của hệ thống nhãn
// ============================================================

(function() {
  if (window.__HTYQ_LITE_LOADED__) return;

  const MODULES = [
    'htyq-lite-core.js',
    'htyq-lite-memory.js',
    'htyq-lite-tags.js',
    'htyq-lite-worldbook.js',
    'htyq-lite-inject.js',
    'htyq-lite-evolution.js',
    'htyq-lite-time.js',
    'htyq-lite-slash.js',
    'htyq-lite-ui.js'
  ];

  function getBaseUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('htyq-lite.js')) {
        return src.substring(0, src.lastIndexOf('/'));
      }
    }
    return './plugins/htyq-lite';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function showToast(message, isError = false, duration = 3000) {
    const id = 'htyq-lite-toast';
    let el = document.getElementById(id);
    if (el) el.remove();
    el = document.createElement('div');
    el.id = id;
    el.className = 'htyq-lite-toast' + (isError ? ' error' : '');
    el.innerText = message;
    document.body.appendChild(el);
    if (duration > 0) {
      setTimeout(() => el.remove(), duration);
    }
  }

  function showPersistToast(message, isError = false) {
    const id = 'htyq-lite-persist-toast';
    let el = document.getElementById(id);
    if (el) el.remove();
    el = document.createElement('div');
    el.id = id;
    el.className = 'htyq-lite-toast' + (isError ? ' error' : '');
    el.innerText = message;
    document.body.appendChild(el);
    return el;
  }

  function removePersistToast() {
    const el = document.getElementById('htyq-lite-persist-toast');
    if (el) el.remove();
  }

  // ========== Quản Lý Bơm (Tương thích kép registerInjection / extensionPrompts) ==========
  const INJECTION_NAME = 'htyq-lite-world';

  function unregisterInjection() {
    try {
      const ctx = SillyTavern.getContext();
      if (typeof ctx.unregisterInjection === 'function') {
        ctx.unregisterInjection(INJECTION_NAME);
      } else if (Array.isArray(ctx.extensionPrompts)) {
        ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
      }
    } catch(e) { /* 忽略 */ }
  }

  function registerInjection(content) {
    try {
      const ctx = SillyTavern.getContext();
      // Phương pháp 1: registerInjection (ST phiên bản mới, khuyến nghị)
      if (typeof ctx.registerInjection === 'function') {
        // Hủy đăng ký cái cũ trước rồi mới đăng ký cái mới
        if (typeof ctx.unregisterInjection === 'function') {
          ctx.unregisterInjection(INJECTION_NAME);
        }
        ctx.registerInjection(INJECTION_NAME, content, { position: 'before', priority: 10 });
        return true;
      }
      // Phương pháp 2: setExtensionPrompt (ST phiên bản trung)
      if (typeof ctx.setExtensionPrompt === 'function') {
        ctx.setExtensionPrompt(INJECTION_NAME, content, 'before', 10);
        return true;
      }
      // Phương pháp 3: Mảng extensionPrompts (ST phiên bản cũ, tương thích nhất)
      if (Array.isArray(ctx.extensionPrompts)) {
        ctx.extensionPrompts = ctx.extensionPrompts.filter(p => p.name !== INJECTION_NAME);
        ctx.extensionPrompts.push({
          name: INJECTION_NAME,
          content: content,
          role: 'system',
          position: 'before',
          priority: 10
        });
        return true;
      }
      // Phương pháp 4: generateOpts (Phiên bản cổ đại, chốt chặn)
      if (typeof ctx.generateOpts === 'object') {
        ctx.generateOpts.system_prompt = (ctx.generateOpts.system_prompt || '') + '\n\n' + content;
        return true;
      }
      console.warn('[HTYQ Lite] Tất cả phương thức bơm đều không khả dụng');
      return false;
    } catch (e) {
      console.error('[HTYQ Lite] Bơm thất bại', e);
      return false;
    }
  }

  async function init() {
    const baseUrl = getBaseUrl();
    console.log('[HTYQ Lite] Đường dẫn cơ sở tải về:', baseUrl);
    try {
      for (const mod of MODULES) {
        await loadScript(`${baseUrl}/${mod}`);
        console.log(`[HTYQ Lite] Đã tải: ${mod}`);
      }

      const core = window.HTYQ_LITE_CORE;
      const memory = window.HTYQ_LITE_MEMORY;
      const worldbook = window.HTYQ_LITE_WORLDBOOK;
      const tagsGen = window.HTYQ_LITE_TAGS;
      const evolution = window.HTYQ_LITE_EVOLUTION;
      const timeModule = window.HTYQ_LITE_TIME;
      const slash = window.HTYQ_LITE_SLASH;
      const ui = window.HTYQ_LITE_UI;
      const inject = window.HTYQ_LITE_INJECT;

      if (!ui || typeof ui.buildUI !== 'function') {
        throw new Error('Mô khối UI chưa được tải chính xác');
      }

      ui.buildUI();
      slash.registerCommands();

      let isEvolving = false;
      let lastInjectedRound = -1;
      let worldbookLoaded = false;  // Bug 1: Tải lười worldbook

      // ========== Bơm API Chính: Trước khi người dùng gửi tin nhắn (không bơm tin nhắn, dùng bơm prompt) ==========
      async function beforeMessageSend() {
        // Bug 5: Khóa chống re-entry
        if (window.__HTYQ_INJECTING__) return;
        window.__HTYQ_INJECTING__ = true;
        try {
          const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
          if (!ctx) return;
          const state = core.loadState();
          const currentRound = state.round;
          if (lastInjectedRound === currentRound) return;
          lastInjectedRound = currentRound;

          const chatHistory = ctx.chat || [];

          // Bug 1: Tải lười worldbook khi gửi lần đầu
          if (!worldbookLoaded) {
            worldbookLoaded = true;
            await worldbook.loadWorldbooks();
          }

          // v2.3.0: Kiểm tra chế độ lái — Chế độ thủ công kích hoạt suy luận theo khoảng thời gian
          const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
          const driveMode = state.driveMode || settings.driveMode || 'ai';
          const evolveInterval = parseInt(settings.evolveInterval, 10) || 10;
          if (driveMode === 'manual' && currentRound > 0 && currentRound % evolveInterval === 0) {
            const lastMsg = chatHistory[chatHistory.length - 1];
            const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
            const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';
            showPersistToast('⏳ Đang suy luận chế độ thủ công...');
            try {
              await evolution.evolve(state, userMsg, aiMsg);
              removePersistToast();
            } catch(e) {
              removePersistToast();
              console.warn('[HTYQ Lite] Suy luận chế độ thủ công thất bại', e);
            }
          }

          const tags = await tagsGen.generatePredictionTags(chatHistory, state);
          const context = await inject.buildContext(chatHistory, state, tags);

          // Lưu nội dung bơm cuối cùng để gỡ lỗi
          state.lastInjection = {
            timestamp: Date.now(),
            round: currentRound,
            context: context,
            tagsUsed: tags
          };
          core.saveState(state);
          if (window.HTYQ_LITE_UI && window.HTYQ_LITE_UI.refresh) window.HTYQ_LITE_UI.refresh();

          // Bug 4+5: Dùng bơm prompt thay vì addOneMessage, không làm bẩn lịch sử chat
          const success = registerInjection(context);
          if (success) {
            console.log(`[HTYQ Lite] Bơm thành công (round ${currentRound}, ${context.length} chars)`);
          } else {
            // Chốt chặn cuối cùng: Dùng addOneMessage (có đánh dấu tránh kích hoạt lặp)
            if (typeof ctx.addOneMessage === 'function') {
              const systemMessage = {
                mes: `🧠 **Ký Ức Thế Giới HTYQ Lite**\n${context}`,
                name: 'Hệ thống',
                is_system: true,
                send_date: new Date().toISOString(),
                is_user: false,
                extra: {},
                swipes: [],
                swiper_id: null,
                swipe_info: null,
              };
              ctx.addOneMessage(systemMessage);
            } else {
              console.warn('[HTYQ Lite] Không thể bơm ngữ cảnh');
            }
          }
        } finally {
          window.__HTYQ_INJECTING__ = false;
        }
      }

      // ========== Xử lý sau khi nhận tin nhắn (lưu ký ức, suy luận + v2.3.0 tiến triển thời gian) ==========
      async function onMessageReceived() {
        if (isEvolving) return;
        isEvolving = true;

        const persistToast = showPersistToast('🌍 Đang suy luận thế giới...');

        try {
          const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
          if (!ctx) { isEvolving = false; return; }
          const state = core.loadState();
          const chat = ctx.chat || [];
          if (chat.length === 0) { isEvolving = false; return; }

          // ★ 2026-06-05 Cường hóa Bug 1: Đóng băng chat mới, đợi người dùng và mô hình hoàn thành ít nhất 1 vòng tương tác rồi mới suy luận
          // chat.length: 1=lời dạo đầu của nhân vật, 2=người dùng gửi câu đầu tiên nhưng chưa nhận hồi đáp, 3=vòng tương tác hoàn chỉnh đầu tiên
          if (chat.length <= 2) {
            console.log('[HTYQ Lite] Đóng băng chat mới: Chờ vòng tương tác hoàn chỉnh đầu tiên (chat.length=' + chat.length + ')');
            isEvolving = false;
            removePersistToast();
            ui.refresh();
            return;
          }
          const lastMsg = chat[chat.length - 1];
          const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
          const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';

          // Lưu ký ức vòng này
          await memory.storeMemoryFromRound(state, userMsg, aiMsg, state.round);

          // Cưỡng chế kích hoạt chuỗi sự kiện + Huyết cừu truy sát
          evolution.forceTriggerEvents(state);
          evolution.advanceBloodFeud(state);

          const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
          let evolveSuccess = true;
          let evolveResult = null;
          const driveMode = state.driveMode || settings.driveMode || 'ai';
          // v2.3.0 Bugfix: Chế độ thủ công không kích hoạt tiến hóa ở đây (kích hoạt bởi beforeMessageSend theo chu kỳ)
          if (settings.autoEvolve !== false && driveMode !== 'manual') {
            // v2.3.0: Bắt kết quả tiến hóa để trích xuất timeEstimateMinutes
            // Nơi này nằm trong mô khối tiến hóa, API tiến hóa trả về đối tượng update
            // Do evolution.evolve gọi ngầm callEvolutionAPI, trả về giá trị boolean
            // Chúng ta lấy trạng thái mới nhất từ bản sao lưu phục hồi của state
            evolveSuccess = await evolution.evolve(state, userMsg, aiMsg);
            // Tải lại trạng thái để lấy dữ liệu mới nhất
            if (evolveSuccess) {
              const updatedState = core.loadState();
              evolveResult = updatedState.lastEvolveResult || null;
            }
          }

          // v2.3.0: Hệ thống tiến triển thời gian
          if (evolveSuccess && timeModule && typeof timeModule.calculateTimeIncrement === 'function') {
            const oldMinutes = state.inWorldMinutes || 0;
            const chatText = userMsg + ' ' + aiMsg;
            const increment = timeModule.calculateTimeIncrement(evolveResult, chatText, settings);
            state.inWorldMinutes = (state.inWorldMinutes || 0) + increment;
            state.lastTimeCheckRound = state.round;

            // Kiểm tra kích hoạt ngưỡng thời gian
            const triggered = timeModule.shouldTriggerEvents(oldMinutes, state.inWorldMinutes);
            if (triggered.includes('events')) {
              console.log('[HTYQ Lite] ⏰ Thời gian đạt đến ngưỡng kích hoạt chuỗi sự kiện');
            }
            if (triggered.includes('chapter')) {
              console.log('[HTYQ Lite] 📖 Thời gian đạt đến ngưỡng kích hoạt tóm tắt chương');
              // Lấy 10 vòng gần nhất trước vòng này làm phạm vi chương
              const startRound = Math.max(0, state.round - 9);
              await memory.mergeChapterSummary(state, startRound, state.round);
            }
            if (triggered.includes('volume')) {
              console.log('[HTYQ Lite] 📚 Thời gian đạt đến ngưỡng kích hoạt tóm tắt quyển');
              const startRound = Math.max(0, state.round - 49);
              await memory.mergeVolumeSummary(state, startRound, state.round);
            }

            core.saveState(state);
          } else {
            // Giáng cấp: Vẫn sử dụng vòng để kích hoạt tóm tắt khi không có mô khối thời gian
            if (evolveSuccess && state.round % 10 === 0 && state.round > 0) {
              await memory.mergeChapterSummary(state, state.round - 9, state.round);
            }
            if (evolveSuccess && state.round % 50 === 0 && state.round > 0) {
              await memory.mergeVolumeSummary(state, state.round - 49, state.round);
            }
          }

          removePersistToast();

          if (evolveSuccess) {
            showToast('✅ Suy luận thế giới hoàn tất');
          } else {
            showToast('⚠️ Suy luận thất bại, vòng không tăng', true);
          }
          ui.refresh();
        } catch (e) {
          console.error('[HTYQ Lite] Xử lý thất bại', e);
          removePersistToast();
          showToast(`Lỗi suy luận: ${e.message}`, true);
        } finally {
          isEvolving = false;
        }
      }

      async function onChatLoaded() {
        // Bug 1: Chat mới hoàn toàn, đóng băng mọi suy luận
        const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
        const chat = ctx?.chat || [];
        if (chat.length === 0) {
          const state = core.loadState();
          state.round = 0;
          core.saveState(state);
          // Chat mới: Không tải worldbook, chờ tải lười vào lần gửi đầu tiên
          worldbookLoaded = false;
        } else {
          await worldbook.loadWorldbooks();
          worldbookLoaded = true;
        }

        // Bug 1: Đặt lại liên chat
        lastInjectedRound = -1;
        // Bug 6: Đặt lại bảng điều khiển UI
        if (ui.resetUI) ui.resetUI();
        // Hủy đăng ký mũi tiêm cũ
        unregisterInjection();

        const state = core.loadState();
        ui.refresh();
        console.log('[HTYQ Lite] Đã tải chat, đồng bộ Thế Giới Thư hoàn tất');
      }

      function onMessageSwiped() {
        lastInjectedRound = -1;
        console.log('[HTYQ Lite] Phát hiện chuyển đổi tin nhắn, đã đặt lại cờ báo tiêm');
      }

      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (ctx && ctx.eventSource) {
        const messageSentEvent = ctx.event_types?.MESSAGE_SENT || 'message_sent';
        const messageReceivedEvent = ctx.event_types?.MESSAGE_RECEIVED || 'message_received';
        const chatLoadedEvent = ctx.event_types?.CHAT_LOADED || 'chat_loaded';
        const messageSwipedEvent = ctx.event_types?.MESSAGE_SWIPED || 'message_swiped';
        ctx.eventSource.on(messageSentEvent, beforeMessageSend);
        ctx.eventSource.on(messageReceivedEvent, onMessageReceived);
        ctx.eventSource.on(chatLoadedEvent, onChatLoaded);
        if (messageSwipedEvent) {
          ctx.eventSource.on(messageSwipedEvent, onMessageSwiped);
        } else {
          const messageEditedEvent = ctx.event_types?.MESSAGE_EDITED || 'message_edited';
          ctx.eventSource.on(messageEditedEvent, onMessageSwiped);
        }
        console.log('[HTYQ Lite] Liên kết sự kiện thành công');
      } else {
        console.warn('[HTYQ Lite] Không thể liên kết sự kiện, tự động suy luận và tiêm không khả dụng');
      }

      // Bug 1: Không gọi onChatLoaded() ở cuối init() nữa, chờ sự kiện CHAT_LOADED kích hoạt
      window.__HTYQ_LITE_LOADED__ = true;
    } catch (err) {
      console.error('[HTYQ Lite] Khởi tạo thất bại', err);
    }
  }

  init();
})();
