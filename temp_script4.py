import os, re

# 1. Update evolution prompt
filepath_evo = 'htyq-lite-evolution.js'
with open(filepath_evo, 'r', encoding='utf-8') as f:
    content_evo = f.read()

# Replace the specific note at the end of the prompt
old_note = 'Chú ý: Nếu mô hình không thể tạo đủ nội dung, thà tạo nội dung mặc định hợp lý (như "Thế giới bình yên không có sự kiện lớn"), cũng không được trả về mảng rỗng.'
new_note = 'Chú ý quan trọng:\n1. KHÔNG BAO GIỜ viết "Thế giới bình yên không có sự kiện lớn". Nếu không có sự kiện lớn, hãy suy diễn chi tiết về các động thái nhỏ ngầm, mâu thuẫn cá nhân, biến động vật giá, hoặc hành tung của các NPC khác.\n2. Các trường như Đại thế thế giới (world_digest) phải dài tối thiểu 2-3 câu, miêu tả sinh động chi tiết.'
content_evo = content_evo.replace(old_note, new_note)

with open(filepath_evo, 'w', encoding='utf-8') as f:
    f.write(content_evo)

# 2. Update renderInjectionPreview
filepath_ui = 'htyq-lite-ui.js'
with open(filepath_ui, 'r', encoding='utf-8') as f:
    content_ui = f.read()

old_preview = re.search(r'function renderInjectionPreview\(lastInjection\) \{.*?return `.*?`;\n  \}', content_ui, flags=re.DOTALL)
if old_preview:
    new_preview = '''function renderInjectionPreview(lastInjection) {
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
  }'''
    content_ui = content_ui.replace(old_preview.group(0), new_preview)

with open(filepath_ui, 'w', encoding='utf-8') as f:
    f.write(content_ui)

