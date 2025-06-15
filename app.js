let currentLang = "en";
let currentLesson = "lesson-01";
let currentDay = 1;
let UI = {};

// Load UI strings for localization
async function loadUIStrings() {
  try {
    const res = await fetch(`ui/${currentLang}.json`);
    UI = await res.json();
  } catch {
    UI = {};
  }
}
function localize(key, fallback = "") {
  return UI[key] || fallback;
}
function localizeDay(dayText) {
  return UI.dayNames?.[dayText.toLowerCase()] || dayText;
}

// Theme functions
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
function loadTheme() {
  const saved = localStorage.getItem("e-hbd.theme") || "system";
  if (saved === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(dark ? "dark" : "light");
  } else applyTheme(saved);
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

// Presenter mode logic
function togglePresentationMode() {
  document.body.classList.toggle("presentation-mode");
  document.getElementById("presenter-controls").style.display =
    document.body.classList.contains("presentation-mode") ? "flex" : "none";
}
function exitPresentation() {
  document.body.classList.remove("presentation-mode");
  document.getElementById("presenter-controls").style.display = "none";
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
    // Try to advance to next lesson
    const nextLessonNumber = parseInt(currentLesson.split("-")[1]) + 1;
    const nextLessonId = `lesson-${nextLessonNumber
      .toString()
      .padStart(2, "0")}`;

    fetch(`content/${currentLang}/${nextLessonId}/day-1.json`).then((res) => {
      if (res.ok) {
        currentLesson = nextLessonId;
        currentDay = 1;
        saveProgress();
        loadLessonDay();
      } else {
        const nextQuarter = Math.ceil(nextLessonNumber / 13);
        fetch(`content/${currentLang}/intro-q${nextQuarter}/index.json`).then(
          (r2) => {
            if (r2.ok) {
              window.location.href = `quarter.html?q=${nextQuarter}`;
            } else {
              alert("✅ End of available lessons.\nNew lessons coming soon.");
            }
          }
        );
      }
    });
  }
}

// Blackout / Whiteout controls
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

// Save/load journaling & progress
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

// Lesson content and rendering
async function loadLessonDay() {
  try {
    await loadUIStrings();
    const res = await fetch(
      `content/${currentLang}/${currentLesson}/day-${currentDay}.json`
    );
    const lesson = await res.json();

    const isSabbath = lesson.day === "Sabbath Afternoon";
    const isFriday = lesson.day === "Friday" || lesson.day === "General Review";

    const sabbathBlock = document.querySelector(".sabbath-block");
    const sabbathContainer = document.getElementById("sabbath-questions");
    const dayContent = document.getElementById("day-content");
    const prevBtn = document.getElementById("prev-day");
    const nextBtn = document.getElementById("next-day");
    const nextLessonBtn = document.getElementById("next-lesson");

    sabbathBlock.style.display = isSabbath ? "block" : "none";
    sabbathContainer.innerHTML = "";
    dayContent.innerHTML = "";
    document.querySelector(".media").style.display = "none";
    document.querySelector(".day-nav").style.display = "flex";
    if (nextLessonBtn) nextLessonBtn.style.display = "none";

    if (lesson.title) {
      document.getElementById("lesson-title").textContent = lesson.title;
    }

    prevBtn.disabled = currentDay === 1;
    nextBtn.disabled = currentDay === 7;
    prevBtn.style.display = currentDay === 1 ? "none" : "inline-block";
    nextBtn.style.display = currentDay === 7 ? "none" : "inline-block";

    if (isSabbath) {
      renderMarkdown("sabbath-intro", lesson.sabbathIntro);
      renderMarkdown("memory-verse", lesson.memoryVerse);
      renderMarkdown("fundamental-belief", lesson.fundamentalBelief);
      renderMarkdown("key-thought", lesson.keyThought);
      renderMarkdown("introduction", lesson.introduction);

      (lesson.sabbathQuestions || []).forEach((q) => {
        const qDiv = document.createElement("div");
        qDiv.className = "question-block reflective-question";
        qDiv.innerHTML = `<p class="question-text"><strong>${
          q.question || ""
        }</strong></p>`;
        sabbathContainer.appendChild(qDiv);
      });
    } else if (isFriday) {
      dayContent.innerHTML = `
        <div class="day-title">${localizeDay(lesson.day)}</div>
        <div class="question-block">
          <h3>${localize("generalReview")}</h3>
          <textarea placeholder="${localize(
            "reviewPrompt"
          )}" oninput="saveNote('${currentLang}.${currentLesson}.day-${currentDay}.review', this.value)">${loadNote(
        `${currentLang}.${currentLesson}.day-${currentDay}.review`
      )}</textarea>
        </div>
        <div class="media">
          <h3>${localize("watchListen")}</h3>
          <audio controls src="${lesson.media?.audio || ""}"></audio>
          <video controls width="100%" src="${
            lesson.media?.video || ""
          }"></video>
        </div>
      `;

      const nextLessonNumber = parseInt(currentLesson.split("-")[1]) + 1;
      const nextLessonId = `lesson-${String(nextLessonNumber).padStart(
        2,
        "0"
      )}`;
      fetch(`content/${currentLang}/${nextLessonId}/day-1.json`).then(
        (res2) => {
          if (res2.ok && nextLessonBtn) {
            nextLessonBtn.style.display = "inline-block";
            nextLessonBtn.textContent = localize("nextLesson") + " ▶";
            nextLessonBtn.onclick = () => {
              currentLesson = nextLessonId;
              currentDay = 1;
              loadLessonDay();
            };
          } else {
            const nextQuarter = Math.ceil(nextLessonNumber / 13);
            fetch(
              `content/${currentLang}/intro-q${nextQuarter}/index.json`
            ).then((rq) => {
              if (rq.ok && nextLessonBtn) {
                nextLessonBtn.style.display = "inline-block";
                nextLessonBtn.textContent = localize("nextQuarter") + " ▶";
                nextLessonBtn.onclick = () => {
                  window.location.href = `quarter.html?q=${nextQuarter}`;
                };
              }
            });
          }
        }
      );
    } else {
      dayContent.innerHTML = `<div class="day-title">${localizeDay(
        lesson.day
      )}</div>`;
      (lesson.entries || []).forEach((entry) => {
        const block = document.createElement("div");
        block.className = entry.number
          ? "question-block"
          : "question-block reflective-question";

        if (!entry.number) {
          block.innerHTML = `<p class="question-text"><strong>${
            entry.question || ""
          }</strong></p>`;
        } else {
          const noteKey = `${currentLang}.${currentLesson}.day-${currentDay}.q${entry.number}`;
          block.innerHTML = `
            <p class="question-text"><strong>${entry.number}. ${
            entry.question || ""
          }</strong></p>
            <p><em>Scripture:</em> ${(entry.scripture || []).join(", ")}</p>
            <textarea placeholder="${localize(
              "writeThoughts"
            )}" oninput="saveNote('${noteKey}', this.value)">${loadNote(
            noteKey
          )}</textarea>
            ${
              entry.authorNote
                ? `<div class="author-note"><strong>Note:</strong> ${entry.authorNote}</div>`
                : ""
            }
          `;
        }
        dayContent.appendChild(block);
      });
    }

    saveProgress();
    prevBtn.textContent = localize("prev");
    nextBtn.textContent = localize("next");
  } catch (err) {
    console.error("Failed to load lesson or UI strings:", err);
  }
}

// Sidebar toggle & auto-close
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}
document.addEventListener("click", (event) => {
  const sidebar = document.getElementById("sidebar");
  const toggleButton = document.getElementById("sidebar-toggle");
  if (
    sidebar.classList.contains("open") &&
    !sidebar.contains(event.target) &&
    event.target !== toggleButton
  ) {
    sidebar.classList.remove("open");
  }
});
document.querySelectorAll(".sidebar a").forEach((link) => {
  link.addEventListener("click", () =>
    document.getElementById("sidebar").classList.remove("open")
  );
});

// Navigation buttons
document.getElementById("prev-day").addEventListener("click", () => {
  if (currentDay > 1) {
    currentDay--;
    loadLessonDay();
  }
});
document.getElementById("next-day").addEventListener("click", () => {
  if (currentDay < 7) {
    currentDay++;
    loadLessonDay();
  }
});

// Progress resume
const saved = JSON.parse(localStorage.getItem("e-hbd.progress"));
if (saved) {
  currentLang = saved.lang || currentLang;
  currentLesson = saved.lesson || currentLesson;
  currentDay = saved.day || currentDay;
}
loadLessonDay();

// Presenter controls visibility initialization + theme
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  setupThemeToggle();
  const pc = document.getElementById("presenter-controls");
  if (pc) pc.style.display = "none";
});

// Markdown rendering helper
function renderMarkdown(id, md) {
  document.getElementById(id).innerHTML = marked.parse(md || "");
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    document.body.classList.remove("blackout", "whiteout");
  }
});
