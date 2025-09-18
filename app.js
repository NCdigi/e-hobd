/* ===============================
   e-HOBD — app.js (KISS/DRY)
   =============================== */

// ---------- Global state ----------
let currentLang   = "en";
let currentLesson = "lesson-01"; // always "lesson-XX" 2-digit
let currentDay    = 1;
let UI            = {};

// Absolute-from-root URL helper (prevents nested path bugs)
const ROOT = location.origin;                         // e.g. https://www.e-hobd.ncdigital.co.za
const u    = (path) => `${ROOT}/${path.replace(/^\/+/, "")}`;  // u("content/en/...") -> absolute URL

// Small builders (one source of truth)
const uiPath      = (lang)              => u(`ui/${lang}.json`);
const dayPath     = (lang, lesson, day) => u(`content/${lang}/${lesson}/day-${day}.json`);
const nextDayOne  = (lang, lessonNum)   => u(`content/${lang}/lesson-${String(lessonNum).padStart(2,"0")}/day-1.json`);
const quarterInfo = (lang, q)           => u(`content/${lang}/intro-q${q}/index.json`);


// ---------- JSON fetch (guarded) ----------
async function fetchJsonGuarded(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  const looksJson = text.trim().startsWith("{") || text.trim().startsWith("[");
  if (!looksJson) throw new Error(`Expected JSON, got non-JSON from ${url}. Head: ${text.slice(0,120)}`);
  return JSON.parse(text);
}

async function probeExists(url) {
  try {
    const r = await fetch(url, { cache: "no-store", method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}


// ---------- Localization ----------
async function loadUIStrings() {
  try {
    UI = await fetchJsonGuarded(uiPath(currentLang));
  } catch (e) {
    console.error("UI load failed:", e);
    UI = {};
  }
}
const localize    = (key, fallback = "") => UI[key] ?? fallback;
const localizeDay = (dayText) =>
  UI.dayNames?.[String(dayText || "").toLowerCase()] || dayText;


// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
function loadTheme() {
  const saved = localStorage.getItem("e-hbd.theme") || "system";
  if (saved === "system") {
    applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } else {
    applyTheme(saved);
  }
}
function saveTheme(theme) {
  localStorage.setItem("e-hbd.theme", theme);
  applyTheme(theme);
}
function setupThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    saveTheme(cur === "dark" ? "light" : "dark");
  });
}


// ---------- Presenter mode ----------
function togglePresentationMode() {
  document.body.classList.toggle("presentation-mode");
  const pc = document.getElementById("presenter-controls");
  if (pc) pc.style.display = document.body.classList.contains("presentation-mode") ? "flex" : "none";
}
function exitPresentation() {
  document.body.classList.remove("presentation-mode");
  const pc = document.getElementById("presenter-controls");
  if (pc) pc.style.display = "none";
}
function goBackPresenterDay() {
  if (currentDay > 1) {
    currentDay--; saveProgress(); loadLessonDay();
  } else {
    alert("You're already at the beginning of the lesson.");
  }
}
function advancePresenterDay() {
  if (currentDay < 7) {
    currentDay++; saveProgress(); loadLessonDay();
    return;
  }
  const nextLessonNum = parseInt(currentLesson.split("-")[1], 10) + 1;
  const probeUrl      = nextDayOne(currentLang, nextLessonNum);

  fetch(probeUrl).then(async (res) => {
    if (res.ok) {
      currentLesson = `lesson-${String(nextLessonNum).padStart(2,"0")}`;
      currentDay = 1;
      saveProgress(); loadLessonDay();
    } else {
      const q = Math.ceil(nextLessonNum / 13);
      if (await probeExists(quarterInfo(currentLang, q))) {
        location.href = `quarter.html?q=${q}`;
      } else {
        alert("✅ End of available lessons.\nNew lessons coming soon.");
      }
    }
  });
}


// ---------- Blackout / Whiteout ----------
function toggleBlackout() {
  document.body.classList.toggle("blackout");
  if (document.body.classList.contains("whiteout")) document.body.classList.remove("whiteout");
}
function toggleWhiteout() {
  document.body.classList.toggle("whiteout");
  if (document.body.classList.contains("blackout")) document.body.classList.remove("blackout");
}


// ---------- Notes & Progress ----------
function saveNote(key, value) {
  localStorage.setItem(`e-hbd.${key}`, value);
}
function loadNote(key) {
  return localStorage.getItem(`e-hbd.${key}`) || "";
}
function saveProgress() {
  localStorage.setItem("e-hbd.progress", JSON.stringify({
    lang: currentLang,
    lesson: currentLesson,
    day: currentDay,
  }));
}
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("e-hbd.progress") || "null");
    if (saved) {
      currentLang   = saved.lang    || currentLang;
      currentLesson = saved.lesson  || currentLesson;
      currentDay    = saved.day     || currentDay;
    }
  } catch {/* ignore */}
}


// ---------- Markdown helper ----------
function renderMarkdown(id, md) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = (window.marked?.parse) ? marked.parse(md || "") : (md || "");
}


// ---------- Lesson loader ----------
async function loadLessonDay() {
  const statusEl        = document.getElementById("status");
  const sabbathBlock    = document.querySelector(".sabbath-block");
  const sabbathContainer= document.getElementById("sabbath-questions");
  const dayContent      = document.getElementById("day-content");
  const prevBtn         = document.getElementById("prev-day");
  const nextBtn         = document.getElementById("next-day");
  const nextLessonBtn   = document.getElementById("next-lesson");
  const mediaEl         = document.querySelector(".media");
  const dayNav          = document.querySelector(".day-nav");

  if (statusEl) statusEl.textContent = "Loading... Please wait...";

  try {
    await loadUIStrings();

    const lesson = await fetchJsonGuarded(dayPath(currentLang, currentLesson, currentDay));
    const isSabbath = lesson.day === "Sabbath Afternoon";
    const isFriday  = lesson.day === "Friday" || lesson.day === "General Review";

    if (sabbathBlock)     sabbathBlock.style.display = isSabbath ? "block" : "none";
    if (sabbathContainer) sabbathContainer.innerHTML = "";
    if (dayContent)       dayContent.innerHTML = "";
    if (mediaEl)          mediaEl.style.display = "none";
    if (dayNav)           dayNav.style.display = "flex";
    if (nextLessonBtn)    nextLessonBtn.style.display = "none";

    if (lesson.title) {
      const t = document.getElementById("lesson-title");
      if (t) t.textContent = lesson.title;
    }

    if (prevBtn) {
      prevBtn.disabled = currentDay === 1;
      prevBtn.style.display = currentDay === 1 ? "none" : "inline-block";
      prevBtn.textContent = localize("prev", "Prev");
    }
    if (nextBtn) {
      nextBtn.disabled = currentDay === 7;
      nextBtn.style.display = currentDay === 7 ? "none" : "inline-block";
      nextBtn.textContent = localize("next", "Next");
    }

    if (isSabbath) {
      renderMarkdown("sabbath-intro",       lesson.sabbathIntro);
      renderMarkdown("memory-verse",        lesson.memoryVerse);
      renderMarkdown("fundamental-belief",  lesson.fundamentalBelief || lesson.statements || "");
      renderMarkdown("key-thought",         lesson.keyThought);
      renderMarkdown("introduction",        lesson.introduction);

      (lesson.sabbathQuestions || []).forEach((q) => {
        const qDiv = document.createElement("div");
        qDiv.className = "question-block reflective-question";
        qDiv.innerHTML = `<p class="question-text"><strong>${q.question || ""}</strong></p>`;
        sabbathContainer?.appendChild(qDiv);
      });

    } else if (isFriday) {
      if (dayContent) {
        dayContent.innerHTML = `
          <div class="day-title">${localizeDay(lesson.day)}</div>
          <div class="question-block">
            <h3>${localize("generalReview", "General Review")}</h3>
            <textarea placeholder="${localize("reviewPrompt","Write your review...")}"
              oninput="saveNote('${currentLang}.${currentLesson}.day-${currentDay}.review', this.value)">${loadNote(
                `${currentLang}.${currentLesson}.day-${currentDay}.review`
              )}</textarea>
          </div>
          <div class="media">
            <h3>${localize("watchListen","Watch/Listen")}</h3>
            <audio controls src="${lesson.media?.audio || ""}"></audio>
            <video controls width="100%" src="${lesson.media?.video || ""}"></video>
          </div>
        `;
      }

      const nextLessonNum = parseInt(currentLesson.split("-")[1], 10) + 1;
      const probeUrl      = nextDayOne(currentLang, nextLessonNum);

      fetch(probeUrl).then(async (r) => {
        if (r.ok && nextLessonBtn) {
          nextLessonBtn.style.display = "inline-block";
          nextLessonBtn.textContent   = localize("nextLesson","Next Lesson") + " ▶";
          nextLessonBtn.onclick = () => {
            currentLesson = `lesson-${String(nextLessonNum).padStart(2,"0")}`;
            currentDay    = 1;
            saveProgress(); loadLessonDay();
          };
        } else {
          const q = Math.ceil(nextLessonNum / 13);
          if (await probeExists(quarterInfo(currentLang, q)) && nextLessonBtn) {
            nextLessonBtn.style.display = "inline-block";
            nextLessonBtn.textContent   = localize("nextQuarter","Next Quarter") + " ▶";
            nextLessonBtn.onclick       = () => { location.href = `quarter.html?q=${q}`; };
          }
        }
      });

    } else {
      if (dayContent) {
        dayContent.innerHTML = `<div class="day-title">${localizeDay(lesson.day)}</div>`;
        (lesson.entries || []).forEach((entry) => {
          const block = document.createElement("div");
          block.className = entry.number ? "question-block" : "question-block reflective-question";

          if (!entry.number) {
            block.innerHTML = `<p class="question-text"><strong>${entry.question || ""}</strong></p>`;
          } else {
            const noteKey = `${currentLang}.${currentLesson}.day-${currentDay}.q${entry.number}`;
            block.innerHTML = `
              <p class="question-text"><strong>${entry.number}. ${entry.question || ""}</strong></p>
              <p><em>Scripture:</em> ${(entry.scripture || []).join(", ")}</p>
              <textarea placeholder="${localize("writeThoughts","Write your thoughts...")}"
                oninput="saveNote('${noteKey}', this.value)">${loadNote(noteKey)}</textarea>
              ${entry.authorNote ? `<div class="author-note"><strong>Note:</strong> ${entry.authorNote}</div>` : ""}
            `;
          }
          dayContent.appendChild(block);
        });
      }
    }

    saveProgress();
    if (statusEl) statusEl.textContent = "";

  } catch (err) {
    console.error("Failed to load lesson or UI strings:", err);
    if (statusEl) statusEl.textContent = "Sorry, this lesson could not load. (Open Console for details.)";
  }
}


// ---------- Sidebar & keyboard ----------
function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
}
document.addEventListener("click", (event) => {
  const sidebar = document.getElementById("sidebar");
  const toggleButton = document.getElementById("sidebar-toggle");
  if (sidebar?.classList.contains("open") &&
      !sidebar.contains(event.target) &&
      event.target !== toggleButton) {
    sidebar.classList.remove("open");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.body.classList.remove("blackout", "whiteout");
});


// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", () => {
  loadProgress();
  loadTheme();
  setupThemeToggle();

  const pc = document.getElementById("presenter-controls");
  if (pc) pc.style.display = "none";

  const prevBtn = document.getElementById("prev-day");
  const nextBtn = document.getElementById("next-day");

  prevBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentDay > 1) { currentDay--; saveProgress(); loadLessonDay(); }
  });
  nextBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentDay < 7) { currentDay++; saveProgress(); loadLessonDay(); }
  });

  loadLessonDay();
});
