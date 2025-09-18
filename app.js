// ====== Global state ======
let currentLang = "en";
let currentLesson = "lesson-01";
let currentDay = 1;
let UI = {};
const ROOT = location.origin; // e.g., https://www.e-hobd.ncdigital.co.za

// ====== Localization ======
async function loadUIStrings() {
  try {
    const res = await fetch(`${ROOT}/ui/${currentLang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`UI strings HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim().startsWith("{")) throw new Error("UI file is not JSON");
    UI = JSON.parse(text);
  } catch (e) {
    console.error("UI load failed:", e);
    UI = {};
  }
}
function localize(key, fallback = "") {
  return UI[key] || fallback;
}
function localizeDay(dayText) {
  return UI.dayNames?.[String(dayText || "").toLowerCase()] || dayText;
}

// ====== Theme ======
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
function loadTheme() {
  const saved = localStorage.getItem("e-hbd.theme") || "system";
  if (saved === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(dark ? "dark" : "light");
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

// ====== Presenter mode ======
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
    currentDay--;
    saveProgress();
    loadLessonDay();
  } else {
    alert("You're already at the beginning of the lesson.");
  }
}
function advancePresenterDay() {
  if (currentDay < 7) {
    currentDay++;
    saveProgress();
    loadLessonDay();
  } else {
    const nextLessonNumber = parseInt(currentLesson.split("-")[1], 10) + 1;
    const nextLessonId = `lesson-${String(nextLessonNumber).padStart(2, "0")}`;
    fetch(`${ROOT}/content/${currentLang}/${nextLessonId}/day-1.json`).then((res) => {
      if (res.ok) {
        currentLesson = nextLessonId;
        currentDay = 1;
        saveProgress();
        loadLessonDay();
      } else {
        const nextQuarter = Math.ceil(nextLessonNumber / 13);
        fetch(`${ROOT}/content/${currentLang}/intro-q${nextQuarter}/index.json`).then((r2) => {
          if (r2.ok) {
            window.location.href = `quarter.html?q=${nextQuarter}`;
          } else {
            alert("✅ End of available lessons.\nNew lessons coming soon.");
          }
        });
      }
    });
  }
}

// ====== Blackout / Whiteout ======
function toggleBlackout() {
  document.body.classList.toggle("blackout");
  if (document.body.classList.contains("whiteout")) {
    document.body.classList.remove("whiteout");
  }
}
function toggleWhiteout() {
  document.body.classList.toggle("whiteout");
  if (document.body.classList.contains("blackout")) {
    document.body.classList.remove("blackout");
  }
}

// ====== Notes & Progress ======
function saveNote(key, value) {
  localStorage.setItem(`e-hbd.${key}`, value);
}
function loadNote(key) {
  return localStorage.getItem(`e-hbd.${key}`) || "";
}
function saveProgress() {
  localStorage.setItem(
    "e-hbd.progress",
    JSON.stringify({
      lang: currentLang,
      lesson: currentLesson,
      day: currentDay,
    })
  );
}
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("e-hbd.progress") || "null");
    if (saved) {
      currentLang = saved.lang || currentLang;
      currentLesson = saved.lesson || currentLesson;
      currentDay = saved.day || currentDay;
    }
  } catch {
    // ignore
  }
}

// ====== JSON fetch guard ======
async function fetchJsonGuarded(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  const looksJson = text.trim().startsWith("{") || text.trim().startsWith("[");
  if (!looksJson) {
    throw new Error(
      `Expected JSON, got non-JSON from ${url}. First 120 chars: ${text.slice(0, 120)}`
    );
  }
  return JSON.parse(text);
}

// ====== Markdown helper ======
function renderMarkdown(id, md) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = (window.marked && typeof marked.parse === "function")
    ? marked.parse(md || "")
    : (md || "");
}

// ====== Lesson loader ======
async function loadLessonDay() {
  const statusEl = document.getElementById("status"); // put <div id="status"></div> in HTML
  if (statusEl) statusEl.textContent = "Loading... Please wait...";

  try {
    await loadUIStrings();

    const url = `${ROOT}/content/${currentLang}/${currentLesson}/day-${currentDay}.json`;
    const lesson = await fetchJsonGuarded(url);

    const isSabbath = lesson.day === "Sabbath Afternoon";
    const isFriday = lesson.day === "Friday" || lesson.day === "General Review";

    const sabbathBlock = document.querySelector(".sabbath-block");
    const sabbathContainer = document.getElementById("sabbath-questions");
    const dayContent = document.getElementById("day-content");
    const prevBtn = document.getElementById("prev-day");
    const nextBtn = document.getElementById("next-day");
    const nextLessonBtn = document.getElementById("next-lesson");
    const mediaEl = document.querySelector(".media");
    const dayNav = document.querySelector(".day-nav");

    if (sabbathBlock) sabbathBlock.style.display = isSabbath ? "block" : "none";
    if (sabbathContainer) sabbathContainer.innerHTML = "";
    if (dayContent) dayContent.innerHTML = "";
    if (mediaEl) mediaEl.style.display = "none";
    if (dayNav) dayNav.style.display = "flex";
    if (nextLessonBtn) nextLessonBtn.style.display = "none";

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
      renderMarkdown("sabbath-intro", lesson.sabbathIntro);
      renderMarkdown("memory-verse", lesson.memoryVerse);
      // Fallback to `statements` if `fundamentalBelief` is absent
      renderMarkdown("fundamental-belief", lesson.fundamentalBelief || lesson.statements || "");
      renderMarkdown("key-thought", lesson.keyThought);
      renderMarkdown("introduction", lesson.introduction);

      (lesson.sabbathQuestions || []).forEach((q) => {
        const qDiv = document.createElement("div");
        qDiv.className = "question-block reflective-question";
        qDiv.innerHTML = `<p class="question-text"><strong>${q.question || ""}</strong></p>`;
        if (sabbathContainer) sabbathContainer.appendChild(qDiv);
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

      const nextLessonNumber = parseInt(currentLesson.split("-")[1], 10) + 1;
      const nextLessonId = `lesson-${String(nextLessonNumber).padStart(2, "0")}`;

      fetch(`${ROOT}/content/${currentLang}/${nextLessonId}/day-1.json`).then((r) => {
        if (r.ok && nextLessonBtn) {
          nextLessonBtn.style.display = "inline-block";
          nextLessonBtn.textContent = localize("nextLesson", "Next Lesson") + " ▶";
          nextLessonBtn.onclick = () => {
            currentLesson = nextLessonId;
            currentDay = 1;
            saveProgress();
            loadLessonDay();
          };
        } else {
          const nextQuarter = Math.ceil(nextLessonNumber / 13);
          fetch(`${ROOT}/content/${currentLang}/intro-q${nextQuarter}/index.json`).then((rq) => {
            if (rq.ok && nextLessonBtn) {
              nextLessonBtn.style.display = "inline-block";
              nextLessonBtn.textContent = localize("nextQuarter", "Next Quarter") + " ▶";
              nextLessonBtn.onclick = () => {
                window.location.href = `quarter.html?q=${nextQuarter}`;
              };
            }
          });
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

// ====== Sidebar toggle & auto-close ======
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.toggle("open");
}
document.addEventListener("click", (event) => {
  const sidebar = document.getElementById("sidebar");
  const toggleButton = document.getElementById("sidebar-toggle");
  if (
    sidebar &&
    sidebar.classList.contains("open") &&
    !sidebar.contains(event.target) &&
    event.target !== toggleButton
  ) {
    sidebar.classList.remove("open");
  }
});
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".sidebar a").forEach((link) => {
    link.addEventListener("click", () => {
      const sb = document.getElementById("sidebar");
      if (sb) sb.classList.remove("open");
    });
  });
});

// ====== Keyboard helpers ======
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.body.classList.remove("blackout", "whiteout");
  }
});

// ====== Boot ======
document.addEventListener("DOMContentLoaded", () => {
  loadProgress();
  loadTheme();
  setupThemeToggle();

  const pc = document.getElementById("presenter-controls");
  if (pc) pc.style.display = "none";

  const prevBtn = document.getElementById("prev-day");
  const nextBtn = document.getElementById("next-day");

  if (prevBtn) {
    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentDay > 1) {
        currentDay--;
        saveProgress();
        loadLessonDay();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentDay < 7) {
        currentDay++;
        saveProgress();
        loadLessonDay();
      }
    });
  }

  // Initial load after DOM and theme ready
  loadLessonDay();
});
