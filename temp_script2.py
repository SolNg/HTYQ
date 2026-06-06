import os, re

filepath = 'htyq-lite-ui.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Update HTML for injection preview
old_settings_html = re.search(r'<div class="htyq-lite-card">\s*<h4>🔍 Gỡ Lỗi Injection</h4>\s*<div id="htyq-last-injection-preview">Nhấp để làm mới và xem nội dung injection trước đó</div>\s*<button id="htyq-refresh-injection" class="htyq-lite-btn">Làm Mới Nội Dung Injection</button>\s*</div>', content, re.DOTALL)

if old_settings_html:
    new_settings_html = '''<div class="htyq-lite-card">
        <h4>🔍 Gỡ Lỗi Injection</h4>
        <textarea id="htyq-last-injection-textarea" style="width: 100%; min-height: 200px; padding: 8px; font-family: monospace; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; resize: vertical;" placeholder="Chưa có bản ghi injection..."></textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button id="htyq-refresh-injection" class="htyq-lite-btn">Làm Mới</button>
          <button id="htyq-save-injection" class="htyq-lite-btn htyq-lite-btn-purple">Cập Nhật Bơm Lại</button>
        </div>
      </div>'''
    content = content.replace(old_settings_html.group(0), new_settings_html)

# Update logic
old_logic = re.search(r'const refreshInjection = container\.querySelector\(\'#htyq-refresh-injection\'\).*?if \(resetBtn\) \{', content, re.DOTALL)
if old_logic:
    new_logic = '''const refreshInjection = container.querySelector('#htyq-refresh-injection');
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
    if (resetBtn) {'''
    content = content.replace(old_logic.group(0), new_logic)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
