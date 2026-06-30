// ====== 单词达人 - APP 核心逻辑 ======

// ---- 分类配置 ----
const CATEGORIES = [
  { id: 'daily',    icon: '🏠', name: '日常生活' },
  { id: 'work',     icon: '💼', name: '工作职场' },
  { id: 'travel',   icon: '✈️', name: '旅行交通' },
  { id: 'academic', icon: '🎓', name: '学术教育' },
  { id: 'food',     icon: '🍜', name: '饮食烹饪' },
  { id: 'nature',   icon: '🌿', name: '自然万物' },
  { id: 'health',   icon: '💊', name: '健康医疗' },
  { id: 'technology', icon: '💻', name: '科技网络' },
];

// ---- 本地存储 Key ----
const LS = {
  LEARNED:   'vocab_learned',   // Set<en>
  MASTERED:  'vocab_mastered',  // Set<en>
  FAVORITES: 'vocab_favorites', // Set<en>
  STUDY_DAYS:'vocab_study_days',// { date: count }
  QUIZ_HIST: 'vocab_quiz_hist', // { correct, total }
  THEME:     'vocab_theme',
  DAILY_COUNT: 'vocab_daily_count', // number
};

// ---- 工具函数 ----
function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}

function saveSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function loadObj(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
  catch { return def; }
}

function saveObj(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- 全局状态 ----
const state = {
  learned: loadSet(LS.LEARNED),
  mastered: loadSet(LS.MASTERED),
  favorites: loadSet(LS.FAVORITES),
  studyDays: loadObj(LS.STUDY_DAYS, {}),
  quizHist: loadObj(LS.QUIZ_HIST, { correct: 0, total: 0 }),
  currentCategory: null,
  currentWords: [],
  wordIndex: 0,
  shuffled: false,
  dailyCount: loadObj(LS.DAILY_COUNT, 10),
  // Quiz state
  quizWords: [],
  quizIndex: 0,
  quizCorrect: 0,
  quizAnswered: false,
};

// ---- DOM 引用 ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const dom = {
  nav:         $$('.nav-btn'),
  screens:     $$('.screen'),
  backBtns:    $$('.back-btn'),
  catGrid:     $('#category-grid'),
  dailyProgress: $('#daily-progress'),
  streakBadge: $('#streak-badge'),
  learnTitle:  $('#learn-title'),
  learnProgress: $('#learn-progress'),
  shuffleToggle: $('#shuffle-toggle'),
  // Card
  flashcard:   $('#flashcard'),
  cardInner:   $('#card-inner'),
  cardWord:    $('#card-word'),
  cardPhonetic: $('#card-phonetic'),
  cardZh:      $('#card-zh'),
  exampleEn:   $('#example-en'),
  exampleZh:   $('#example-zh'),
  cardFav:     $('#card-fav'),
  cardSpeak:   $('#card-speak'),
  cardKnown:   $('#card-known'),
  // Quiz
  quizWord:    $('#quiz-word'),
  quizOptions: $('#quiz-options'),
  quizFeedback: $('#quiz-feedback'),
  quizProgress: $('#quiz-progress'),
  quizResult:  $('#quiz-result'),
  resultScore: $('#result-score'),
  resultText:  $('#result-text'),
  quizRetry:   $('#quiz-retry'),
  quizBackHome: $('#quiz-back-home'),
  quizSkip:    $('#quiz-skip'),
  quizArea:    $('#quiz-area'),
  // Favorites
  favList:     $('#fav-list'),
  favCount:    $('#fav-count'),
  favClear:    $('#fav-clear'),
  // Stats
  statTotalLearned: $('#stat-total-learned'),
  statMastered: $('#stat-mastered'),
  statStreak:  $('#stat-streak'),
  statQuizAvg: $('#stat-quiz-avg'),
  catProgress: $('#category-progress'),
  studyCalendar: $('#study-calendar'),
  // Theme
  themeToggle: $('#theme-toggle'),
  // Daily count setting
  dailyCountInput: $('#daily-count-input'),
  dailyCountDisplay: $('#daily-count-display'),
  dailyCountMinus: $('#daily-count-minus'),
  dailyCountPlus: $('#daily-count-plus'),
  // Quick
  quickReview: $('#quick-review'),
  quickRandom: $('#quick-random'),
};

// ====== 导航切换 ======
function switchScreen(id) {
  dom.screens.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${id}`);
  if (target) target.classList.add('active');

  dom.nav.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === id);
  });

  // Refresh data on each screen
  if (id === 'home') refreshHome();
  else if (id === 'favorites') refreshFavorites();
  else if (id === 'stats') refreshStats();
}

dom.nav.forEach(btn => {
  if (btn.dataset.screen === 'quiz') {
    btn.addEventListener('click', () => startQuiz('all'));
  } else {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  }
});

dom.backBtns.forEach(btn => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
});

// ====== 主题切换 ======
function initTheme() {
  const saved = localStorage.getItem(LS.THEME);
  if (saved === 'light') {
    document.body.classList.add('light');
    dom.themeToggle.textContent = '☀️';
  }
}

dom.themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem(LS.THEME, isLight ? 'light' : 'dark');
  dom.themeToggle.textContent = isLight ? '☀️' : '🌙';
});

// ====== 首页 ======
function refreshHome() {
  // Daily progress
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = state.studyDays[today] || 0;
  const dailyGoal = state.dailyCount;
  dom.dailyProgress.textContent = `${todayCount} / ${dailyGoal} 单词`;
  const reminderTitle = document.querySelector('.daily-header .reminder-title');
  if (reminderTitle) reminderTitle.textContent =
    todayCount >= dailyGoal ? '🎉 今日目标已完成！' : '今日学习目标';

  // Streak
  const streak = calcStreak();
  dom.streakBadge.textContent = `🔥 ${streak}天`;

  // Category grid
  dom.catGrid.innerHTML = CATEGORIES.map(cat => {
    const words = WORD_DB[cat.id] || [];
    const masteredCount = words.filter(w => state.mastered.has(w.en)).length;
    const pct = words.length > 0 ? (masteredCount / words.length * 100) : 0;
    const allMastered = masteredCount === words.length && words.length > 0;
    return `
      <div class="cat-card ${allMastered ? 'mastered' : ''}" data-cat="${cat.id}">
        ${allMastered ? '<div class="cat-check">✓</div>' : ''}
        <div class="cat-icon">${cat.icon}</div>
        <div class="cat-name">${cat.name}</div>
        <div class="cat-count">${state.dailyCount} 词/日 · ${masteredCount} 已掌握</div>
        <div class="cat-progress-bar">
          <div class="cat-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  dom.catGrid.querySelectorAll('.cat-card').forEach(el => {
    el.addEventListener('click', () => {
      const catId = el.dataset.cat;
      startLearning(catId);
    });
  });
}

// 连续天数计算
function calcStreak() {
  const days = Object.keys(state.studyDays).sort().reverse();
  if (days.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.includes(key)) streak++;
    else if (i > 0) break; // 允许今天还没学
    else if (i === 0 && !days.includes(key)) break;
  }
  return streak;
}

// ====== 学习模式 ======
function startLearning(catId) {
  state.currentCategory = catId;
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `daily_${today}_${catId}`;

  let words;
  const cached = loadObj(cacheKey, null);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    words = cached;
  } else {
    const allWords = [...(WORD_DB[catId] || [])];
    shuffle(allWords);
    const count = Math.min(state.dailyCount, allWords.length);
    words = allWords.slice(0, count);
    saveObj(cacheKey, words);
  }

  if (state.shuffled) shuffle(words);
  state.currentWords = words;
  state.wordIndex = 0;

  const cat = CATEGORIES.find(c => c.id === catId);
  dom.learnTitle.textContent = `${cat.icon} ${cat.name}`;
  switchScreen('learn');
  showCard();
}

dom.shuffleToggle.addEventListener('click', () => {
  state.shuffled = !state.shuffled;
  dom.shuffleToggle.style.opacity = state.shuffled ? '1' : '0.5';
  dom.shuffleToggle.style.transform = state.shuffled ? 'scale(1.1)' : 'scale(1)';
  if (state.currentWords.length > 0) {
    if (state.shuffled) shuffle(state.currentWords);
    state.wordIndex = 0;
    showCard();
  }
});

function showCard() {
  const words = state.currentWords;
  if (words.length === 0 || state.wordIndex >= words.length) {
    dom.learnTitle.textContent = '🎉 学完啦！';
    dom.cardWord.textContent = '恭喜完成！';
    dom.cardPhonetic.textContent = '所有单词已看完';
    dom.cardInner.classList.remove('flipped');
    dom.cardZh.textContent = '返回首页选择其他分类';
    dom.exampleEn.textContent = '';
    dom.exampleZh.textContent = '';
    dom.cardFav.style.display = 'none';
    dom.cardSpeak.style.display = 'none';
    dom.cardKnown.style.display = 'none';
    dom.learnProgress.textContent = `${words.length} / ${words.length}`;
    return;
  }

  const w = words[state.wordIndex];
  dom.cardWord.textContent = w.en;
  dom.cardPhonetic.textContent = w.phonetic || '';
  dom.cardZh.textContent = w.zh;
  dom.exampleEn.textContent = w.example || '';
  dom.exampleZh.textContent = w.exampleZh || '';
  // Hide example section if no example
  const exampleSection = document.querySelector('.card-example');
  if (exampleSection) {
    exampleSection.style.display = (w.example) ? '' : 'none';
  }
  dom.cardInner.classList.remove('flipped');

  // Update UI
  dom.learnProgress.textContent = `${state.wordIndex + 1} / ${words.length}`;
  dom.cardFav.style.display = '';
  dom.cardSpeak.style.display = '';
  dom.cardKnown.style.display = '';

  // Heart state
  dom.cardFav.textContent = state.favorites.has(w.en) ? '❤️' : '🤍';
  dom.cardFav.dataset.en = w.en;

  // Known button
  const isMastered = state.mastered.has(w.en);
  dom.cardKnown.textContent = isMastered ? '✅ 已掌握' : '✅ 记住了';
  dom.cardKnown.dataset.en = w.en;

  // Record study (once per session)
  recordStudy();

  // Reset swipe
  dom.cardInner.classList.remove('swiping-left', 'swiping-right');
}

// 翻转卡片
dom.flashcard.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) return; // 让按钮自己处理
  dom.cardInner.classList.toggle('flipped');
});

// 收藏
dom.cardFav.addEventListener('click', (e) => {
  e.stopPropagation();
  const en = dom.cardFav.dataset.en;
  if (state.favorites.has(en)) {
    state.favorites.delete(en);
    dom.cardFav.textContent = '🤍';
    showToast('已取消收藏');
  } else {
    state.favorites.add(en);
    dom.cardFav.textContent = '❤️';
    showToast('已收藏 ❤️');
  }
  saveSet(LS.FAVORITES, state.favorites);
});

// 朗读
dom.cardSpeak.addEventListener('click', (e) => {
  e.stopPropagation();
  const word = dom.cardWord.textContent;
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US'; u.rate = 0.85;
    speechSynthesis.speak(u);
  }
});

// 记住了
dom.cardKnown.addEventListener('click', (e) => {
  e.stopPropagation();
  const en = dom.cardKnown.dataset.en;
  state.mastered.add(en);
  state.learned.add(en);
  saveSet(LS.MASTERED, state.mastered);
  saveSet(LS.LEARNED, state.learned);
  showToast('🎉 太棒了！');
  nextCard();
});

// 左滑/右滑（手动按钮+触摸）
function nextCard() {
  dom.cardInner.classList.add('swiping-right');
  setTimeout(() => {
    state.wordIndex++;
    showCard();
  }, 250);
}

function prevCard() {
  if (state.wordIndex > 0) {
    dom.cardInner.classList.add('swiping-left');
    setTimeout(() => {
      state.wordIndex--;
      showCard();
    }, 250);
  }
}

// 触摸滑动支持
let touchStartX = 0, touchStartY = 0, isSwiping = false;
dom.flashcard.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
}, { passive: true });

dom.flashcard.addEventListener('touchmove', (e) => {
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    isSwiping = true;
    dom.cardInner.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
    dom.cardInner.style.transition = 'none';
  }
}, { passive: true });

dom.flashcard.addEventListener('touchend', (e) => {
  dom.cardInner.style.transition = '';
  dom.cardInner.style.transform = '';
  if (!isSwiping) {
    // 如果是点击不是滑动，让 click 事件处理翻转
    const btn = e.target.closest('button');
    if (!btn && !dom.cardInner.classList.contains('swiping-right') && !dom.cardInner.classList.contains('swiping-left')) {
      // click 事件会处理
    }
    return;
  }
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx < -80) {
    dom.cardInner.classList.add('swiping-left');
    setTimeout(() => { state.wordIndex++; showCard(); }, 250);
  } else if (dx > 80) {
    dom.cardInner.classList.add('swiping-right');
    setTimeout(() => {
      if (state.wordIndex > 0) { state.wordIndex--; showCard(); }
      else showCard();
    }, 250);
  }
  isSwiping = false;
}, { passive: true });

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('screen-learn').classList.contains('active')) return;
  switch (e.key) {
    case 'ArrowRight': case ' ': nextCard(); e.preventDefault(); break;
    case 'ArrowLeft': prevCard(); e.preventDefault(); break;
    case 'Enter': dom.cardInner.classList.toggle('flipped'); e.preventDefault(); break;
  }
});

// ====== 记录学习 ======
function recordStudy() {
  const today = new Date().toISOString().slice(0, 10);
  state.studyDays[today] = (state.studyDays[today] || 0) + 1;
  // 限制每词只计一次
  if (state.studyDays[today] > 200) return;
  saveObj(LS.STUDY_DAYS, state.studyDays);
  refreshHome();
}

// ====== 快速复习 ======
dom.quickReview.addEventListener('click', () => {
  const learned = [...state.learned];
  if (learned.length === 0) { showToast('还没有学过的单词，先选择分类学习吧'); return; }
  // 取最近学的 20 个（按 mastered 集排）
  const words = learned.slice(-20).map(en => {
    for (const catKey of Object.keys(WORD_DB)) {
      const found = WORD_DB[catKey].find(w => w.en === en);
      if (found) return found;
    }
    return null;
  }).filter(Boolean);
  if (words.length === 0) { showToast('没有可复习的词'); return; }
  state.currentCategory = 'review';
  state.currentWords = words;
  state.wordIndex = 0;
  dom.learnTitle.textContent = '🔄 快速复习';
  switchScreen('learn');
  showCard();
});

dom.quickRandom.addEventListener('click', () => {
  const allWords = [];
  for (const catKey of Object.keys(WORD_DB)) {
    allWords.push(...WORD_DB[catKey]);
  }
  shuffle(allWords);
  state.currentCategory = 'random';
  state.currentWords = allWords.slice(0, 20);
  state.wordIndex = 0;
  dom.learnTitle.textContent = '🎲 随机单词';
  switchScreen('learn');
  showCard();
});

// ====== 测试模式（完全独立，不依赖页面CSS） ======
function startQuiz(catId) {
  // 收集单词
  let pool = [];
  if (catId === 'all') {
    for (const key of Object.keys(WORD_DB)) pool.push(...WORD_DB[key]);
  } else {
    pool = [...(WORD_DB[catId] || [])];
  }
  if (pool.length < 4) { showToast('单词太少，无法测试'); return; }

  shuffle(pool);
  const words = pool.slice(0, 10);
  let idx = 0, correctCount = 0, answered = false;

  // 构建测试界面（纯内联样式，不受主 CSS 影响）
  const wrap = document.createElement('div');
  wrap.id = '__quiz_wrap';
  wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#f2f2f7;z-index:9999;font-family:-apple-system,sans-serif;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch';
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 12px">
      <button id="__q_back" style="border:none;background:none;font-size:16px;color:#007aff;padding:4px 0">‹ 返回首页</button>
      <span id="__q_progress" style="font-size:14px;color:#8e8e93;font-weight:500">1 / 10</span>
      <button id="__q_skip" style="border:none;background:none;font-size:14px;color:#007aff">跳过 ›</button>
    </div>
    <div id="__q_word" style="font-size:32px;font-weight:700;text-align:center;margin:24px 0 8px;color:#1c1c1e"></div>
    <div style="text-align:center;color:#8e8e93;margin-bottom:28px;font-size:15px">请选择正确的中文意思：</div>
    <div id="__q_opts" style="display:flex;flex-direction:column;gap:12px"></div>
    <div id="__q_fb" style="text-align:center;font-size:18px;font-weight:600;min-height:28px;margin-top:20px"></div>
    <div id="__q_result" style="display:none;text-align:center;padding:40px 0">
      <div style="font-size:64px">🎉</div>
      <div style="font-size:22px;font-weight:700;margin:8px 0">测试完成！</div>
      <div id="__q_score" style="font-size:48px;font-weight:800;margin:12px 0"></div>
      <div id="__q_msg" style="font-size:16px;color:#8e8e93;margin-bottom:24px"></div>
      <button id="__q_retry" style="width:100%;padding:16px;border:none;border-radius:14px;font-size:16px;font-weight:600;background:linear-gradient(135deg,#007aff,#5856d6);color:#fff;margin-bottom:10px;cursor:pointer">🔄 再来一次</button>
      <button id="__q_home" style="width:100%;padding:16px;border:0.5px solid rgba(255,255,255,0.5);border-radius:14px;font-size:16px;font-weight:600;background:rgba(255,255,255,0.85);color:#007aff;cursor:pointer">🏠 返回首页</button>
    </div>
  `;
  document.body.appendChild(wrap);

  // 获取元素
  const qWord = document.getElementById('__q_word');
  const qOpts = document.getElementById('__q_opts');
  const qFb = document.getElementById('__q_fb');
  const qProg = document.getElementById('__q_progress');
  const qResult = document.getElementById('__q_result');

  // 收集所有中文释义
  const allZh = [];
  for (const key of Object.keys(WORD_DB)) for (const ww of WORD_DB[key]) allZh.push(ww.zh);

  function showQ() {
    if (idx >= words.length) { showR(); return; }
    const w = words[idx];
    qWord.textContent = w.en;
    qProg.textContent = (idx + 1) + ' / ' + words.length;
    answered = false;
    qFb.textContent = '';
    qFb.style.color = '';
    qResult.style.display = 'none';

    const ans = w.zh;
    const opts = [ans];
    while (opts.length < 4) {
      const p = allZh[Math.floor(Math.random() * allZh.length)];
      if (!opts.includes(p)) opts.push(p);
    }
    shuffle(opts);

    qOpts.innerHTML = opts.map(o => {
      const safe = o.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      return `<button class="__q_btn" data-zh="${safe}" style="width:100%;padding:18px;border-radius:14px;border:1.5px solid rgba(0,0,0,0.06);background:rgba(255,255,255,0.85);font-size:17px;color:#1c1c1e;cursor:pointer;text-align:left;font-family:inherit;-webkit-touch-callout:none;touch-action:manipulation">${o}</button>`;
    }).join('');

    // 点击处理
    qOpts.onclick = function(e) {
      const btn = e.target.closest('.__q_btn');
      if (!btn || btn.disabled || answered) return;
      answered = true;
      const selected = btn.dataset.zh;
      const isRight = selected === ans;

      state.quizHist.total++;
      if (isRight) {
        correctCount++;
        qFb.textContent = '✅ 正确！';
        qFb.style.color = '#34c759';
        btn.style.borderColor = '#34c759';
        btn.style.background = '#e8f8ee';
      } else {
        qFb.textContent = '❌ 答案是：' + ans;
        qFb.style.color = '#ff3b30';
        btn.style.borderColor = '#ff3b30';
        btn.style.background = '#fff0ef';
        qOpts.querySelectorAll('.__q_btn').forEach(b => {
          if (b.dataset.zh === ans) { b.style.borderColor = '#34c759'; b.style.background = '#e8f8ee'; }
        });
      }
      saveObj(LS.QUIZ_HIST, state.quizHist);
      qOpts.querySelectorAll('.__q_btn').forEach(b => b.disabled = true);
      setTimeout(() => { idx++; showQ(); }, 1200);
    };
  }

  function showR() {
    qOpts.style.display = 'none';
    qFb.style.display = 'none';
    document.querySelector('#__q_word').style.display = 'none';
    document.querySelector('#__q_word + div').style.display = 'none';
    qResult.style.display = 'block';
    const total = words.length;
    document.getElementById('__q_score').textContent = correctCount + ' / ' + total;
    const pct = Math.round(correctCount / total * 100);
    document.getElementById('__q_msg').textContent =
      pct === 100 ? '🌟 满分！太厉害了！' :
      pct >= 80 ? '🎉 很棒！继续加油！' :
      pct >= 60 ? '👍 不错，再复习一下！' : '💪 加油，多背几遍就好了！';
    document.getElementById('__q_skip').style.display = 'none';
  }

  // 事件绑定
  document.getElementById('__q_back').onclick = function() { wrap.remove(); switchScreen('home'); };
  document.getElementById('__q_home').onclick = function() { wrap.remove(); switchScreen('home'); };
  document.getElementById('__q_retry').onclick = function() {
    shuffle(words); idx = 0; correctCount = 0; answered = false;
    qOpts.style.display = ''; qFb.style.display = '';
    document.querySelector('#__q_word').style.display = '';
    document.querySelector('#__q_word + div').style.display = '';
    document.getElementById('__q_skip').style.display = '';
    showQ();
  };
  document.getElementById('__q_skip').onclick = function() {
    if (!answered && idx < words.length) { idx++; showQ(); }
  };

  // 高亮 nav
  dom.nav.forEach(btn => btn.classList.toggle('active', btn.dataset.screen === 'quiz'));
  showQ();
}

// 从首页启动测试
function addQuizTriggers() {
  document.querySelectorAll('.cat-card').forEach(el => {
    el.addEventListener('dblclick', () => {
      startQuiz(el.dataset.cat);
    });
  });
}

// ====== 收藏页面 ======
function refreshFavorites() {
  const favArr = [...state.favorites];
  dom.favCount.textContent = `${favArr.length} 词`;

  if (favArr.length === 0) {
    dom.favList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⭐</div>
        <p>还没有收藏单词</p>
        <p class="empty-hint">学习时点击 🤍 收藏喜欢的单词</p>
      </div>
    `;
    return;
  }

  // Find words from DB
  const favWords = favArr.map(en => {
    for (const key of Object.keys(WORD_DB)) {
      const found = WORD_DB[key].find(w => w.en === en);
      if (found) return found;
    }
    return null;
  }).filter(Boolean);

  dom.favList.innerHTML = favWords.map(w => `
    <div class="word-list-item" data-en="${w.en}">
      <span class="word-list-en">${w.en}</span>
      <span class="word-list-zh">${w.zh}</span>
      <button class="word-list-remove" data-en="${w.en}">✕</button>
    </div>
  `).join('');

  // Click to review
  dom.favList.querySelectorAll('.word-list-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.word-list-remove')) return;
      const en = el.dataset.en;
      // Start learning with just favorites
      const word = favWords.find(w => w.en === en);
      if (word) {
        state.currentCategory = 'favorites';
        state.currentWords = favWords;
        state.wordIndex = favWords.indexOf(word);
        dom.learnTitle.textContent = '⭐ 我的收藏';
        switchScreen('learn');
        showCard();
      }
    });
  });

  // Remove from favorites
  dom.favList.querySelectorAll('.word-list-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.favorites.delete(btn.dataset.en);
      saveSet(LS.FAVORITES, state.favorites);
      refreshFavorites();
      showToast('已移除收藏');
    });
  });
}

dom.favClear.addEventListener('click', () => {
  if (state.favorites.size === 0) return;
  if (confirm('确定清空所有收藏吗？')) {
    state.favorites.clear();
    saveSet(LS.FAVORITES, state.favorites);
    refreshFavorites();
    showToast('已清空收藏');
  }
});

// ====== 统计页面 ======
function refreshStats() {
  dom.statTotalLearned.textContent = state.learned.size;
  dom.statMastered.textContent = state.mastered.size;
  dom.statStreak.textContent = calcStreak();
  const avg = state.quizHist.total > 0 ? Math.round(state.quizHist.correct / state.quizHist.total * 100) : 0;
  dom.statQuizAvg.textContent = `${avg}%`;

  // Category progress
  dom.catProgress.innerHTML = CATEGORIES.map(cat => {
    const words = WORD_DB[cat.id] || [];
    const mastered = words.filter(w => state.mastered.has(w.en)).length;
    const pct = words.length > 0 ? Math.round(mastered / words.length * 100) : 0;
    return `
      <div class="cat-progress-row" data-cat="${cat.id}">
        <div class="cat-progress-icon">${cat.icon}</div>
        <div class="cat-progress-name">${cat.name}</div>
        <div class="cat-progress-track">
          <div class="cat-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="cat-progress-num">${mastered}/${words.length}</div>
      </div>
    `;
  }).join('');

  // Study calendar (last 28 days)
  const today = new Date();
  let calHTML = '';
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const isToday = i === 0;
    const studied = state.studyDays[key] > 0;
    const dayOfMonth = d.getDate();
    calHTML += `
      <div class="calendar-day ${studied ? 'studied' : ''} ${isToday ? 'today' : ''}">
        ${dayOfMonth}
      </div>
    `;
  }
  dom.studyCalendar.innerHTML = calHTML;
}

// ====== 首页分类卡片双击触发测试 ======
// 在 refreshHome 里已经渲染，我们可以监听双击
document.addEventListener('dblclick', (e) => {
  const catCard = e.target.closest('.cat-card');
  if (catCard) {
    const catId = catCard.dataset.cat;
    startQuiz(catId);
  }
});

// ====== 初始化 ======
function refreshDailyCountUI() {
  if (dom.dailyCountDisplay) {
    dom.dailyCountDisplay.textContent = state.dailyCount;
  }
}

// 每日单词数调整
if (dom.dailyCountMinus) {
  dom.dailyCountMinus.addEventListener('click', () => {
    if (state.dailyCount > 3) {
      state.dailyCount--;
      saveObj(LS.DAILY_COUNT, state.dailyCount);
      refreshDailyCountUI();
    }
  });
}
if (dom.dailyCountPlus) {
  dom.dailyCountPlus.addEventListener('click', () => {
    if (state.dailyCount < 50) {
      state.dailyCount++;
      saveObj(LS.DAILY_COUNT, state.dailyCount);
      refreshDailyCountUI();
    }
  });
}

// ====== iOS 安全区域检测 ======
(function detectSafeArea() {
  // 方法1: 通过隐藏元素读取 env(safe-area-inset-bottom)
  var el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none;z-index:-1';
  document.body.appendChild(el);
  var safeBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  document.body.removeChild(el);

  // 方法2: 兜底 - 如果是 iPhone X+ (刘海屏) 但 env 没生效
  if (safeBottom < 10) {
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var hasNotch = window.innerWidth >= 375 && window.innerHeight >= 812;
    if (iOS && hasNotch) safeBottom = 34;
  }

  document.documentElement.style.setProperty('--safe-bottom', safeBottom + 'px');
})();

function init() {
  initTheme();
  refreshHome();
  refreshStats();
  refreshDailyCountUI();
}

// 启动
init();

// 暴露给分类页面双击测试
window.startQuiz = startQuiz;
