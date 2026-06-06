import os, re

filepath = 'htyq-lite-ui.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update renderOverview
old_renderOverview = re.search(r'function renderOverview\(container, state\) \{.*?\}  // ========== renderWorld ==========', content, re.DOTALL)
if old_renderOverview:
    new_renderOverview = '''function renderOverview(container, state) {
    if (!container) return;
    const rep = state.reputation;
    const econ = state.economy || { marketTrend: 'Bình ổn', fundsStatus: 'Eo hẹp', keyResources: [] };
    const currentTags = state.lastInjection?.tagsUsed || [];
    const tagsHtml = renderTagsHtml(currentTags);
    const injectionHtml = renderInjectionPreview(state.lastInjection);
    const timeBarHtml = renderWorldTimeBar(state);

    container.innerHTML = `
      ${timeBarHtml}
      <div class="htyq-lite-card"><h4>📊 Lượt</h4><div>${window.HTYQ_LITE_CORE.getActualRoundCount()}</div></div>
      <div class="htyq-lite-card"><h4>🏷️ Nhãn Hiện Tại</h4><div class="htyq-tag-container">${tagsHtml}</div></div>
      <div class="htyq-lite-card"><h4>🌍 Tóm Tắt Thế Giới</h4><div>${escapeHtml(state.worldDigest)}</div></div>
      <div class="htyq-lite-card"><h4>⭐ Danh Tiếng</h4><div>Giang Hồ: ${rep.jianghu} &nbsp;|&nbsp; Quan Phủ: ${rep.official}<br>Dân Gian: ${rep.folk} &nbsp;|&nbsp; Hắc Đạo: ${rep.underworld}</div></div>
      <div class="htyq-lite-card"><h4>💰 Kinh Tế & Vật Tư</h4><div>Xu Hướng: ${escapeHtml(econ.marketTrend)}<br>Quỹ: ${escapeHtml(econ.fundsStatus)}<br>Tài Nguyên: ${escapeHtml((econ.keyResources || []).join(', ') || 'Không')}</div></div>
      <div class="htyq-lite-card"><h4>🧠 Tóm Tắt Cảm Xúc</h4><ul>${Object.entries(state.emotionMap).slice(0,5).map(([n, e]) => \`<li>${escapeHtml(n)}: ${e.attitude} (${e.level})</li>\`).join('') || '<li>Không</li>'}</ul></div>
      <button id="htyq-manual-evolve" class="htyq-lite-btn htyq-lite-btn-purple">🌀 Suy Diễn Thủ Công 1 Lượt</button>
      <div class="htyq-lite-card"><h4>📝 Xem Trước Injection Hiện Tại</h4><div id="htyq-injection-preview">${injectionHtml}</div></div>
    `;
    const evolveBtn = container.querySelector('#htyq-manual-evolve');
    if (evolveBtn) {
      evolveBtn.addEventListener('click', async () => {
        const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
        const state = window.HTYQ_LITE_CORE.loadState();
        const lastMsg = ctx?.chat?.[ctx.chat.length - 1];
        const userMsg = lastMsg?.is_user ? (lastMsg.mes || '') : '';
        const aiMsg = !lastMsg?.is_user ? (lastMsg?.mes || '') : '';

        evolveBtn.disabled = true;
        evolveBtn.textContent = '⏳ Đang suy diễn...';
        const persistToast = window.HTYQ_LITE_UI.showPersistToast ? window.HTYQ_LITE_UI.showPersistToast('🌍 Thế giới đang suy diễn...') : null;
        try {
          const success = await window.HTYQ_LITE_EVOLUTION.evolve(state, userMsg, aiMsg);
          if (window.HTYQ_LITE_UI.removePersistToast) window.HTYQ_LITE_UI.removePersistToast();
          if (success) {
            window.HTYQ_LITE_UI.showTempToast('✅ Suy diễn thủ công hoàn tất');
          } else {
            window.HTYQ_LITE_UI.showTempToast('❌ Suy diễn thủ công thất bại', true);
          }
        } catch (err) {
          if (window.HTYQ_LITE_UI.removePersistToast) window.HTYQ_LITE_UI.removePersistToast();
          window.HTYQ_LITE_UI.showTempToast(`Lỗi suy diễn: ${err.message}`, true);
        }
        evolveBtn.disabled = false;
        evolveBtn.innerHTML = '🌀 Suy Diễn Thủ Công 1 Lượt';
        window.HTYQ_LITE_UI.refresh();
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

  // ========== renderWorld =========='''
    content = content.replace(old_renderOverview.group(0), new_renderOverview)

# 2. Update renderWorld
old_renderWorld = re.search(r'function renderWorld\(container, state\) \{.*?\}  // ========== renderMemory ==========', content, re.DOTALL)
if old_renderWorld:
    new_renderWorld = '''function renderWorld(container, state) {
    if (!container) return;
    let relationsHtml = '';
    if (state.factionRelations && state.factionRelations.length > 0) {
      relationsHtml = '<ul>';
      for (const rel of state.factionRelations) {
        relationsHtml += `<li>${escapeHtml(rel.factionA)} ↔ ${escapeHtml(rel.factionB)}: ${escapeHtml(rel.relation)} (Cấp ${rel.level || '?'}), Xu Hướng: ${rel.trend || 'Ổn Định'}</li>`;
      }
      relationsHtml += '</ul>';
    } else {
      relationsHtml = '<ul><li>Không</li></ul>';
    }

    container.innerHTML = `
      <div class="htyq-lite-card"><h4>🔥 Chuỗi Sự Kiện</h4><ul>${state.events.map(e => \`<li>${escapeHtml(e.name)} Lv.${e.level} ${e.stage} (${e.currentRound}/${e.totalRounds})</li>\`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🏛️ Thế Lực</h4><ul>${state.factions.map(f => \`<li>${escapeHtml(f.name)} - Đoàn Kết: ${f.cohesion} Tài Nguyên: ${f.resources}</li>\`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🤝 Quan Hệ Thế Lực</h4>${relationsHtml}</div>
      <div class="htyq-lite-card"><h4>🩸 Sổ Tay Huyết Cừu</h4><ul>${state.bloodFeudMemo.map(b => \`<li>${escapeHtml(b.faction)} - ${b.status}</li>\`).join('') || '<li>Không</li>'}</ul></div>
      <div class="htyq-lite-card"><h4>🔗 Chuỗi Nhân Quả</h4><ul>${state.causalChain.map(c => \`<li>${escapeHtml(c.event)}: ${c.progress} → ${c.manifestation || ''}</li>\`).join('') || '<li>Không</li>'}</ul></div>
    `;
  }

  function renderRumors(container, state) {
    if (!container) return;
    const rumorsHtml = state.rumors.map(r => {
      let heatIcon = '';
      const heat = r.heatLevel || r.heat || 'Trung';
      if (heat === 'Nhiệt' || heat === 'Cao') heatIcon = '🔥';
      else if (heat === 'Trung') heatIcon = '⭐';
      else if (heat === 'Thấp') heatIcon = '🌿';
      else heatIcon = '❄️';
      return \`<li>${heatIcon} ${escapeHtml(r.content)} — Độ Tin Cậy: ${r.credibility || 'Trung Bình'} | Lượt ghi: ${r.addedRound || '?'}</li>\`;
    }).join('') || '<li>Không có tin đồn nào</li>';

    container.innerHTML = `
      <div class="htyq-lite-card"><h4>🗣️ Tin Đồn Thế Giới</h4><ul>${rumorsHtml}</ul></div>
    `;
  }

  // ========== renderMemory =========='''
    content = content.replace(old_renderWorld.group(0), new_renderWorld)

# 3. Update refresh
old_refresh = re.search(r'function refresh\(\) \{.*?\}  // ---------- API công khai ----------', content, re.DOTALL)
if old_refresh:
    new_refresh = '''function refresh() {
    if (!panelElement) return;
    const state = window.HTYQ_LITE_CORE.loadState();
    const overviewDiv = document.getElementById('htyq-view-overview');
    const worldDiv = document.getElementById('htyq-view-world');
    const rumorsDiv = document.getElementById('htyq-view-rumors');
    const memoryDiv = document.getElementById('htyq-view-memory');
    const settingsDiv = document.getElementById('htyq-view-settings');
    const engineDiv = document.getElementById('htyq-view-engine');
    
    if (currentTab === 'overview' && overviewDiv) renderOverview(overviewDiv, state);
    else if (currentTab === 'world' && worldDiv) renderWorld(worldDiv, state);
    else if (currentTab === 'rumors' && rumorsDiv) renderRumors(rumorsDiv, state);
    else if (currentTab === 'memory' && memoryDiv) renderMemory(memoryDiv, state);
    else if (currentTab === 'settings' && settingsDiv) renderSettings(settingsDiv);
    else if (currentTab === 'engine' && engineDiv) renderEngine(engineDiv, state);
  }

  // ---------- API công khai ----------'''
    content = content.replace(old_refresh.group(0), new_refresh)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
