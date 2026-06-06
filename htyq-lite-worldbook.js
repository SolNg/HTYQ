// Đọc và khớp Thế Giới Thư (Bản hoàn chỉnh, hỗ trợ dò đa đường dẫn)
window.HTYQ_LITE_WORLDBOOK = (function() {
  let cache = [];
  let lastLoadTime = null;

  // Dò Thế Giới Thư đa đường dẫn
  function detectWorldbooks(char) {
    const result = [];
    try {
      // Đường dẫn 1: character_book
      if (char?.data?.character_book) {
        if (typeof char.data.character_book === 'string') result.push(char.data.character_book);
        else if (Array.isArray(char.data.character_book)) result.push(...char.data.character_book);
      }
      // Đường dẫn 2: extensions.world
      if (char?.data?.extensions?.world) result.push(char.data.extensions.world);
      // Đường dẫn 3: extensions.world_info
      if (char?.data?.extensions?.world_info) result.push(char.data.extensions.world_info);
      // Đường dẫn 4: chat_metadata.world_info
      if (char?.chat_metadata?.world_info) result.push(char.chat_metadata.world_info);
    } catch(e) {}
    return [...new Set(result)];
  }

  async function loadWorldbooks() {
    const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
    if (!ctx) return [];
    const entries = [];
    const loadedBooks = new Set();

    try {
      const char = ctx.characters?.[ctx.characterId];
      const bookNames = detectWorldbooks(char);
      for (const bookName of bookNames) {
        if (loadedBooks.has(bookName)) continue;
        const book = await ctx.loadWorldInfo(bookName);
        if (book && book.entries) {
          for (const entry of Object.values(book.entries)) {
            if (!entry.disable) {
              entries.push({
                source: 'character',
                name: bookName,
                content: entry.content,
                tags: entry.keys || [],
                comment: entry.comment || ''
              });
            }
          }
          loadedBooks.add(bookName);
        }
      }
    } catch(e) { console.warn('Tải Thế Giới Thư của nhân vật thất bại', e); }

    try {
      const headers = ctx.getRequestHeaders ? ctx.getRequestHeaders() : {};
      const resp = await fetch('/api/settings/get', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (resp.ok) {
        const data = await resp.json();
        const settings = JSON.parse(data.settings);
        const globalNames = settings?.world_info_settings?.world_info?.globalSelect || [];
        for (const name of globalNames) {
          if (loadedBooks.has(name)) continue;
          const book = await ctx.loadWorldInfo(name);
          if (book && book.entries) {
            for (const entry of Object.values(book.entries)) {
              if (!entry.disable) {
                entries.push({
                  source: 'global',
                  name: name,
                  content: entry.content,
                  tags: entry.keys || [],
                  comment: entry.comment || ''
                });
              }
            }
            loadedBooks.add(name);
          }
        }
      }
    } catch(e) { console.warn('Tải Thế Giới Thư toàn cục thất bại', e); }

    cache = entries;
    lastLoadTime = new Date();
    console.log(`[HTYQ Worldbook] Tải hoàn tất, tổng cộng ${entries.length} mục`);
    return entries;
  }

  function matchEntries(tags, maxCount = 5) {
    if (cache.length === 0) return [];
    const scored = cache.map(entry => {
      let score = 0;
      const lowerContent = entry.content.toLowerCase();
      for (const tag of tags) {
        const lowerTag = tag.toLowerCase();
        if (entry.tags.some(t => t.toLowerCase().includes(lowerTag) || lowerTag.includes(t.toLowerCase()))) score += 2;
        if (lowerContent.includes(lowerTag)) score += 1;
      }
      return { entry, score };
    });
    scored.sort((a,b) => b.score - a.score);
    return scored.slice(0, maxCount).map(s => s.entry.content);
  }

  // Gỡ Lỗi: Xuất trạng thái Thế Giới Thư
  window.HTYQ_DEBUG_WORLDBOOK = () => {
    console.log('=== HTYQ Worldbook Debug ===');
    console.log('Tổng số mục:', cache.length);
    console.log('Thời gian tải cuối:', lastLoadTime);
    const bySource = cache.reduce((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {});
    console.log('Thống kê nguồn:', bySource);
    console.log('5 mục đầu tiên:', cache.slice(0,5).map(e => ({ name: e.name, tags: e.tags.slice(0,3), content_preview: e.content.substring(0,50) })));
  };

  return { loadWorldbooks, matchEntries, getCache: () => cache, getLastLoadTime: () => lastLoadTime };
})();