import os, re

# 1. Remove Token Limit in inject.js
filepath_inject = 'htyq-lite-inject.js'
with open(filepath_inject, 'r', encoding='utf-8') as f:
    content_inject = f.read()

content_inject = re.sub(r'// Giới hạn tổng độ dài không quá 4000 ký tự\s*if \(finalContext\.length > 4000\) \{.*?\n\s*\}', '', content_inject, flags=re.DOTALL)
with open(filepath_inject, 'w', encoding='utf-8') as f:
    f.write(content_inject)

# 2. Fix Memory stats rendering
filepath_ui = 'htyq-lite-ui.js'
with open(filepath_ui, 'r', encoding='utf-8') as f:
    content_ui = f.read()

new_stats = '''Ký Ức Gốc: ${ (state.memories || []).length }<br>
      Tóm Tắt Chương: ${ (state.chapterSummaries || []).length }<br>
      Tóm Tắt Quyển: ${ (state.volumeSummaries || []).length }<br>
      Thực Thể Cảm Xúc: ${ Object.keys(state.emotionMap || {}).length }'''
content_ui = re.sub(r'Ký Ức Gốc: \$\{state\.memories\.length\}<br>.*?Thực Thể Cảm Xúc: \$\{Object\.keys\(state\.emotionMap\)\.length\}', new_stats, content_ui, flags=re.DOTALL)

with open(filepath_ui, 'w', encoding='utf-8') as f:
    f.write(content_ui)

# 3. Limit Rumors and Deduplicate in core.js
filepath_core = 'htyq-lite-core.js'
with open(filepath_core, 'r', encoding='utf-8') as f:
    content_core = f.read()

old_addRumor = re.search(r'function addRumor\(state, rumor\) \{.*?\}', content_core, flags=re.DOTALL)
if old_addRumor:
    new_addRumor = '''function addRumor(state, rumor) {
    if (!state.rumors) state.rumors = [];
    if (!rumor.addedRound) rumor.addedRound = window.HTYQ_LITE_CORE.getActualRoundCount();
    if (!rumor.heatLevel) rumor.heatLevel = rumor.heat || 'Trung';
    
    // Deduplicate
    const isDuplicate = state.rumors.some(r => r.content === rumor.content);
    if (!isDuplicate) {
      state.rumors.unshift(rumor);
    }
    // Limit to 10
    if (state.rumors.length > 10) state.rumors.length = 10;
    saveState(state);
  }'''
    content_core = content_core.replace(old_addRumor.group(0), new_addRumor)

with open(filepath_core, 'w', encoding='utf-8') as f:
    f.write(content_core)
