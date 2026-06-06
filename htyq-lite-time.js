
window.HTYQ_LITE_TIME = (function() {
  function getActualTime() {
    try {
      const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
      if (ctx && Array.isArray(ctx.chat)) {
        for (let i = ctx.chat.length - 1; i >= 0; i--) {
          const msg = ctx.chat[i].mes || '';
          const timeMatch = msg.match(/(Ngày \d+ tháng \d+ năm \d+|Năm \d+ tháng \d+ ngày \d+|Ngày thứ \d+|Lúc \d+:\d+|\d{2}:\d{2}|\d{4}-\d{2}-\d{2})/i);
          if (timeMatch) {
            return timeMatch[0];
          }
        }
      }
    } catch(e) {}
    return 'Chưa rõ';
  }

  function formatWorldTime(state) {
    const timeStr = getActualTime();
    return timeStr;
  }

  function processEvolveTime(state, text, evolveResult) {
    // We no longer calculate minutes. We just return true to indicate success.
    return true;
  }

  return {
    formatWorldTime,
    processEvolveTime,
    getActualTime
  };
})();
