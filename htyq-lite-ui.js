// htyq-lite-ui.js — Mô đun UI (Bảng điều khiển + 5 góc nhìn) - v2.3.0 Làm mới Morandi Engine
// ============================================================
// ★ Nhật Ký Sửa Đổi ★
// 2026-06-05 v2.1.0
//   - [Bug 2] Thêm phím ESC để đóng bảng điều khiển
//   - [Bug 2] Thêm click ngoài bảng điều khiển để đóng (chỉ desktop)
//   - [Bug 2] Thêm sự kiện resize, tự động điều chỉnh theo kích thước cửa sổ
//   - [Bug 6] Thêm hàm resetUI(): đặt lại trạng thái bảng điều khiển
//   - Tối ưu logic hiển thị/ẩn bảng điều khiển, thống nhất quản lý sự kiện
//
// 2026-06-05 v2.1.1 (Làm mới UI)
//   - Chế độ di động thêm thanh chỉ báo kéo + nút đóng
//   - Loại bỏ toàn bộ inline style trong buildUI (màu sắc/nền/padding)
//   - Loại bỏ inline background của nút trong renderOverview
//   - Loại bỏ inline style lặp lại trong renderSettings
//   - Nút suy diễn thủ công thêm disabled để tránh click lặp lại
//   - Hộp tìm kiếm ký ức box-sizing: border-box đã tồn tại, xác nhận không lỗi
//
// 2026-06-05 v2.2.0 (Cải thiện UI desktop)
//   - renderOverview thêm khu vực xem trước injection + hiển thị nhãn theo thời gian thực
//   - renderMemory thẻ ký ức sử dụng màu phân cấp độ quan trọng
//   - Thêm tương tác gập/mở thẻ (desktop click h4)
//   - Thêm hàm hỗ trợ: getImportanceClass / renderTagsHtml / renderInjectionPreview / getTagType
//
// 2026-06-05 v2.3.0 (Engine Tab + Hiển thị thời gian)
//   - buildUI: Tab từ 4 đổi thành 5, thêm engine Tab
//   - Thêm hàm renderEngine(): hiển thị 4 khu vực (Chế độ truyền động/Thông số thủ công/Trạng thái hiện tại/Công cụ gỡ lỗi)
//   - renderOverview: Thêm thanh hiển thị thời gian thế giới ở trên cùng
//   - Logic chuyển chế độ: Thời gian do AI điều khiển vs Chế độ thủ công
//   - Nút bật/tắt từ khóa sẽ ẩn ở chế độ AI
// ============================================================

window.HTYQ_LITE_UI = (function() {
  const core = window.HTYQ_LITE_CORE;
  const memory = window.HTYQ_LITE_MEMORY;
  const evolution = window.HTYQ_LITE_EVOLUTION;
  const worldbook = window.HTYQ_LITE_WORLDBOOK;
  const timeModule = window.HTYQ_LITE_TIME;
  let panelVisible = false;
  let currentTab = 'overview';
  let panelElement = null;
  let globalKeyHandler = null;      // ESC 监听器引用
  let globalClickHandler = null;    // 外部点击监听器引用
  let globalResizeHandler = null;   // resize 监听器引用

  // ---------- Hàm hỗ trợ toast bền vững ----------
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

  function showTempToast(message, isError = false, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'htyq-lite-toast' + (isError ? ' error' : '');
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // ---------- Hàm hiển thị ----------
  function getRecentMemories(state, limit = 20) {
    return [...state.memories].sort((a,b) => b.round - a.round).slice(0, limit);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  // ---------- Phân loại độ quan trọng ký ức ----------
  function getImportanceClass(importance) {
    if (importance >= 5) return 'htyq-lite-memory-imp-5';
    if (importance >= 4) return 'htyq-lite-memory-imp-4';
    if (importance >= 3) return 'htyq-lite-memory-imp-3';
    return 'htyq-lite-memory-imp-1';
  }

  // ---------- Phát hiện loại nhãn (dự phòng cục bộ) ----------
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

  // ---------- Hiển thị nhãn thành HTML màu ----------
  function renderTagsHtml(tags) {
    if (!tags || tags.length === 0) return '<span class="htyq-lite-empty">Chưa có nhãn</span>';
    const tagsGen = window.HTYQ_LITE_TAGS;
    const typeFn = (tagsGen && typeof tagsGen.getTagType === 'function') ? tagsGen.getTagType : getTagType;
    return tags.map(tag => {
      const type = typeFn(tag);
      return `<span class="htyq-tag htyq-tag-${type}">${escapeHtml(tag)}</span>`;
    }).join('');
  }

  // ---------- Hiển thị xem trước injection ----------
  function renderInjectionPreview(lastInjection) {
    if (!lastInjection) {
      return '<div class="htyq-lite-empty">Chưa có bản ghi injection, đợi sau đối thoại lượt tiếp theo để làm mới.</div>';
    }
    const context = lastInjection.context || '';
    const tagsUsed = lastInjection.tagsUsed || [];
    
    // Tách phần đầu (Tóm Tắt) và phần sau (Thế giới thư) để render đẹp hơn
    let formattedContext = escapeHtml(context);
    // Tô đậm các tiêu đề ngoặc vuông
    formattedContext = formattedContext.replace(/【(.*?)】/g, '<strong style="color:var(--text-accent); display:block; margin-top:8px;">【$1】</strong>');
    
    return `
      <div class="htyq-injection-meta">
        <span>📌 Lượt ${lastInjection.round}</span>
        <span>📐 ${context.length} ký tự</span>
        <span>🕐 ${new Date(lastInjection.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="htyq-tag-container">${renderTagsHtml(tagsUsed)}</div>
      <div class="htyq-injection-preview-text" style="white-space: pre-wrap; line-height: 1.5; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">${formattedContext.substring(0, 300)}${context.length > 300 ? '...' : ''}</div>
      ${context.length > 300 ? `<span class="htyq-injection-detail-toggle" data-expand-injection>▶ Mở Rộng Tất Cả</span><div class="htyq-injection-preview-text" style="display:none; white-space: pre-wrap; line-height: 1.5; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">${formattedContext}</div>` : ''}
    `;
  }

  // ---------- HTML hiển thị thời gian thế giới ----------
  function renderWorldTimeBar(state) {
    const driveMode = state.driveMode || 'ai';
    const timeModule = window.HTYQ_LITE_TIME;
    const timeStr = timeModule && typeof timeModule.formatWorldTime === 'function'
      ? timeModule.formatWorldTime(state.inWorldMinutes || 0)
      : `${state.inWorldMinutes || 0} phút`;

    if (driveMode === 'manual') {
      return `<div class="htyq-world-time-bar htyq-time-sealed">
        <span class="htyq-time-icon">🔒</span>
        <span class="htyq-time-label">Thời Gian Thế Giới (Đã Phong Ấn)</span>
        <span class="htyq-time-value">${timeStr}</span>
      </div>`;
    }
    return `<div class="htyq-world-time-bar">
      <span class="htyq-time-icon">⏳</span>
      <span class="htyq-time-label">Thời Gian Thế Giới</span>
      <span class="htyq-time-value">${timeStr}</span>
    </div>`;
  }

  // ========== renderOverview ==========
  function renderOverview(container, state) {
    if (!container) return;
    const rep = state.reputation;
    const currentTags = state.lastInjection?.tagsUsed || [];
    const tagsHtml = renderTagsHtml(currentTags);
    const injectionHtml = renderInjectionPreview(state.lastInjection);
    const timeBarHtml = renderWorldTimeBar(state);

    container.innerHTML = `
      ${timeBarHtml}
      <div class="htyq-lite-card"><h4>📊 Vòng</h4><div>${window.HTYQ_LITE_CORE.getActualRoundCount()}</div></div>
      <div class="htyq-lite-card"><h4>🏷️ Nhãn Hiện Tại</h4><div class="htyq-tag-container">${tagsHtml}</div></div>
      <div class="htyq-lite-card"><h4>🌍 Tóm Tắt Thế Giới</h4><div>${escapeHtml(state.worldDigest)}</div></div>
      <div class="htyq-lite-card"><h4>⭐ Danh Tiếng</h4><div>Giang Hồ:${rep.jianghu} Quan Phủ:${rep.official}<br>Dân Gian:${rep.folk} Hắc Đạo:${rep.underworld}</div></div>
      <div class="htyq-lite-card"><h4>⚡ Sự Kiện Gần Đây</h4><ul>${state.events.slice(0,3).map(e => `<li>${escapeHtml(e.name)} (${e.stage})</li>`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🩸 Sổ Tay Huyết Cừu</h4><ul>${state.bloodFeudMemo.map(b => `<li>${escapeHtml(b.faction)} - ${b.status}</li>`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🧠 Tóm Tắt Cảm Xúc</h4><ul>${Object.entries(state.emotionMap).slice(0,5).map(([n, e]) => `<li>${escapeHtml(n)}: ${e.attitude} (${e.level})</li>`).join('') || '<li>Không</li>'}</ul></div>
      <button id="htyq-manual-evolve" class="htyq-lite-btn htyq-lite-btn-purple">🌀 Suy Diễn Thủ Công 1 Vòng</button>
      <div class="htyq-lite-card"><h4>📝 Xem Trước Injection Hiện Tại</h4><div id="htyq-injection-preview">${injectionHtml}</div></div>
    `;
    const evolveBtn = container.querySelector('#htyq-manual-evolve');
    if (evolveBtn) {
      evolveBtn.addEventListener('click', async () => {
        const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
        const state = core.loadState();
        const lastMsg = ctx?.chat?.[ctx.chat.length - 1];
        const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';

        evolveBtn.disabled = true;
        evolveBtn.textContent = '⏳ Đang suy diễn...';
        const persistToast = showPersistToast('🌍 Thế giới đang suy diễn...');
        try {
          const success = await evolution.evolve(state, userMsg, aiMsg);
          removePersistToast();
          if (success) {
            showTempToast('✅ Suy diễn thủ công hoàn tất');
          } else {
            showTempToast('❌ Suy diễn thủ công thất bại, trạng thái không đổi', true);
          }
        } catch (err) {
          removePersistToast();
          showTempToast(`Lỗi suy diễn: ${err.message}`, true);
        }
        evolveBtn.disabled = false;
        evolveBtn.innerHTML = '🌀 Suy Diễn Thủ Công 1 Vòng';
        refresh();
      });
    }

    const expandBtn = container.querySelector('[data-expand-injection]');
    if (expandBtn) {
      expandBtn.addEventListener('click', function() {
        const detailDiv = this.nextElementSibling;
        if (detailDiv && detailDiv.classList.contains('htyq-injection-preview-text')) {
          detailDiv.style.display = 'block';
          this.style.display = 'none';
        }
      });
    }
  }

  // ========== renderWorld ==========
  function renderWorld(container, state) {
    if (!container) return;
    let relationsHtml = '';
    if (state.factionRelations && state.factionRelations.length > 0) {
      relationsHtml = '<ul>';
      for (const rel of state.factionRelations) {
        relationsHtml += `<li>${escapeHtml(rel.factionA)} ↔ ${escapeHtml(rel.factionB)}: ${escapeHtml(rel.relation)} (Cấp ${rel.level || '?'}), Xu Hướng: ${rel.trend || 'Ổn Định'}</li>`;
      }
      relationsHtml += '</ul>';
    } else {
      relationsHtml = '<li>Không</li>';
    }

    const rumorsHtml = state.rumors.map(r => {
      let heatIcon = '';
      const heat = r.heatLevel || r.heat || '中';
      if (heat === '热' || heat === '高') heatIcon = '🔥';
      else if (heat === '中') heatIcon = '⭐';
      else if (heat === '低') heatIcon = '🌿';
      else heatIcon = '❄️';
      return `<li>${heatIcon} ${escapeHtml(r.content)} — Độ Tin Cậy: ${r.credibility || 'Trung Bình'} Nhiệt Độ: ${heat}</li>`;
    }).join('') || '<li>Không</li>';

    container.innerHTML = `
      <div class="htyq-lite-card"><h4>🔥 Chuỗi Sự Kiện</h4><ul>${state.events.map(e => `<li>${escapeHtml(e.name)} Lv.${e.level} ${e.stage} (${e.currentRound}/${e.totalRounds})</li>`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🏛️ Thế Lực</h4><ul>${state.factions.map(f => `<li>${escapeHtml(f.name)} - Đoàn Kết: ${f.cohesion} Tài Nguyên: ${f.resources}</li>`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🤝 Quan Hệ Thế Lực</h4>${relationsHtml}</div>
      <div class="htyq-lite-card"><h4>🗣️ Tin Đồn</h4><ul>${rumorsHtml}</ul></div>
      <div class="htyq-lite-card"><h4>🔗 Chuỗi Nhân Quả</h4><ul>${state.causalChain.map(c => `<li>${escapeHtml(c.event)}: ${c.progress} → ${c.manifestation || ''}</li>`).join('') || '<li>Không</li>'}</ul></div>
    `;
  }

  // ========== renderMemory ==========
  function renderMemory(container, state) {
    if (!container) return;
    container.innerHTML = '';
    const statsDiv = document.createElement('div');
    statsDiv.className = 'htyq-memory-stats';
    statsDiv.innerHTML = `
      <strong>📚 Thống Kê Ký Ức</strong><br>
      Ký Ức Gốc: ${ (state.memories || []).length }<br>
      Tóm Tắt Chương: ${ (state.chapterSummaries || []).length }<br>
      Tóm Tắt Quyển: ${ (state.volumeSummaries || []).length }<br>
      Thực Thể Cảm Xúc: ${ Object.keys(state.emotionMap || {}).length }
    `;
    container.appendChild(statsDiv);

    const searchInput = document.createElement('input');
    searchInput.placeholder = 'Tìm Kiếm Ký Ức (Từ Khóa)...';
    searchInput.className = 'htyq-lite-search';
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'htyq-memory-results';

    function displayRecent() {
      const recent = getRecentMemories(state, 20);
      if (recent.length === 0) {
        resultsDiv.innerHTML = '<div class="htyq-lite-empty">Chưa có ký ức, tự động tạo sau đối thoại</div>';
        return;
      }
      resultsDiv.innerHTML = recent.map(m => `
        <div class="htyq-lite-memory-item ${getImportanceClass(m.importance)}">
          <div class="memory-summary"><strong>[Lượt ${m.round}] [Độ Quan Trọng ${'★'.repeat(Math.min(3, m.importance))}]</strong> ${escapeHtml(m.summary)}</div>
          <small>Nhãn: Thực Thể ${(m.tags.entities || []).join(',') || 'Không'} | Chủ Đề ${(m.tags.topics || []).join(',') || 'Không'}</small>
          ${m.context ? `<details><summary>📄 Chi Tiết</summary><pre>${escapeHtml(m.context)}</pre></details>` : ''}
        </div>
      `).join('');
    }

    async function search() {
      const keyword = searchInput.value.trim();
      if (!keyword) {
        displayRecent();
        return;
      }
      const tags = [keyword];
      const recalled = memory.recallMemories(state, tags, 30);
      if (recalled.length === 0) {
        resultsDiv.innerHTML = '<div class="htyq-lite-empty">Không tìm thấy ký ức liên quan</div>';
        return;
      }
      resultsDiv.innerHTML = recalled.map(m => `
        <div class="htyq-lite-memory-item ${getImportanceClass(m.importance)}">
          <div class="memory-summary"><strong>[Lượt ${m.round}] [Độ Quan Trọng ${'★'.repeat(Math.min(3, m.importance))}]</strong> ${escapeHtml(m.summary)}</div>
          <small>Nhãn: Thực Thể ${(m.tags.entities || []).join(',') || 'Không'}</small>
          ${m.context ? `<details><summary>📄 Chi Tiết</summary><pre>${escapeHtml(m.context)}</pre></details>` : ''}
        </div>
      `).join('');
    }

    searchInput.addEventListener('input', search);
    container.appendChild(searchInput);
    container.appendChild(resultsDiv);
    displayRecent();
  }

  // ========== renderSettings ==========
  function renderSettings(container) {
    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    const apiMode = settings.apiMode || 'tavern';
    const worldbookCache = worldbook.getCache ? worldbook.getCache() : [];
    const lastLoad = worldbook.getLastLoadTime ? worldbook.getLastLoadTime() : null;
    const customEntities = settings.customEntities || '';

    container.innerHTML = `
      <div class="htyq-lite-card">
        <h4>⚙️ Cài Đặt API Tiến Hóa</h4>
        <div class="htyq-lite-input-group">
          <label>Chế Độ API</label>
          <select id="htyq-api-mode">
            <option value="tavern" ${apiMode === 'tavern' ? 'selected' : ''}>Sử Dụng API Của Tavern</option>
            <option value="custom" ${apiMode === 'custom' ? 'selected' : ''}>API Tùy Chỉnh</option>
          </select>
        </div>
        <div id="htyq-custom-group" style="display: ${apiMode === 'custom' ? 'block' : 'none'};">
          <div class="htyq-lite-input-group"><label>URL API</label><input type="text" id="htyq-evolve-url" value="${settings.customUrl || ''}"></div>
          <div class="htyq-lite-input-group"><label>API Key</label><input type="password" id="htyq-evolve-key" value="${settings.customKey || ''}"></div>
          <div class="htyq-lite-input-group"><label>Tên Mô Hình</label><input type="text" id="htyq-evolve-model" value="${settings.customModel || ''}"></div>
          <button id="htyq-fetch-models" class="htyq-lite-btn">Lấy Danh Sách Mô Hình</button>
          <select id="htyq-model-list" style="display:none; margin-top:8px;"></select>
        </div>
        <div class="htyq-lite-input-group">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="htyq-auto-evolve" ${settings.autoEvolve !== false ? 'checked' : ''}>
            <span>Tự Động Tiến Hóa (sau mỗi lượt AI trả lời)</span>
          </label>
        </div>
        <div class="htyq-lite-input-group">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="htyq-smart-tagging" ${settings.smartTagging !== false ? 'checked' : ''}>
            <span>Tạo Tóm Tắt Thông Minh (sử dụng mô hình chính, chính xác hơn)</span>
          </label>
        </div>
        <div class="htyq-lite-input-group">
          <label>Thực Thể Tùy Chỉnh (phân cách bằng dấu phẩy)</label>
          <input type="text" id="htyq-custom-entities" value="${escapeHtml(customEntities)}" placeholder="Ví dụ: Lâm Nguyệt Như, Lý Tiêu Dao, Thục Sơn Phái">
          <small>Gợi ý: Thực thể tùy chỉnh sẽ được thêm vào nhãn do AI trích xuất, tăng độ chính xác của triệu hồi ký ức.</small>
        </div>
        <button id="htyq-save-settings" class="htyq-lite-btn">Lưu Cài Đặt</button>
      </div>
      <div class="htyq-lite-card">
        <h4>📖 Chẩn Đoán Thế Giới Thư</h4>
        <div>Tổng Số Mục: ${worldbookCache.length}</div>
        <div>Lần Đồng Bộ Cuối: ${lastLoad ? lastLoad.toLocaleTimeString() : 'Chưa đồng bộ'}</div>
        <button id="htyq-reload-worldbook" class="htyq-lite-btn">Tải Lại Thế Giới Thư</button>
      </div>
      <div class="htyq-lite-card">
        <h4>🔍 Gỡ Lỗi Injection</h4>
        <textarea id="htyq-last-injection-textarea" style="width: 100%; min-height: 200px; padding: 8px; font-family: monospace; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; resize: vertical;" placeholder="Chưa có bản ghi injection..."></textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="htyq-refresh-injection" class="htyq-lite-btn">Làm Mới</button>
          <button id="htyq-save-injection" class="htyq-lite-btn htyq-lite-btn-purple">Cập Nhật Bơm Lại</button>
        </div>
      </div>
      <div class="htyq-lite-card">
        <h4>📁 Quản Lý Dữ Liệu</h4>
        <button id="htyq-reset-world" class="htyq-lite-btn htyq-lite-btn-danger">Reset Thế Giới Trò Chuyện Hiện Tại</button>
      </div>
    `;

    const apiSelect = container.querySelector('#htyq-api-mode');
    const customGroup = container.querySelector('#htyq-custom-group');
    if (apiSelect) {
      apiSelect.addEventListener('change', (e) => {
        customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
      });
    }
    const fetchBtn = container.querySelector('#htyq-fetch-models');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', async () => {
        const url = container.querySelector('#htyq-evolve-url')?.value.trim();
        const key = container.querySelector('#htyq-evolve-key')?.value.trim();
        if (!url) { alert('Vui lòng điền URL API'); return; }
        const fetchUrl = url.replace(/\/$/, '') + (url.endsWith('/v1') ? '/models' : '/v1/models');
        try {
          const resp = await fetch(fetchUrl, { headers: { 'Authorization': `Bearer ${key}` } });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data.data && Array.isArray(data.data)) {
            const select = container.querySelector('#htyq-model-list');
            select.innerHTML = '<option value="">-- Chọn Mô Hình --</option>';
            data.data.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m.id;
              opt.textContent = m.id;
              select.appendChild(opt);
            });
            select.style.display = 'block';
            select.onchange = () => {
              const modelInput = container.querySelector('#htyq-evolve-model');
              if (modelInput) modelInput.value = select.value;
            };
            alert(`Lấy được ${data.data.length} mô hình`);
          } else { alert('Không thể phân tích danh sách mô hình'); }
        } catch(e) { alert('Lấy danh sách mô hình thất bại: ' + e.message); }
      });
    }
    const saveBtn = container.querySelector('#htyq-save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const newSettings = {
          apiMode: apiSelect.value,
          customUrl: container.querySelector('#htyq-evolve-url')?.value || '',
          customKey: container.querySelector('#htyq-evolve-key')?.value || '',
          customModel: container.querySelector('#htyq-evolve-model')?.value || '',
          autoEvolve: container.querySelector('#htyq-auto-evolve')?.checked || false,
          smartTagging: container.querySelector('#htyq-smart-tagging')?.checked || false,
          customEntities: container.querySelector('#htyq-custom-entities')?.value || ''
        };
        const engineSettings = readEngineSettings();
        Object.assign(newSettings, engineSettings);
        localStorage.setItem('htyq_lite_settings', JSON.stringify(newSettings));
        alert('Đã lưu cài đặt');
      });
    }
    const reloadBtn = container.querySelector('#htyq-reload-worldbook');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', async () => {
        await worldbook.loadWorldbooks();
        alert(`Thế giới thư đã được tải lại, tổng cộng ${worldbook.getCache().length} mục`);
        renderSettings(container);
      });
    }
    const refreshInjection = container.querySelector('#htyq-refresh-injection');
    const saveInjectionBtn = container.querySelector('#htyq-save-injection');
    const injectionTextarea = container.querySelector('#htyq-last-injection-textarea');
    
    if (refreshInjection && injectionTextarea) {
      const showInjection = () => {
        const state = window.HTYQ_LITE_CORE.loadState();
        if (state.lastInjection && state.lastInjection.context) {
          injectionTextarea.value = state.lastInjection.context;
        } else {
          injectionTextarea.value = '';
        }
      };
      refreshInjection.addEventListener('click', showInjection);
      
      if (saveInjectionBtn) {
        saveInjectionBtn.addEventListener('click', () => {
          const state = window.HTYQ_LITE_CORE.loadState();
          if (state.lastInjection) {
            state.lastInjection.context = injectionTextarea.value;
            window.HTYQ_LITE_CORE.saveState(state);
            alert('Đã cập nhật nội dung injection thủ công!');
          } else {
            alert('Chưa có injection state để cập nhật.');
          }
        });
      }
      showInjection();
    }
    const resetBtn = container.querySelector('#htyq-reset-world');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset tất cả trạng thái thế giới và ký ức của trò chuyện hiện tại? Không thể khôi phục!')) {
          const newState = core.getDefaultState();
          core.saveState(newState);
          window.location.reload();
        }
      });
    }
  }

  // ========== Phụ trợ: Đọc thiết lập động cơ hiện tại ==========
  function readEngineSettings() {
    return {
      driveMode: document.querySelector('input[name="htyq-drive-mode"]:checked')?.value || 'ai',
      smartKeywords: document.getElementById('htyq-smart-keywords')?.checked !== false,
      minutesPerRound: parseInt(document.getElementById('htyq-minutes-per-round')?.value, 10) || 2,
      evolveInterval: parseInt(document.getElementById('htyq-evolve-interval')?.value, 10) || 10,
      evolveContent: Array.from(document.querySelectorAll('input[name="htyq-evolve-content"]:checked')).map(cb => cb.value) || ['events', 'reputation', 'factions', 'relations', 'rumors']
    };
  }

  // ========== renderEngine (Tab Động cơ) ==========
  function renderEngine(container, state) {
    if (!container) return;
    const settings = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
    const driveMode = settings.driveMode || 'ai';
    const smartKeywords = settings.smartKeywords !== false;
    const minutesPerRound = parseInt(settings.minutesPerRound, 10) || 2;
    const evolveInterval = parseInt(settings.evolveInterval, 10) || 10;
    const evolveContent = settings.evolveContent || ['events', 'reputation', 'factions', 'relations', 'rumors'];

    const timeModule = window.HTYQ_LITE_TIME;
    const timeStr = timeModule && typeof timeModule.formatWorldTime === 'function'
      ? timeModule.formatWorldTime(state.inWorldMinutes || 0)
      : `${state.inWorldMinutes || 0} phút`;

    const isAi = driveMode === 'ai';
    const isManual = driveMode === 'manual';

    // 当前模式 badge
    const modeBadge = isAi
      ? `<span class="htyq-drive-badge htyq-drive-badge-ai">AI Điều Khiển Thời Gian</span>`
      : `<span class="htyq-drive-badge htyq-drive-badge-manual">Điều Chỉnh Thủ Công</span>`;

    container.innerHTML = `
      <!-- Khu vực 1: Chế độ truyền động -->
      <div class="htyq-engine-section">
        <div class="htyq-engine-section-title">🎯 Chế độ truyền động</div>

        <label class="htyq-drive-option ${isAi ? 'selected' : ''}">
          <input type="radio" name="htyq-drive-mode" value="ai" ${isAi ? 'checked' : ''}>
          <div>
            <div class="htyq-drive-label">AI Điều Khiển Thời Gian (Khuyến Nghị)</div>
            <div class="htyq-drive-desc">Do AI ước tính thời gian thế giới dựa trên cốt truyện, khi đến giờ sẽ tự động suy diễn thế giới</div>
          </div>
        </label>

        <label class="htyq-drive-option ${isManual ? 'selected' : ''}">
          <input type="radio" name="htyq-drive-mode" value="manual" ${isManual ? 'checked' : ''}>
          <div>
            <div class="htyq-drive-label">Điều Chỉnh Thủ Công</div>
            <div class="htyq-drive-desc">Tắt hệ thống thời gian, hoàn toàn tự động suy diễn theo số lượt bạn thiết lập</div>
          </div>
        </label>

        <div class="htyq-drive-status">
          <span>Chế Độ Hiện Tại: </span>
          ${modeBadge}
          <span style="margin-left:auto;">Thời Gian Thế Giới: ${isManual ? '<span class="htyq-time-sealed">🔒 Phong Ấn Thời Gian</span>' : timeStr}</span>
        </div>

        <!-- Công tắc từ khóa: Hiện trong chế độ thủ công -->
        <div class="htyq-keyword-toggle ${isAi ? 'htyq-kw-hidden' : ''}" id="htyq-keyword-toggle-wrap">
          <input type="checkbox" id="htyq-smart-keywords" ${smartKeywords ? 'checked' : ''}>
          <div>
            <div class="htyq-kw-label">📋 Suy Diễn Thông Minh Từ Khóa Cốt Truyện</div>
            <div class="htyq-kw-desc">Khi phát hiện các từ khóa như "ba ngày sau", tự động cộng thêm thời gian và kích hoạt suy diễn</div>
          </div>
        </div>
      </div>

      <!-- Khu vực 2: Thông số điều chỉnh thủ công -->
      <div class="htyq-engine-section ${isAi ? 'htyq-manual-section-disabled' : ''}" id="htyq-manual-section">
        <div class="htyq-engine-section-title">⚙️ Thông Số Điều Chỉnh Thủ Công</div>

        <div class="htyq-param-row">
          <label>Mỗi Lượt =</label>
          <input type="number" id="htyq-minutes-per-round" value="${minutesPerRound}" min="1" max="60">
          <small>phút (1~60)</small>
        </div>

        <div class="htyq-param-row">
          <label>Khoảng Cách Suy Diễn</label>
          <input type="number" id="htyq-evolve-interval" value="${evolveInterval}" min="1" max="100">
          <small>lượt (1~100)</small>
        </div>

        <div class="htyq-param-row">
          <label style="min-width:auto;">Nội Dung Suy Diễn: </label>
        </div>
        <div class="htyq-evolve-checkboxes">
          ${['events','reputation','factions','relations','rumors'].map(item => {
            const labels = { events: 'Chuỗi Sự Kiện', reputation: 'Danh Tiếng', factions: 'Thế Lực', relations: 'Quan Hệ', rumors: 'Tin Đồn' };
            return `<label><input type="checkbox" name="htyq-evolve-content" value="${item}" ${evolveContent.includes(item) ? 'checked' : ''}> ${labels[item] || item}</label>`;
          }).join('')}
        </div>

        <div class="htyq-engine-reset-row">
          <button class="htyq-lite-btn" id="htyq-reset-engine-defaults">Đặt Lại Về Mặc Định</button>
        </div>
      </div>

      <!-- Khu vực 3: Trạng thái hiện tại (Chỉ đọc) -->
      <div class="htyq-engine-section">
        <div class="htyq-engine-section-title">📊 Trạng Thái Hiện Tại</div>
        <div class="htyq-state-row">
          <span class="htyq-state-label">Số Lượt Hội Thoại</span>
          <span class="htyq-state-value">${window.HTYQ_LITE_CORE.getActualRoundCount()}</span>
        </div>
        <div class="htyq-state-row">
          <span class="htyq-state-label">Thời Gian Thế Giới</span>
          <span class="htyq-state-value">${timeStr} (${state.inWorldMinutes || 0} phút)</span>
        </div>
        <div class="htyq-state-row">
          <span class="htyq-state-label">Số Lượt Hợp Lệ</span>
          <span class="htyq-state-value">${state.lastTimeCheckRound || 0}</span>
        </div>
        <div class="htyq-state-row">
          <span class="htyq-state-label">Lượt Suy Diễn Trước</span>
          <span class="htyq-state-value">Lượt ${state.lastEvolveRound}</span>
        </div>
      </div>

      <!-- Khu vực 4: Công cụ gỡ lỗi -->
      <div class="htyq-engine-section">
        <div class="htyq-engine-section-title">🔧 Công Cụ Gỡ Lỗi</div>
        <div class="htyq-debug-btns">
          <button class="htyq-lite-btn htyq-lite-btn-accent" id="htyq-debug-add-day">⏩ Bắt Buộc Hôm Nay</button>
          <button class="htyq-lite-btn htyq-lite-btn-accent" id="htyq-debug-add-3days">⏩ Bắt Buộc Ba Ngày Sau</button>
          <button class="htyq-lite-btn htyq-lite-btn-danger" id="htyq-debug-reset-time">🔄 Reset Thời Gian Về 0</button>
          <button class="htyq-lite-btn htyq-lite-btn-success" id="htyq-debug-immediate-evolve">🌀 Suy Diễn Ngay 1 Vòng</button>
        </div>
      </div>

      <div class="htyq-engine-reset-row" style="margin-top:10px;">
        <button class="htyq-lite-btn" id="htyq-save-engine-settings">💾 Lưu Cài Đặt Động Cơ</button>
      </div>
    `;

    // ----- Sự kiện chuyển chế độ truyền động -----
    const radios = container.querySelectorAll('input[name="htyq-drive-mode"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        const val = radio.value;
        const manualSection = container.querySelector('#htyq-manual-section');
        const kwToggle = container.querySelector('#htyq-keyword-toggle-wrap');
        const statusDiv = container.querySelector('.htyq-drive-status');
        const modeBadgeSpan = statusDiv?.querySelector('.htyq-drive-badge');
        const timeSpan = statusDiv?.querySelector('span:last-child');

        if (val === 'ai') {
          manualSection?.classList.add('htyq-manual-section-disabled');
          kwToggle?.classList.add('htyq-kw-hidden');
          // Cập nhật badge
          if (modeBadgeSpan) {
            modeBadgeSpan.className = 'htyq-drive-badge htyq-drive-badge-ai';
            modeBadgeSpan.textContent = 'AI Điều Khiển Thời Gian';
          }
          if (timeSpan) timeSpan.innerHTML = `Thời Gian Thế Giới: ${timeStr}`;
          // Cập nhật highlight tùy chọn
          container.querySelectorAll('.htyq-drive-option').forEach(o => o.classList.remove('selected'));
          radio.closest('.htyq-drive-option')?.classList.add('selected');
        } else {
          manualSection?.classList.remove('htyq-manual-section-disabled');
          kwToggle?.classList.remove('htyq-kw-hidden');
          if (modeBadgeSpan) {
            modeBadgeSpan.className = 'htyq-drive-badge htyq-drive-badge-manual';
            modeBadgeSpan.textContent = 'Điều Chỉnh Thủ Công';
          }
          if (timeSpan) timeSpan.innerHTML = `Thời Gian Thế Giới: <span class="htyq-time-sealed">🔒 Phong Ấn Thời Gian</span>`;
          container.querySelectorAll('.htyq-drive-option').forEach(o => o.classList.remove('selected'));
          radio.closest('.htyq-drive-option')?.classList.add('selected');
        }
      });
    });

    // ----- Nút Đặt lại về mặc định -----
    const resetDefaultsBtn = container.querySelector('#htyq-reset-engine-defaults');
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener('click', () => {
        const minutesInput = container.querySelector('#htyq-minutes-per-round');
        const intervalInput = container.querySelector('#htyq-evolve-interval');
        const contentCbs = container.querySelectorAll('input[name="htyq-evolve-content"]');
        if (minutesInput) minutesInput.value = '2';
        if (intervalInput) intervalInput.value = '10';
        contentCbs.forEach(cb => cb.checked = true);
        showTempToast('✅ Đã đặt lại về mặc định');
      });
    }

    // ----- Nút Công cụ gỡ lỗi -----
    const debugAddDay = container.querySelector('#htyq-debug-add-day');
    if (debugAddDay) {
      debugAddDay.addEventListener('click', () => {
        const state = core.loadState();
        state.inWorldMinutes = (state.inWorldMinutes || 0) + 1440;
        core.saveState(state);
        showTempToast('✅ Thời gian +1 ngày (1440 phút)');
        refresh();
      });
    }
    const debugAdd3Days = container.querySelector('#htyq-debug-add-3days');
    if (debugAdd3Days) {
      debugAdd3Days.addEventListener('click', () => {
        const state = core.loadState();
        state.inWorldMinutes = (state.inWorldMinutes || 0) + 4320;
        core.saveState(state);
        showTempToast('✅ Thời gian +3 ngày (4320 phút)');
        refresh();
      });
    }
    const debugResetTime = container.querySelector('#htyq-debug-reset-time');
    if (debugResetTime) {
      debugResetTime.addEventListener('click', () => {
        if (confirm('Xác nhận đặt lại thời gian thế giới về 0?')) {
          const state = core.loadState();
          state.inWorldMinutes = 0;
          core.saveState(state);
          showTempToast('🔄 Thời gian thế giới đã được đặt lại về 0');
          refresh();
        }
      });
    }
    const debugImmediateEvolve = container.querySelector('#htyq-debug-immediate-evolve');
    if (debugImmediateEvolve) {
      debugImmediateEvolve.addEventListener('click', async () => {
        debugImmediateEvolve.disabled = true;
        debugImmediateEvolve.textContent = '⏳ Đang suy diễn...';
        const state = core.loadState();
        const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
        const lastMsg = ctx?.chat?.[ctx.chat.length - 1];
        const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';
        try {
          const success = await evolution.evolve(state, userMsg, aiMsg);
          if (success) {
            showTempToast('✅ Suy diễn bắt buộc hoàn tất');
          } else {
            showTempToast('⚠️ Suy diễn thất bại', true);
          }
        } catch(err) {
          showTempToast(`Lỗi suy diễn: ${err.message}`, true);
        }
        debugImmediateEvolve.disabled = false;
        debugImmediateEvolve.innerHTML = '🌀 Suy Diễn Ngay 1 Vòng';
        refresh();
      });
    }

    // ----- Lưu cài đặt động cơ -----
    const saveEngineBtn = container.querySelector('#htyq-save-engine-settings');
    if (saveEngineBtn) {
      saveEngineBtn.addEventListener('click', () => {
        const newSettings = readEngineSettings();
        const existing = JSON.parse(localStorage.getItem('htyq_lite_settings') || '{}');
        const merged = { ...existing, ...newSettings };
        localStorage.setItem('htyq_lite_settings', JSON.stringify(merged));

        // Đồng bộ vào state
        const state = core.loadState();
        state.driveMode = newSettings.driveMode;
        core.saveState(state);

        showTempToast('💾 Đã lưu cài đặt động cơ');
        refresh();
      });
    }
  }

  // ---------- Bug 6: Đặt lại trạng thái UI ----------
  function resetUI() {
    panelVisible = false;
    currentTab = 'overview';
    if (panelElement) {
      panelElement.style.display = 'none';
    }
    removeGlobalListeners();
  }

  // ========== Bug 2: Quản lý sự kiện toàn cục ==========
  function removeGlobalListeners() {
    if (globalKeyHandler) {
      document.removeEventListener('keydown', globalKeyHandler);
      globalKeyHandler = null;
    }
    if (globalClickHandler) {
      document.removeEventListener('mousedown', globalClickHandler);
      globalClickHandler = null;
    }
    if (globalResizeHandler) {
      window.removeEventListener('resize', globalResizeHandler);
      globalResizeHandler = null;
    }
  }

  function addGlobalListeners() {
    removeGlobalListeners();

    globalKeyHandler = function(e) {
      if (e.key === 'Escape' && panelVisible) {
        e.preventDefault();
        hidePanel();
      }
    };
    document.addEventListener('keydown', globalKeyHandler);

    if (window.innerWidth > 768) {
      globalClickHandler = function(e) {
        if (!panelVisible) return;
        if (!panelElement) return;
        if (panelElement.contains(e.target)) return;
        const inputBtn = document.getElementById('htyq-input-bar-btn');
        if (inputBtn && inputBtn.contains(e.target)) return;
        hidePanel();
      };
      setTimeout(() => {
        document.addEventListener('mousedown', globalClickHandler);
      }, 100);
    }

    globalResizeHandler = function() {
      if (!panelVisible || !panelElement) return;
      if (window.innerWidth <= 480) {
      } else if (window.innerWidth <= 768) {
      } else {
        const rect = panelElement.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (rect.right > vw - 10) {
          panelElement.style.right = '20px';
          panelElement.style.left = 'auto';
        }
        if (rect.bottom > vh - 10) {
          panelElement.style.bottom = '80px';
          panelElement.style.top = 'auto';
        }
      }
    };
    window.addEventListener('resize', globalResizeHandler);
  }

  // ---------- Điều khiển bảng điều khiển ----------
  function showPanel() {
    if (!panelElement) return;
    panelElement.style.display = 'flex';
    panelVisible = true;
    addGlobalListeners();
    refresh();
  }

  function hidePanel() {
    if (!panelElement) return;
    panelElement.style.display = 'none';
    panelVisible = false;
    removeGlobalListeners();
  }

  function togglePanel() {
    if (panelVisible) hidePanel();
    else showPanel();
  }

  // ---------- Kéo bảng điều khiển (Chỉ desktop) ----------
  function initDraggablePanel(panelElement, headerElement) {
    if (window.innerWidth <= 768) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function loadStoredPanelPosition() {
      try {
        const pos = localStorage.getItem('htyq_lite_panel_position');
        if (pos) {
          const { left, top } = JSON.parse(pos);
          if (typeof left === 'number' && typeof top === 'number') {
            panelElement.style.left = left + 'px';
            panelElement.style.top = top + 'px';
            panelElement.style.right = 'auto';
            panelElement.style.bottom = 'auto';
            return true;
          }
        }
      } catch(e) {}
      return false;
    }

    function storePanelPosition(left, top) {
      try {
        localStorage.setItem('htyq_lite_panel_position', JSON.stringify({ left, top }));
      } catch(e) {}
    }

    function clampPanelPosition(left, top) {
      const rect = panelElement.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let newLeft = left;
      let newTop = top;
      if (newLeft < 0) newLeft = 0;
      if (newLeft + width > viewportWidth) newLeft = viewportWidth - width;
      if (newTop < 0) newTop = 0;
      if (newTop + height > viewportHeight) newTop = viewportHeight - height;
      return { left: newLeft, top: newTop };
    }

    function convertPanelToLeftTop() {
      const style = window.getComputedStyle(panelElement);
      const right = style.right;
      const bottom = style.bottom;
      if (right !== 'auto' || bottom !== 'auto') {
        const rect = panelElement.getBoundingClientRect();
        panelElement.style.left = rect.left + 'px';
        panelElement.style.top = rect.top + 'px';
        panelElement.style.right = 'auto';
        panelElement.style.bottom = 'auto';
        return { left: rect.left, top: rect.top };
      }
      return { left: parseFloat(style.left), top: parseFloat(style.top) };
    }

    function onStart(e) {
      if (e.target !== headerElement && !headerElement.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
      if (clientX === undefined || clientY === undefined) return;
      startX = clientX;
      startY = clientY;
      isDragging = true;
      const pos = convertPanelToLeftTop();
      startLeft = pos.left;
      startTop = pos.top;
      panelElement.style.cursor = 'grabbing';
    }

    function onMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
      if (clientX === undefined || clientY === undefined) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      const clamped = clampPanelPosition(startLeft + dx, startTop + dy);
      panelElement.style.left = clamped.left + 'px';
      panelElement.style.top = clamped.top + 'px';
      panelElement.style.right = 'auto';
      panelElement.style.bottom = 'auto';
    }

    function onEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      panelElement.style.cursor = '';
      const left = parseFloat(panelElement.style.left);
      const top = parseFloat(panelElement.style.top);
      if (!isNaN(left) && !isNaN(top)) {
        storePanelPosition(left, top);
      }
      e.preventDefault();
      e.stopPropagation();
    }

    headerElement.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    headerElement.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    const hasStored = loadStoredPanelPosition();
    if (!hasStored) {
      panelElement.style.right = '20px';
      panelElement.style.bottom = '80px';
      panelElement.style.left = 'auto';
      panelElement.style.top = 'auto';
    } else {
      const left = parseFloat(panelElement.style.left);
      const top = parseFloat(panelElement.style.top);
      if (!isNaN(left) && !isNaN(top)) {
        const clamped = clampPanelPosition(left, top);
        panelElement.style.left = clamped.left + 'px';
        panelElement.style.top = clamped.top + 'px';
      }
    }
  }

  // ---------- Thêm nút phím tắt ở trên thanh nhập liệu ----------
  function addInputBarButton() {
    const containerSelectors = [
      '#quickReplyBlock',
      '#quick-reply-block',
      '.quickReplyBlock',
      '.quick-reply-bar',
      '#send_but'
    ];
    let container = null;
    for (let sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        container = el;
        break;
      }
    }
    if (!container) {
      console.warn('[HTYQ Lite] Không tìm thấy vùng chứa thanh nhập liệu, không thể thêm nút');
      return;
    }
    if (container.id === 'send_but') {
      container = container.parentNode;
    }
    if (document.getElementById('htyq-input-bar-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'htyq-input-bar-btn';
    btn.type = 'button';
    btn.className = 'menu_button interactable';
    btn.innerHTML = '<i class="fa-solid fa-earth-asia"></i>';
    btn.title = 'Động Cơ Sống';
    btn.addEventListener('click', togglePanel);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); togglePanel(); }, { passive: false });
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 4px',
      padding: '4px 8px',
      cursor: 'pointer'
    });
    container.appendChild(btn);
    console.log('[HTYQ Lite] Đã thêm nút phím tắt phía trên thanh nhập liệu');
  }

  // ---------- Xây dựng bảng điều khiển UI ----------
  function buildUI() {
    if (document.getElementById('htyq-lite-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'htyq-lite-panel';
    panel.className = 'htyq-lite-panel';
    panel.style.display = 'none';
    panel.style.flexDirection = 'column';

    // Tab chung (5 cái, dùng chung cho cả hai nhánh)
    const tabsHtml = `
      <button data-tab="overview" class="htyq-lite-tab active">Tổng Quan</button>
      <button data-tab="world" class="htyq-lite-tab">Thế Giới</button>
      <button data-tab="rumors" class="htyq-lite-tab">Tin Đồn</button>
      <button data-tab="memory" class="htyq-lite-tab">Ký Ức</button>
      <button data-tab="settings" class="htyq-lite-tab">Cài Đặt</button>
      <button data-tab="engine" class="htyq-lite-tab">Động Cơ</button>
    `;
    const viewsHtml = `
      <div id="htyq-view-overview" class="htyq-lite-view active"></div>
      <div id="htyq-view-world" class="htyq-lite-view"></div>
      <div id="htyq-view-rumors" class="htyq-lite-view"></div>
      <div id="htyq-view-memory" class="htyq-lite-view"></div>
      <div id="htyq-view-settings" class="htyq-lite-view"></div>
      <div id="htyq-view-engine" class="htyq-lite-view"></div>
    `;

    if (window.innerWidth <= 768) {
      panel.innerHTML = `
        <div class="htyq-lite-drag-handle">
          <span class="htyq-lite-handle-bar"></span>
          <button class="htyq-lite-panel-close-mobile">✕</button>
        </div>
        <div class="htyq-lite-tabs">${tabsHtml}</div>
        ${viewsHtml}
      `;
    } else {
      panel.innerHTML = `
        <div class="htyq-lite-panel-header">
          <span class="htyq-lite-panel-title">🧠 Động Cơ Sống</span>
          <button class="htyq-lite-panel-close">✕</button>
        </div>
        <div class="htyq-lite-tabs">${tabsHtml}</div>
        ${viewsHtml}
      `;
    }
    document.body.appendChild(panel);
    panelElement = panel;

    const tabs = panel.querySelectorAll('.htyq-lite-tab');
    const views = panel.querySelectorAll('.htyq-lite-view');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        views.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`htyq-view-${tabId}`);
        if (targetView) targetView.classList.add('active');
        currentTab = tabId;
        refresh();
      });
    });

    const closeBtn = panel.querySelector('.htyq-lite-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => hidePanel());
    const closeMobileBtn = panel.querySelector('.htyq-lite-panel-close-mobile');
    if (closeMobileBtn) closeMobileBtn.addEventListener('click', () => hidePanel());

    const header = panel.querySelector('.htyq-lite-panel-header');
    if (header) initDraggablePanel(panel, header);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addInputBarButton);
    } else {
      addInputBarButton();
    }

    // Ủy thác sự kiện mở/gập thẻ
    panel.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) return;
      const h4 = e.target.closest('.htyq-lite-card > h4');
      if (h4) {
        const card = h4.parentElement;
        if (card && card.classList.contains('htyq-lite-card')) {
          e.stopPropagation();
          card.classList.toggle('collapsed');
        }
      }
    });

    refresh();
  }

  function refresh() {
    if (!panelElement) return;
    const state = core.loadState();
    const overviewDiv = document.getElementById('htyq-view-overview');
    const worldDiv = document.getElementById('htyq-view-world');
    const memoryDiv = document.getElementById('htyq-view-memory');
    const settingsDiv = document.getElementById('htyq-view-settings');
    const engineDiv = document.getElementById('htyq-view-engine');
    if (currentTab === 'overview' && overviewDiv) renderOverview(overviewDiv, state);
    else if (currentTab === 'world' && worldDiv) renderWorld(worldDiv, state);
    else if (currentTab === 'memory' && memoryDiv) renderMemory(memoryDiv, state);
    else if (currentTab === 'settings' && settingsDiv) renderSettings(settingsDiv);
    else if (currentTab === 'engine' && engineDiv) renderEngine(engineDiv, state);
  }

  // ---------- API công khai ----------
  return {
    buildUI,
    refresh,
    showPanel,
    hidePanel,
    togglePanel,
    resetUI,
    renderEngine
  };
})();
