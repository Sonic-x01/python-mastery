/* ============================================================
   Python Mastery — Interactive course engine
   Vanilla JS · no build step · Pyodide for real Python runs
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Storage ---------------- */
  const STORE_KEY = "pythonCourse.v1";
  const THEME_KEY = "pythonCourse.theme";

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return {
        quizzes: raw.quizzes || {},
        challenges: raw.challenges || {},
        code: raw.code || {},
        celebrated: Boolean(raw.celebrated)
      };
    } catch (e) {
      return { quizzes: {}, challenges: {}, code: {}, celebrated: false };
    }
  }
  const state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage may be full/blocked — ignore */
    }
  }

  /* ---------------- Toast ---------------- */
  const toastEl = $("#toast");
  const toastTxt = $("#toastTxt");
  let toastTimer = null;

  function toast(message, icon = "✓") {
    if (!toastEl) return;
    const ico = toastEl.querySelector(".t-ico");
    if (ico) ico.textContent = icon;
    toastTxt.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------------- Theme ---------------- */
  const themeBtn = $("#themeBtn");

  function applyTheme(theme, persist = true) {
    document.documentElement.dataset.theme = theme;
    if (themeBtn) {
      themeBtn.textContent = theme === "light" ? "☀️" : "🌙";
      themeBtn.setAttribute("aria-label", theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح");
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f7fc" : "#050811");
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    }
  }

  function initTheme() {
    let saved = "dark";
    try { saved = localStorage.getItem(THEME_KEY) || "dark"; } catch (e) {}
    applyTheme(saved === "light" ? "light" : "dark", false);
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        applyTheme(next);
      });
    }
  }

  /* ---------------- Year ---------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Syntax highlighting ---------------- */
  const KEYWORDS = new Set(
    ("False None True and as assert async await break case class continue def del elif else except " +
      "finally for from global if import in is lambda match nonlocal not or pass raise return try " +
      "while with yield").split(" ")
  );
  const BUILTINS = new Set(
    ("print len range type int float str bool list dict set tuple sum min max abs round sorted reversed " +
      "enumerate zip map filter any all open input isinstance issubclass super property staticmethod " +
      "classmethod repr format id dir help hash callable iter next chr ord bin hex oct divmod pow eval " +
      "exec globals locals vars getattr setattr hasattr delattr object Exception ValueError TypeError " +
      "KeyError IndexError ZeroDivisionError FileNotFoundError").split(" ")
  );

  const escapeHtml = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const TOKEN_RE = /("""[\s\S]*?"""|'''[\s\S]*?'''|[fFrRbBuU]{0,2}"(?:\\.|[^"\\])*"|[fFrRbBuU]{0,2}'(?:\\.|[^'\\])*'|#[^\n]*|@[A-Za-z_]\w*|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b[A-Za-z_]\w*\b)/g;

  function highlight(code) {
    let out = "";
    let last = 0;
    let prev = "";
    code.replace(TOKEN_RE, (match, _g, offset) => {
      out += escapeHtml(code.slice(last, offset));
      let cls = "";
      if (match.charAt(0) === "#") cls = "com";
      else if (match.charAt(0) === "@") cls = "dec";
      else if (/^[fFrRbBuU]{0,2}["']/.test(match)) cls = "str";
      else if (/^\d/.test(match)) cls = "num";
      else if (match === "self" || match === "cls") cls = "self";
      else if (KEYWORDS.has(match)) cls = "kw";
      else if (BUILTINS.has(match)) cls = "builtin";
      else if (prev === "def" || prev === "class") cls = "fn";
      else {
        const rest = code.slice(offset + match.length);
        if (/^\s*\(/.test(rest)) cls = "fn";
      }
      out += cls ? '<span class="tok-' + cls + '">' + escapeHtml(match) + "</span>" : escapeHtml(match);
      last = offset + match.length;
      prev = match;
      return match;
    });
    out += escapeHtml(code.slice(last));
    return out;
  }

  function buildGutter(block) {
    const body = block.querySelector(".code-body");
    const pre = body && body.querySelector("pre.code-pre");
    const code = pre && pre.querySelector("code");
    if (!body || !pre || !code || body.querySelector(".gutter")) return;
    const text = code.textContent.replace(/\n+$/, "");
    const count = text.split("\n").length;
    const gutter = document.createElement("div");
    gutter.className = "gutter";
    gutter.setAttribute("aria-hidden", "true");
    gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join("\n");
    body.insertBefore(gutter, pre);
  }

  function initCodeBlocks() {
    $$("code.language-python").forEach((code) => {
      if (code.dataset.hl === "1") return;
      code.innerHTML = highlight(code.textContent);
      code.dataset.hl = "1";
    });
    $$(".code-block").forEach((block) => {
      buildGutter(block);
      const copyBtn = block.querySelector(".copy");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const code = block.querySelector("code");
          copyText(code ? code.textContent : "");
        });
      }
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard");
      }
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      ta.remove();
    }
    toast("تم نسخ الكود", "📋");
  }

  /* ---------------- Code engine: local server first, Pyodide fallback ---------------- */
  let serverAvailable = null;
  let healthPromise = null;

  async function hasLocalRunner() {
    if (serverAvailable !== null) return serverAvailable;
    if (!healthPromise) {
      healthPromise = (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1800);
          const res = await fetch("api/health", { signal: controller.signal, cache: "no-store" });
          clearTimeout(timer);
          if (!res.ok) return false;
          const data = await res.json();
          return Boolean(data && data.ok);
        } catch (e) {
          return false;
        }
      })();
    }
    serverAvailable = await healthPromise;
    return serverAvailable;
  }

  async function runLocal(code) {
    const res = await fetch("api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  const PYODIDE_VERSION = "0.26.4";
  const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
  let enginePromise = null;

  function loadEngine() {
    if (enginePromise) return enginePromise;
    enginePromise = new Promise((resolve, reject) => {
      const boot = () => {
        window
          .loadPyodide({ indexURL: PYODIDE_BASE })
          .then(resolve)
          .catch((err) => {
            enginePromise = null;
            reject(err);
          });
      };
      if (window.loadPyodide) {
        boot();
        return;
      }
      const script = document.createElement("script");
      script.src = PYODIDE_BASE + "pyodide.js";
      script.onload = boot;
      script.onerror = () => {
        enginePromise = null;
        reject(new Error("تعذّر تحميل محرك بايثون. تأكد من اتصال الإنترنت."));
      };
      document.head.appendChild(script);
    });
    return enginePromise;
  }

  const PY_WRAPPER = `
import sys, io, json, traceback
_buf = io.StringIO()
_err = io.StringIO()
_old_out, _old_err = sys.stdout, sys.stderr
sys.stdout, sys.stderr = _buf, _err
try:
    exec(compile(__user_code__, "<main>", "exec"), {"__name__": "__main__"})
except SystemExit:
    pass
except BaseException:
    traceback.print_exc()
finally:
    sys.stdout, sys.stderr = _old_out, _old_err
json.dumps({"out": _buf.getvalue(), "err": _err.getvalue()})
`;

  async function runWithPyodide(code) {
    const py = await loadEngine();
    py.globals.set("__user_code__", code);
    const raw = await py.runPythonAsync(PY_WRAPPER);
    return JSON.parse(raw);
  }

  async function runPython(code) {
    if (await hasLocalRunner()) {
      try {
        return await runLocal(code);
      } catch (e) {
        serverAvailable = false;
      }
    }
    try {
      return await runWithPyodide(code);
    } catch (e) {
      throw new Error(
        "تعذّر تشغيل بايثون. شغّل الملف start.bat عشان تستخدم بايثون المحلي بدون إنترنت، أو اتأكد من الاتصال بالإنترنت لتحميل Pyodide."
      );
    }
  }

  function normalizeOutput(text) {
    return String(text)
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/, ""))
      .join("\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");
  }

  function showConsole(consoleEl) {
    if (!consoleEl) return;
    consoleEl.hidden = false;
  }

  /* ---------------- Static runnable examples ---------------- */
  function initExampleRunners() {
    $$(".code-block[data-run]").forEach((block) => {
      const btn = block.querySelector(".run-mini");
      const out = block.querySelector(".run-out");
      const codeEl = block.querySelector("code");
      if (!btn || !out || !codeEl) return;

      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "⏳";
        out.hidden = false;
        if (!out.querySelector(".ro-head")) {
          out.innerHTML = '<div class="ro-head"><span class="dot"></span><span>OUTPUT</span></div><pre></pre><div class="ro-time"></div>';
        }
        const pre = out.querySelector("pre");
        const timeEl = out.querySelector(".ro-time");
        pre.classList.remove("err");
        pre.textContent = "⏳ جاري تجهيز محرك بايثون…";
        if (timeEl) timeEl.textContent = "";

        const started = performance.now();
        try {
          const result = await runPython(codeEl.textContent);
          const elapsed = ((performance.now() - started) / 1000).toFixed(2);
          if (result.err && result.err.trim()) {
            pre.classList.add("err");
            pre.textContent = result.err;
          } else {
            pre.textContent = result.out || "(الكود اتنفّذ بدون أي مخرجات)";
          }
          if (timeEl) timeEl.textContent = "⏱ " + elapsed + "s";
        } catch (err) {
          pre.classList.add("err");
          pre.textContent = "تعذّر التشغيل:\n" + (err && err.message ? err.message : err);
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    });
  }

  /* ---------------- Navigation ---------------- */
  const sections = $$("main .section[data-nav]");
  const nav = $("#nav");
  const navLinks = new Map();

  function initNav() {
    if (!nav) return;
    sections.forEach((section) => {
      const a = document.createElement("a");
      a.href = "#" + section.id;
      a.dataset.target = section.id;

      const num = document.createElement("span");
      num.className = "num";
      const idx = section.querySelector(".section-index");
      num.textContent = idx ? idx.textContent.trim() : "";

      const ico = document.createElement("span");
      ico.className = "ico";
      ico.textContent = section.dataset.icon || "•";

      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = section.dataset.nav || section.id;

      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = "✓";

      a.append(num, ico, txt, tick);
      nav.appendChild(a);
      navLinks.set(section.id, a);
    });
  }

  function initActiveSection() {
    const update = () => {
      let current = null;
      const offset = 150;
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= offset) current = section.id;
      });
      navLinks.forEach((link, sectionId) => {
        link.classList.toggle("active", sectionId === current);
      });
    };

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
      },
      { passive: true }
    );
    update();
  }

  /* ---------------- Nav search ---------------- */
  function initNavSearch() {
    const input = $("#navSearch");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      $$(".nav a").forEach((link) => {
        const section = document.getElementById(link.dataset.target);
        const haystack = (link.textContent + " " + (section ? section.dataset.keywords || "" : "")).toLowerCase();
        link.classList.toggle("hide", q !== "" && haystack.indexOf(q) === -1);
      });
    });
  }

  /* ---------------- Mobile drawer ---------------- */
  function initDrawer() {
    const sidebar = $("#sidebar");
    const scrim = $("#scrim");
    const menuBtn = $("#menuBtn");
    const closeBtn = $("#sidebarClose");

    const open = () => {
      sidebar.classList.add("open");
      scrim.classList.add("show");
      menuBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      sidebar.classList.remove("open");
      scrim.classList.remove("show");
      menuBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };

    if (menuBtn) menuBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (scrim) scrim.addEventListener("click", close);
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a") && window.innerWidth <= 980) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) close();
    });
  }

  /* ---------------- Progress ---------------- */
  const quizzes = $$(".quiz[data-ex]");
  const challenges = $$(".challenge[data-ex]");
  const totalExercises = quizzes.length + challenges.length;

  const scrollBar = $("#scrollBar");
  const topRing = $("#topRing");
  const topProgress = $("#topProgress");
  const sideRing = $("#sideRing");
  const sidePercent = $("#sidePercent");
  const sideCount = $("#sideCount");
  const finalSolved = $("#finalSolved");
  const finalTotal = $("#finalTotal");
  const finalSections = $("#finalSections");

  function solvedCount() {
    let count = 0;
    quizzes.forEach((q) => { if (state.quizzes[q.dataset.ex]) count++; });
    challenges.forEach((c) => { if (state.challenges[c.dataset.ex]) count++; });
    return count;
  }

  function updateProgress() {
    const solved = solvedCount();
    const ratio = totalExercises ? solved / totalExercises : 0;
    const percent = Math.round(ratio * 100);

    if (scrollBar) { /* scroll bar is scroll position, not progress */ }
    if (topProgress) topProgress.textContent = percent + "%";
    if (sidePercent) sidePercent.textContent = percent + "%";
    if (sideCount) sideCount.textContent = solved + " من " + totalExercises + " تمرين";
    if (topRing) topRing.style.strokeDashoffset = String(63 - 63 * ratio);
    if (sideRing) sideRing.style.strokeDashoffset = String(163 - 163 * ratio);
    if (finalSolved) finalSolved.textContent = solved;
    if (finalTotal) finalTotal.textContent = totalExercises;

    let doneSections = 0;
    sections.forEach((section) => {
      const qs = $$(".quiz[data-ex]", section);
      const cs = $$(".challenge[data-ex]", section);
      if (!qs.length && !cs.length) return;
      const allDone =
        qs.every((q) => state.quizzes[q.dataset.ex]) &&
        cs.every((c) => state.challenges[c.dataset.ex]);
      if (allDone) doneSections++;
      const link = navLinks.get(section.id);
      if (link) link.classList.toggle("done", allDone);
    });
    if (finalSections) finalSections.textContent = doneSections;

    if (ratio === 1 && !state.celebrated) {
      state.celebrated = true;
      saveState();
      confetti();
      toast("🎉 مبروك! خلصت كل تمارين الكورس", "🏆");
    }
  }

  /* ---------------- Quizzes ---------------- */
  function restoreQuiz(quiz) {
    const id = quiz.dataset.ex;
    const answer = Number(quiz.dataset.answer);
    const options = $$(".option", quiz);
    const feedback = quiz.querySelector(".quiz-feedback");

    if (!state.quizzes[id]) return;
    quiz.classList.add("solved");
    options.forEach((opt) => {
      opt.disabled = true;
      if (Number(opt.dataset.i) === answer) {
        opt.classList.add("correct");
        const mark = opt.querySelector(".mark");
        if (mark) mark.textContent = "✓";
      }
    });
    if (feedback) {
      feedback.className = "quiz-feedback show good";
      feedback.innerHTML = "<strong>تم حلها قبل كده ✓</strong> " + (feedback.dataset.good || "");
    }
  }

  function initQuizzes() {
    quizzes.forEach((quiz) => {
      const id = quiz.dataset.ex;
      const answer = Number(quiz.dataset.answer);
      const options = $$(".option", quiz);
      const feedback = quiz.querySelector(".quiz-feedback");

      restoreQuiz(quiz);

      options.forEach((opt) => {
        opt.addEventListener("click", () => {
          if (quiz.classList.contains("solved") || opt.disabled) return;
          const chosen = Number(opt.dataset.i);
          const mark = opt.querySelector(".mark");

          if (chosen === answer) {
            options.forEach((o) => {
              o.disabled = true;
              o.classList.remove("wrong");
            });
            opt.classList.add("correct");
            if (mark) mark.textContent = "✓";
            quiz.classList.add("solved");
            if (feedback) {
              feedback.className = "quiz-feedback show good";
              feedback.innerHTML = "<strong>إجابة صحيحة ✅</strong> " + (feedback.dataset.good || "");
            }
            state.quizzes[id] = true;
            saveState();
            updateProgress();
            toast("إجابة صحيحة — اتسجلت", "✅");
          } else {
            opt.classList.add("wrong");
            opt.disabled = true;
            if (mark) mark.textContent = "✗";
            if (feedback) {
              feedback.className = "quiz-feedback show bad";
              feedback.innerHTML = "<strong>مش للأسف ❌</strong> " + (feedback.dataset.bad || "");
            }
          }
        });
      });
    });
  }

  /* ---------------- Challenges ---------------- */
  function initChallenges() {
    challenges.forEach((challenge) => {
      const id = challenge.dataset.ex;
      const editor = challenge.querySelector("textarea");
      const runBtn = challenge.querySelector(".btn-run");
      const resetBtn = challenge.querySelector(".btn-reset");
      const solBtn = challenge.querySelector(".btn-solution");
      const status = challenge.querySelector(".ch-status");
      const consoleEl = challenge.querySelector(".console");
      const outPre = consoleEl ? consoleEl.querySelector("pre") : null;
      const expectedEl = challenge.querySelector(".expected");
      const solutionEl = challenge.querySelector(".solution");
      const expected = expectedEl ? expectedEl.textContent : null;
      const solution = solutionEl ? solutionEl.textContent : "";
      const starter = editor ? editor.value : "";
      let solutionWrap = null;
      let running = false;

      if (editor && state.code[id]) editor.value = state.code[id];

      const autoGrow = () => {
        if (!editor) return;
        editor.style.height = "auto";
        editor.style.height = Math.min(Math.max(editor.scrollHeight, 130), 520) + "px";
      };
      autoGrow();

      if (state.challenges[id]) {
        challenge.classList.add("done");
        if (status) {
          status.textContent = "تم الحل ✓";
          status.className = "ch-status pass";
        }
      }

      const setStatus = (text, cls) => {
        if (!status) return;
        status.textContent = text;
        status.className = "ch-status" + (cls ? " " + cls : "");
      };

      const showSolution = () => {
        if (!solutionWrap) {
          solutionWrap = document.createElement("div");
          solutionWrap.className = "solution-wrap";
          const head = document.createElement("div");
          head.className = "sol-head";
          head.textContent = "💡 الحل المقترح";
          const pre = document.createElement("pre");
          pre.textContent = solution.trim();
          solutionWrap.append(head, pre);
          const actions = challenge.querySelector(".ch-actions");
          actions.insertAdjacentElement("afterend", solutionWrap);
        }
        solutionWrap.hidden = !solutionWrap.hidden;
        if (solBtn) solBtn.textContent = solutionWrap.hidden ? "اعرض الحل" : "إخفاء الحل";
      };

      async function run() {
        if (!editor || running) return;
        running = true;
        const original = runBtn ? runBtn.innerHTML : "";
        if (runBtn) {
          runBtn.disabled = true;
          runBtn.innerHTML = '<span class="spinner"></span> بيشغّل…';
        }
        showConsole(consoleEl);
        if (outPre) {
          outPre.classList.remove("err");
          outPre.textContent = "⏳ تحميل بايثون وتنفيذ الكود…";
        }
        setStatus("بيشغّل…", "");

        const slowTimer = setTimeout(() => {
          setStatus("لسه بيشتغل… (لو فيه حلقة لا نهائية، أعد تحميل الصفحة)", "");
        }, 9000);

        const started = performance.now();
        try {
          const result = await runPython(editor.value);
          const elapsed = ((performance.now() - started) / 1000).toFixed(2);
          state.code[id] = editor.value;
          saveState();

          const output = result.out || "";
          const error = result.err || "";

          if (error.trim()) {
            if (outPre) {
              outPre.classList.add("err");
              outPre.textContent = error;
            }
            setStatus("❌ فيه خطأ في الكود", "fail");
          } else if (expected !== null) {
            const pass = normalizeOutput(output) === normalizeOutput(expected);
            if (pass) {
              if (outPre) {
                outPre.classList.remove("err");
                outPre.textContent = output || "(بدون مخرجات)";
              }
              challenge.classList.add("done");
              setStatus("✅ مخرجات صحيحة", "pass");
              if (!state.challenges[id]) {
                state.challenges[id] = true;
                saveState();
                updateProgress();
                toast("تحدي مكتمل! +1", "🎯");
              }
            } else {
              if (outPre) {
                outPre.classList.remove("err");
                outPre.textContent =
                  (output || "(مفيش مخرجات)") +
                  "\n\n--- المتوقع ---\n" +
                  expected;
              }
              setStatus("❌ المخرجات مختلفة — جرّب تاني", "fail");
            }
          } else {
            if (outPre) outPre.textContent = output || "(بدون مخرجات)";
            setStatus("تم التشغيل في " + elapsed + "s", "pass");
          }
        } catch (err) {
          if (outPre) {
            outPre.classList.add("err");
            outPre.textContent = "تعذّر التشغيل:\n" + (err && err.message ? err.message : err);
          }
          setStatus("❌ فشل التشغيل", "fail");
        } finally {
          clearTimeout(slowTimer);
          running = false;
          if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = original;
          }
        }
      }

      if (runBtn) runBtn.addEventListener("click", run);
      if (solBtn) solBtn.addEventListener("click", showSolution);
      if (resetBtn && editor) {
        resetBtn.addEventListener("click", () => {
          editor.value = starter;
          state.code[id] = starter;
          saveState();
          autoGrow();
          setStatus("", "");
          if (consoleEl) consoleEl.hidden = true;
          toast("تمت استعادة الكود الأصلي", "↺");
        });
      }

      if (editor) {
        let codeTimer = null;
        editor.addEventListener("input", () => {
          autoGrow();
          clearTimeout(codeTimer);
          codeTimer = setTimeout(() => {
            state.code[id] = editor.value;
            saveState();
          }, 300);
        });

        editor.addEventListener("keydown", (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.setRangeText("    ", start, end, "end");
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            run();
            return;
          }
          if (e.key === "Enter" && editor.selectionStart === editor.selectionEnd) {
            const pos = editor.selectionStart;
            const before = editor.value.slice(0, pos);
            const currentLine = before.split("\n").pop();
            const indentMatch = currentLine.match(/^[ \t]*/);
            const indent = indentMatch ? indentMatch[0] : "";
            if (currentLine.trimEnd().endsWith(":")) {
              e.preventDefault();
              editor.setRangeText("\n" + indent + "    ", pos, pos, "end");
            } else if (indent) {
              e.preventDefault();
              editor.setRangeText("\n" + indent, pos, pos, "end");
            }
          }
        });
      }
    });
  }

  /* ---------------- Cheat sheet search ---------------- */
  function initCheatSearch() {
    const input = $("#cheatSearch");
    const grid = $("#cheatGrid");
    if (!input || !grid) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      $$(".cheat-card", grid).forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.classList.toggle("hide", q !== "" && text.indexOf(q) === -1);
      });
    });
  }

  /* ---------------- Projects ---------------- */
  function initProjects() {
    $$(".project-head").forEach((head) => {
      const toggle = () => {
        const project = head.parentElement;
        const isOpen = project.classList.toggle("open");
        head.setAttribute("aria-expanded", isOpen ? "true" : "false");
      };
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /* ---------------- Scroll UI ---------------- */
  function initScrollUI() {
    const toTop = $("#toTop");
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      if (scrollBar) scrollBar.style.width = (ratio * 100).toFixed(2) + "%";
      if (toTop) toTop.classList.toggle("show", doc.scrollTop > 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
      });
    }
  }

  /* ---------------- Reveal on scroll ---------------- */
  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window) || REDUCED) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => observer.observe(el));
  }

  /* ---------------- Stat counters ---------------- */
  function initCounters() {
    const stats = $$(".stat b[data-count]");
    if (!stats.length) return;

    const animate = (el) => {
      const target = Number(el.dataset.count) || 0;
      const suffix = el.dataset.suffix || "";
      if (REDUCED) {
        el.textContent = target + suffix;
        return;
      }
      const duration = 1100;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      stats.forEach(animate);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    stats.forEach((el) => observer.observe(el));
  }

  /* ---------------- Reset ---------------- */
  function resetQuizUI(quiz) {
    const options = $$(".option", quiz);
    const feedback = quiz.querySelector(".quiz-feedback");
    quiz.classList.remove("solved");
    options.forEach((opt) => {
      opt.disabled = false;
      opt.classList.remove("correct", "wrong");
      const mark = opt.querySelector(".mark");
      if (mark) mark.textContent = "";
    });
    if (feedback) {
      feedback.className = "quiz-feedback";
      feedback.textContent = "";
    }
  }

  function initReset() {
    const btn = $("#resetProgress");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const ok = window.confirm("هل أنت متأكد؟ هيتم مسح كل إجاباتك وتحديات الكود المحفوظة.");
      if (!ok) return;
      state.quizzes = {};
      state.challenges = {};
      state.code = {};
      state.celebrated = false;
      saveState();
      quizzes.forEach(resetQuizUI);
      challenges.forEach((challenge) => {
        challenge.classList.remove("done");
        const status = challenge.querySelector(".ch-status");
        if (status) {
          status.textContent = "";
          status.className = "ch-status";
        }
        const consoleEl = challenge.querySelector(".console");
        if (consoleEl) consoleEl.hidden = true;
      });
      updateProgress();
      toast("تم تصفير التقدم — بداية جديدة", "↺");
    });
  }

  /* ---------------- Confetti ---------------- */
  function confetti() {
    if (REDUCED) return;
    const canvas = $("#confetti");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const colors = ["#5cc8ff", "#ffd43b", "#a78bfa", "#3ddc97", "#ff6b81", "#ffffff"];
    const count = 150;
    const particles = Array.from({ length: count }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
      y: window.innerHeight * 0.28 + Math.random() * 80,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 12 - 3,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1
    }));

    let frame = 0;
    const start = performance.now();

    const draw = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((p) => {
        p.vy += 0.24;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - elapsed / 4200);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      frame++;
      if (elapsed < 4200) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    requestAnimationFrame(draw);
    window.addEventListener("resize", resize, { once: true });
  }

  /* ---------------- Keyboard shortcuts ---------------- */
  function initShortcuts() {
    const navSearch = $("#navSearch");
    document.addEventListener("keydown", (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        if (window.innerWidth <= 980) {
          $("#sidebar").classList.add("open");
          $("#scrim").classList.add("show");
        }
        if (navSearch) navSearch.focus();
      }
      if (e.key === "Escape" && document.activeElement === navSearch) {
        navSearch.value = "";
        navSearch.dispatchEvent(new Event("input"));
        navSearch.blur();
      }
    });
  }

  /* ---------------- Print ---------------- */
  function initPrint() {
    const btn = $("#printBtn");
    if (btn) btn.addEventListener("click", () => window.print());
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    initTheme();
    initNav();
    initActiveSection();
    initNavSearch();
    initDrawer();
    initCodeBlocks();
    initExampleRunners();
    initQuizzes();
    initChallenges();
    initCheatSearch();
    initProjects();
    initScrollUI();
    initReveal();
    initCounters();
    initReset();
    initShortcuts();
    initPrint();
    updateProgress();
    requestAnimationFrame(() => $$(".hero .reveal").forEach((el) => el.classList.add("in")));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
