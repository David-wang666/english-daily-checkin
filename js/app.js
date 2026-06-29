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
  else if (id === 'quiz') startQuiz('all');
}

dom.nav.forEach(btn => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
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

// ====== 测试模式 ======
function startQuiz(catId) {
  let pool;
  if (catId === 'all') {
    pool = [];
    for (const key of Object.keys(WORD_DB)) pool.push(...WORD_DB[key]);
  } else {
    pool = [...(WORD_DB[catId] || [])];
  }
  if (pool.length < 4) { showToast('该分类单词太少，无法测试'); return; }

  shuffle(pool);
  state.quizWords = pool.slice(0, 10);
  state.quizIndex = 0;
  state.quizCorrect = 0;
  state.quizAnswered = false;
  dom.quizArea.style.display = '';
  dom.quizResult.style.display = 'none';
  dom.quizFeedback.textContent = '';
  dom.quizFeedback.className = 'quiz-feedback';
  switchScreen('quiz');
  showQuizQuestion();
}

function showQuizQuestion() {
  if (state.quizIndex >= state.quizWords.length) {
    showQuizResult();
    return;
  }

  const w = state.quizWords[state.quizIndex];
  dom.quizWord.textContent = w.en;
  dom.quizProgress.textContent = `${state.quizIndex + 1} / ${state.quizWords.length}`;
  state.quizAnswered = false;

  // Generate options: 1 correct + 3 random
  const correct = w.zh;
  const allZh = [];
  for (const key of Object.keys(WORD_DB)) {
    for (const ww of WORD_DB[key]) allZh.push(ww.zh);
  }
  const options = [correct];
  while (options.length < 4) {
    const pick = allZh[Math.floor(Math.random() * allZh.length)];
    if (!options.includes(pick)) options.push(pick);
  }
  shuffle(options);

  dom.quizOptions.innerHTML = options.map(opt => `
    <button class="quiz-option" data-zh="${opt}">${opt}</button>
  `).join('');

  dom.quizOptions.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => handleQuizAnswer(btn, correct));
  });
}

function handleQuizAnswer(btn, correct) {
  if (state.quizAnswered) return;
  state.quizAnswered = true;

  const selected = btn.dataset.zh;
  const isCorrect = selected === correct;

  state.quizHist.total++;
  if (isCorrect) {
    state.quizCorrect++;
    state.quizFeedback.textContent = '✅ 正确！';
    state.quizFeedback.className = 'quiz-feedback correct';
    btn.classList.add('correct');
  } else {
    state.quizFeedback.textContent = `❌ 答案是：${correct}`;
    state.quizFeedback.className = 'quiz-feedback wrong';
    btn.classList.add('wrong');
    // Show correct answer
    dom.quizOptions.querySelectorAll('.quiz-option').forEach(b => {
      if (b.dataset.zh === correct) b.classList.add('correct');
    });
  }

  saveObj(LS.QUIZ_HIST, state.quizHist);

  // Disable all
  dom.quizOptions.querySelectorAll('.quiz-option').forEach(b => b.classList.add('disabled'));

  // Auto-advance
  setTimeout(() => {
    state.quizIndex++;
    showQuizQuestion();
  }, 1200);
}

function showQuizResult() {
  dom.quizArea.style.display = 'none';
  dom.quizResult.style.display = 'block';
  const total = state.quizWords.length;
  const correct = state.quizCorrect;
  const pct = Math.round(correct / total * 100);
  dom.resultScore.textContent = `${correct} / ${total}`;

  if (pct === 100) dom.resultText.textContent = '🌟 满分！太厉害了！';
  else if (pct >= 80) dom.resultText.textContent = '🎉 很棒！继续加油！';
  else if (pct >= 60) dom.resultText.textContent = '👍 不错，再复习一下！';
  else dom.resultText.textContent = '💪 加油，多背几遍就好了！';
}

dom.quizRetry.addEventListener('click', () => {
  state.quizIndex = 0;
  state.quizCorrect = 0;
  state.quizAnswered = false;
  dom.quizArea.style.display = '';
  dom.quizResult.style.display = 'none';
  shuffle(state.quizWords);
  showQuizQuestion();
});

dom.quizBackHome.addEventListener('click', () => switchScreen('home'));

dom.quizSkip.addEventListener('click', () => {
  if (!state.quizAnswered) {
    state.quizIndex++;
    showQuizQuestion();
  }
});

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
