(function () {
  "use strict";

  var SUBJECTS = {
    quiz: {
      name: "성경 퀴즈",
      desc: "에스라 · 느헤미야 · 에스더 · 욥기 · 잠언 · 전도서 · 아가",
      icon: "📖",
      questions: window.QUIZ_QUESTIONS || []
    },
    exam: {
      name: "성경 고사",
      desc: "킹덤 스토리 2-1·2-2 (1–48과)",
      icon: "✏️",
      questions: window.EXAM_QUESTIONS || []
    }
  };

  var MODES = {
    daily: { name: "하루에 5문제", desc: "1번부터 차례대로 매일 5문제씩" },
    all: { name: "100문제 풀기", desc: "전체 문제를 처음부터 끝까지" },
    random: { name: "랜덤 5문제", desc: "무작위로 고른 5문제" }
  };

  var CIRCLED = ["①", "②", "③", "④"];
  var STORE_KEY = "sundoo-bible-quiz-v1";
  var app = document.getElementById("app");
  var titleEl = document.getElementById("title");
  var backBtn = document.getElementById("backBtn");
  var backAction = null;
  var tabbar = document.getElementById("tabbar");
  var tabButtons = Array.prototype.slice.call(tabbar.querySelectorAll("[data-tab]"));
  var EVENT_NAME = "2027 인천노회 어린이대회";

  // ---------- 저장소 ----------
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 저장소를 쓸 수 없으면 새로 시작 */ }
    return {};
  }
  var store = loadStore();
  migrateStamps();

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ }
  }

  // 예전에는 과목마다 도장판이 따로 있었습니다. 하나의 도장판으로 합칩니다.
  function migrateStamps() {
    store.stamps = store.stamps || {};
    Object.keys(SUBJECTS).forEach(function (key) {
      var old = store[key] && store[key].stamps;
      if (!old) return;
      Object.keys(old).forEach(function (d) {
        if (old[d] === "done" || !store.stamps[d]) store.stamps[d] = old[d];
      });
      delete store[key].stamps;
    });
  }

  function subjectState(key) {
    if (!store[key]) store[key] = {};
    var s = store[key];
    s.dailyPointer = s.dailyPointer || 0;
    s.dailyLog = s.dailyLog || {};   // { "2026-10-10": 시작 번호 }
    return s;
  }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // 성경 퀴즈·성경 고사 둘 중 하나라도 하면 그날 도장이 찍힙니다.
  function stamp(kind) {
    var today = dateKey();
    // 완료(파란 도장)는 출석(초록 도장)을 덮어쓰고, 반대로는 바뀌지 않습니다.
    if (kind === "done" || !store.stamps[today]) store.stamps[today] = kind;
    saveStore();
  }

  // ---------- 화면 공통 ----------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") el.className = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else if (k === "html") el.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  // tab: 아래 탭 중 선택할 것. 문제를 푸는 중에는 null로 탭을 숨깁니다.
  function setScreen(title, onBack, nodes, tab) {
    titleEl.textContent = title;
    backAction = onBack;
    backBtn.hidden = !onBack;
    tabbar.hidden = !tab;
    document.body.classList.toggle("has-tabbar", !!tab);
    tabButtons.forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    app.innerHTML = "";
    nodes.forEach(function (n) { if (n) app.appendChild(n); });
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener("click", function () {
    if (backAction) backAction();
  });

  tabButtons.forEach(function (b) {
    b.addEventListener("click", function () { showTab(b.getAttribute("data-tab")); });
  });

  function showTab(tab) {
    if (tab === "stamps") showStamps();
    else showSubject(tab);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 문제의 '( )' 빈칸을 밑줄 칸으로 보여 줍니다.
  function questionHtml(text) {
    return escapeHtml(text).replace(/\(\s*\)/g, '<span class="blank"></span>');
  }

  function todayBanner() {
    var done = store.stamps[dateKey()] === "done";
    return h("div", { class: "today-banner " + (done ? "done" : "attend") }, [
      h("span", { class: "mini-stamp " + (done ? "done" : "attend"), text: done ? "완료" : "출석" }),
      h("span", { text: done ? "오늘 문제를 다 풀었어요! 파란 도장 꾹!" : "오늘 출석했어요! 문제를 끝까지 풀면 파란 도장으로 바뀌어요." })
    ]);
  }

  // ---------- 성경 퀴즈 / 성경 고사 탭 ----------
  function showSubject(key) {
    stamp("attend");
    var sub = SUBJECTS[key];
    var st = subjectState(key);
    var total = sub.questions.length;
    var today = dateKey();

    var dailyStart = st.dailyLog[today] != null ? st.dailyLog[today] : st.dailyPointer;
    var dailyRange = (dailyStart + 1) + "–" + Math.min(dailyStart + 5, total) + "번";

    var modeButtons = h("div", { class: "mode-list" }, Object.keys(MODES).map(function (m) {
      var extra = m === "daily" ? "오늘 " + dailyRange : m === "all" ? total + "문제" : "매번 새로 뽑기";
      return h("button", { class: "mode-card", onclick: function () { startSession(key, m); } }, [
        h("strong", { text: MODES[m].name }),
        h("small", { text: MODES[m].desc }),
        h("span", { class: "mode-extra", text: extra })
      ]);
    }));

    setScreen(sub.name + " 예상문제", null, [
      h("section", { class: "hero hero-" + key }, [
        h("p", { class: "hero-sub", text: EVENT_NAME }),
        h("h2", { text: sub.name + " 예상문제" }),
        h("p", { class: "hero-desc", text: sub.desc + " · " + total + "문항" })
      ]),
      todayBanner(),
      h("h3", { class: "section-title", text: "풀기 방식 선택" }),
      modeButtons,
      h("p", { class: "notice", text: "실제 대회 문제가 아닌 예상문제입니다." })
    ], key);
  }

  // ---------- 도장판 탭 ----------
  function showStamps(viewMonth) {
    var now = new Date();
    var month = viewMonth || new Date(now.getFullYear(), now.getMonth(), 1);
    var y = month.getFullYear(), m = month.getMonth();
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var todayKey = dateKey();

    var grid = h("div", { class: "cal-grid" });
    ["일", "월", "화", "수", "목", "금", "토"].forEach(function (d, i) {
      grid.appendChild(h("div", { class: "cal-head" + (i === 0 ? " sun" : i === 6 ? " sat" : ""), text: d }));
    });
    for (var i = 0; i < first; i++) grid.appendChild(h("div", { class: "cal-cell empty" }));

    var attendCount = 0, doneCount = 0;
    for (var d = 1; d <= days; d++) {
      var k = y + "-" + pad(m + 1) + "-" + pad(d);
      var kind = store.stamps[k];
      if (kind === "attend") attendCount++;
      if (kind === "done") doneCount++;
      grid.appendChild(h("div", { class: "cal-cell" + (k === todayKey ? " today" : "") }, [
        h("span", { class: "cal-day", text: String(d) }),
        kind ? h("span", { class: "stamp " + kind, text: kind === "done" ? "완료" : "출석" }) : null
      ]));
    }

    setScreen("도장판", null, [
      h("section", { class: "hero" }, [
        h("p", { class: "hero-sub", text: EVENT_NAME }),
        h("h2", { text: "날짜 도장판" }),
        h("p", { class: "hero-desc", text: "성경 퀴즈나 성경 고사 중 하나라도 하면 도장이 찍혀요." })
      ]),
      h("section", { class: "board" }, [
        h("div", { class: "board-nav" }, [
          h("button", { class: "icon-btn", "aria-label": "이전 달", onclick: function () { showStamps(new Date(y, m - 1, 1)); }, text: "‹" }),
          h("strong", { text: y + "년 " + (m + 1) + "월" }),
          h("button", { class: "icon-btn", "aria-label": "다음 달", onclick: function () { showStamps(new Date(y, m + 1, 1)); }, text: "›" })
        ]),
        grid,
        h("div", { class: "legend" }, [
          h("span", null, [h("span", { class: "dot attend" }), "출석 " + attendCount + "일"]),
          h("span", null, [h("span", { class: "dot done" }), "문제 완료 " + doneCount + "일"])
        ])
      ]),
      h("p", { class: "notice", text: "초록 도장: 출석 · 파란 도장: 고른 문제를 끝까지 푼 날" })
    ], "stamps");
  }

  // ---------- 4. 문제 풀기 ----------
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startSession(key, mode) {
    var sub = SUBJECTS[key];
    var st = subjectState(key);
    var qs = sub.questions;
    var list;
    if (mode === "daily") {
      var today = dateKey();
      if (st.dailyLog[today] == null) {
        st.dailyLog[today] = st.dailyPointer;
        saveStore();
      }
      var start = st.dailyLog[today];
      list = qs.slice(start, start + 5);
    } else if (mode === "all") {
      list = qs.slice();
    } else {
      list = shuffle(qs).slice(0, 5);
    }
    var session = { key: key, mode: mode, list: list, index: 0, results: [] };
    showQuestion(session);
  }

  function leaveSession(session) {
    if (session.results.length === 0 || document.querySelector(".confirm-bar")) {
      showSubject(session.key);
      return;
    }
    // 브라우저 확인 창을 쓸 수 없는 환경도 있어 화면 안에서 묻습니다.
    var bar = h("div", { class: "confirm-bar", role: "alertdialog" }, [
      h("p", { text: "풀던 문제를 그만둘까요? 지금까지 푼 기록은 저장되지 않아요." }),
      h("div", { class: "confirm-actions" }, [
        h("button", { class: "ghost", text: "계속 풀기", onclick: function () { bar.remove(); } }),
        h("button", { class: "primary", text: "그만두기", onclick: function () { showSubject(session.key); } })
      ])
    ]);
    app.insertBefore(bar, app.firstChild);
    window.scrollTo(0, 0);
  }

  function normalize(s) {
    return String(s).replace(/[\s.,·'"‘’“”!?~()\-]/g, "").toLowerCase();
  }

  // 해설에 적힌 '…도 정답' 표현까지 함께 정답으로 인정합니다.
  function acceptedAnswers(q) {
    var answers = [q.answer];
    // 예: ‘숯’, ‘핀 숯’도 정답 / '출생 전', '모태에 있기 전' 등 같은 뜻이면 정답
    // ('‘돈 자체’와 구별합니다'처럼 '도/등'이 붙지 않은 따옴표는 정답이 아닙니다.)
    if (/정답|인정/.test(q.explanation)) {
      var group = /((?:[‘'“"][^’'”"]+[’'”"],?\s*)+)(?:도|등)/g, g, m;
      while ((g = group.exec(q.explanation))) {
        var re = /[‘'“"]([^’'”"]+)[’'”"]/g;
        while ((m = re.exec(g[1]))) answers.push(m[1]);
      }
    }
    return answers;
  }

  function isShortCorrect(q, input) {
    var v = normalize(input);
    if (!v) return false;
    return acceptedAnswers(q).some(function (a) {
      var n = normalize(a);
      // '세 번' ↔ '3번'처럼 숫자를 섞어 쓰는 경우를 대비해 핵심어 포함도 인정합니다.
      return n === v || (n.length >= 2 && v.indexOf(n) >= 0);
    });
  }

  function showQuestion(session) {
    var sub = SUBJECTS[session.key];
    var q = session.list[session.index];
    var total = session.list.length;
    var selected = null;
    var checked = false;

    var progress = h("div", { class: "progress" }, [
      h("div", { class: "progress-bar", style: "width:" + (session.index / total * 100) + "%" })
    ]);

    var head = h("div", { class: "q-head" }, [
      h("span", { class: "chip", text: q.section }),
      h("span", { class: "q-count", text: (session.index + 1) + " / " + total })
    ]);

    var qText = h("p", { class: "q-text", html: "<b>" + q.no + ".</b> " + questionHtml(q.question) });

    var answerArea, input;
    var choiceButtons = [];

    function select(i, btn) {
      if (checked) return;
      selected = i;
      choiceButtons.forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      checkBtn.disabled = false;
    }

    if (q.type === "choice") {
      answerArea = h("div", { class: "choices" }, q.options.map(function (opt, i) {
        var b = h("button", { class: "choice", onclick: function () { select(i, b); } }, [
          h("span", { class: "choice-mark", text: CIRCLED[i] }),
          h("span", { text: opt })
        ]);
        choiceButtons.push(b);
        return b;
      }));
    } else if (q.type === "ox") {
      answerArea = h("div", { class: "ox" }, ["O", "X"].map(function (v) {
        var b = h("button", { class: "ox-btn ox-" + v.toLowerCase(), text: v, onclick: function () { select(v, b); } });
        choiceButtons.push(b);
        return b;
      }));
    } else {
      input = h("textarea", { class: "short-input", rows: "2", placeholder: "답을 써 보세요" });
      input.addEventListener("input", function () { checkBtn.disabled = !input.value.trim(); });
      answerArea = h("div", null, [input]);
    }

    var feedback = h("div", { class: "feedback", hidden: "hidden" });
    var checkBtn = h("button", { class: "primary", text: "확인", disabled: "disabled", onclick: check });
    var nextBtn = h("button", { class: "primary", text: session.index + 1 < total ? "다음 문제" : "결과 보기", hidden: "hidden", onclick: next });

    function check() {
      if (checked) return;
      checked = true;
      var correct, answerText, userText;
      if (q.type === "choice") {
        correct = selected === q.answer;
        answerText = CIRCLED[q.answer] + " " + q.options[q.answer];
        userText = CIRCLED[selected] + " " + q.options[selected];
        choiceButtons.forEach(function (b, i) {
          b.disabled = true;
          if (i === q.answer) b.classList.add("correct");
          else if (i === selected) b.classList.add("wrong");
        });
      } else if (q.type === "ox") {
        correct = selected === q.answer;
        answerText = q.answer;
        userText = selected;
        choiceButtons.forEach(function (b) {
          b.disabled = true;
          if (b.textContent === q.answer) b.classList.add("correct");
          else if (b.textContent === selected) b.classList.add("wrong");
        });
      } else {
        userText = input.value.trim();
        correct = isShortCorrect(q, userText);
        answerText = q.answer;
        input.readOnly = true;
      }
      var result = { q: q, correct: correct, user: userText };
      session.results.push(result);
      renderFeedback(result, answerText);
      checkBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus();
    }

    function renderFeedback(result, answerText) {
      feedback.hidden = false;
      feedback.className = "feedback " + (result.correct ? "ok" : "no");
      feedback.innerHTML = "";
      feedback.appendChild(h("p", { class: "verdict", text: result.correct ? "⭕ 정답이에요!" : "❌ 아쉬워요!" }));
      feedback.appendChild(h("p", { class: "answer-line" }, [h("b", { text: "정답 " }), answerText]));
      if (q.explanation) feedback.appendChild(h("p", { class: "explain" }, [h("b", { text: "해설 " }), q.explanation]));
      if (q.source) feedback.appendChild(h("p", { class: "source" }, [h("b", { text: "근거 " }), q.source]));
      if (q.type === "short" && !result.correct) {
        feedback.appendChild(h("button", { class: "ghost", text: "내 답도 같은 뜻이에요 (정답 처리)", onclick: function () {
          result.correct = true;
          renderFeedback(result, answerText);
        } }));
      }
    }

    function next() {
      session.index++;
      if (session.index < total) showQuestion(session);
      else finishSession(session);
    }

    setScreen(sub.name + " · " + MODES[session.mode].name, function () { leaveSession(session); }, [
      progress,
      h("article", { class: "q-card" }, [head, qText, answerArea, feedback]),
      h("div", { class: "actions" }, [checkBtn, nextBtn])
    ]);
  }

  // ---------- 결과 ----------
  function finishSession(session) {
    var st = subjectState(session.key);
    if (session.mode === "daily") {
      var start = st.dailyLog[dateKey()];
      // 오늘 분량을 처음 끝냈을 때만 다음 날 시작 번호를 넘깁니다.
      if (st.dailyPointer === start) {
        st.dailyPointer = (start + 5) % SUBJECTS[session.key].questions.length;
      }
    }
    saveStore();
    stamp("done");

    var score = session.results.filter(function (r) { return r.correct; }).length;
    var total = session.results.length;
    var wrong = session.results.filter(function (r) { return !r.correct; });

    var wrongList = wrong.length ? h("section", { class: "review" }, [h("h3", { class: "section-title", text: "틀린 문제 다시 보기" })].concat(
      wrong.map(function (r) {
        var q = r.q;
        var ans = q.type === "choice" ? CIRCLED[q.answer] + " " + q.options[q.answer] : q.answer;
        return h("div", { class: "review-item" }, [
          h("p", { class: "q-text small", html: "<b>" + q.no + ".</b> " + questionHtml(q.question) }),
          h("p", { class: "my-answer" }, [h("b", { text: "내 답 " }), r.user || "(빈칸)"]),
          h("p", { class: "answer-line" }, [h("b", { text: "정답 " }), ans]),
          q.explanation ? h("p", { class: "explain" }, [h("b", { text: "해설 " }), q.explanation]) : null
        ]);
      })
    )) : null;

    setScreen("결과", function () { showSubject(session.key); }, [
      h("section", { class: "result" }, [
        h("div", { class: "big-stamp", text: "완료" }),
        h("p", { class: "score" }, [h("strong", { text: String(score) }), " / " + total]),
        h("p", { text: score === total ? "모두 맞혔어요! 정말 잘했어요 🎉" : "끝까지 잘 풀었어요! 도장판에 파란 도장이 찍혔어요." })
      ]),
      wrongList,
      h("div", { class: "actions" }, [
        h("button", { class: "primary", text: "도장판 보기", onclick: function () { showStamps(); } }),
        h("button", { class: "ghost", text: "다시 풀기", onclick: function () {
          session.mode === "random" ? startSession(session.key, "random")
            : showQuestion({ key: session.key, mode: session.mode, list: session.list, index: 0, results: [] });
        } })
      ])
    ]);
  }

  showSubject("quiz");
})();
