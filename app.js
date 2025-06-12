let currentLang = "en";
let currentLesson = "lesson-01";
let currentDay = 1;
let UI = {};

async function loadUIStrings() {
  try {
    const res = await fetch(`ui/${currentLang}.json`);
    UI = await res.json();
  } catch (err) {
    UI = {};
  }
}

function localize(key, fallback = "") {
  return UI[key] || fallback;
}

function localizeDay(dayText) {
  return UI.dayNames?.[dayText.toLowerCase()] || dayText;
}

function getDayPath() {
  return `content/${currentLang}/${currentLesson}/day-${currentDay}.json`;
}

async function loadLessonDay() {
  try {
    await loadUIStrings();
    const res = await fetch(getDayPath());
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
        qDiv.className = "question-block";
        qDiv.innerHTML = `<p class="question-text"><strong>${
          q.number ? q.number + ". " : ""
        }${q.question || ""}</strong></p>`;
        sabbathContainer.appendChild(qDiv);
      });
    } else if (isFriday) {
      const noteKey = `${currentLang}.${currentLesson}.day-${currentDay}.review`;

      dayContent.innerHTML = `
        <div class="day-title">${localizeDay(lesson.day)}</div>
        <div class="question-block">
          <h3>${localize("generalReview")}</h3>
          <textarea 
            placeholder="${localize("reviewPrompt")}" 
            oninput="saveNote('${noteKey}', this.value)"
          >${loadNote(noteKey)}</textarea>
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
      const nextLessonId = `lesson-${nextLessonNumber
        .toString()
        .padStart(2, "0")}`;

      fetch(`content/${currentLang}/${nextLessonId}/day-1.json`).then((res) => {
        if (res.ok && nextLessonBtn) {
          nextLessonBtn.style.display = "inline-block";
          nextLessonBtn.textContent = "Next Lesson ▶";
          nextLessonBtn.onclick = () => {
            currentLesson = nextLessonId;
            currentDay = 1;
            loadLessonDay();
          };
        } else {
          const nextQuarter = Math.ceil(nextLessonNumber / 13);
          fetch(`content/${currentLang}/intro-q${nextQuarter}/index.json`).then(
            (r2) => {
              if (r2.ok && nextLessonBtn) {
                nextLessonBtn.style.display = "inline-block";
                nextLessonBtn.textContent = "Next Quarter ▶";
                nextLessonBtn.onclick = () => {
                  window.location.href = `quarter.html?q=${nextQuarter}`;
                };
              }
            }
          );
        }
      });
    } else {
      dayContent.innerHTML = `<div class="day-title">${localizeDay(
        lesson.day || ""
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
            <textarea 
              placeholder="${localize("writeThoughts")}" 
              oninput="saveNote('${noteKey}', this.value)"
            >${loadNote(noteKey)}</textarea>
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

    // Save user progress
    localStorage.setItem(
      "e-hbd.progress",
      JSON.stringify({
        lang: currentLang,
        lesson: currentLesson,
        day: currentDay,
      })
    );

    prevBtn.textContent = localize("prev");
    nextBtn.textContent = localize("next");
  } catch (err) {
    console.error("Failed to load lesson or UI strings:", err);
  }
}

// Helpers
function saveNote(key, value) {
  localStorage.setItem(`e-hbd.${key}`, value);
}

function loadNote(key) {
  return localStorage.getItem(`e-hbd.${key}`) || "";
}

// Sidebar toggle function (keep clean)
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ✅ 1. Auto-close when clicking outside the sidebar
document.addEventListener("click", function (event) {
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

// ✅ 2. Auto-close when a sidebar link is clicked
document.querySelectorAll(".sidebar a").forEach((link) => {
  link.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
  });
});

function logout() {
  alert("Logging out... (not implemented yet)");
}

function startLesson() {
  currentLesson = "lesson-01";
  currentDay = 1;
  loadLessonDay();
  toggleSidebar();
}

function togglePresentationMode() {
  document.body.classList.toggle("presentation-mode");
}

function renderMarkdown(containerId, markdownText) {
  document.getElementById(containerId).innerHTML = marked.parse(
    markdownText || ""
  );
}

// Navigation
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

// Resume last progress or start fresh
const saved = JSON.parse(localStorage.getItem("e-hbd.progress"));
if (saved) {
  currentLang = saved.lang || "en";
  currentLesson = saved.lesson || "lesson-01";
  currentDay = saved.day || 1;
}
loadLessonDay();

// Load the lesson initially
loadLessonDay();

// -- ✅ Now safe to add these after lessons are loaded --

function exitPresentation() {
  document.body.classList.remove("presentation-mode");
}

function advancePresenterDay() {
  if (currentDay < 7) {
    currentDay++;
    localStorage.setItem(
      "e-hbd.progress",
      JSON.stringify({
        lang: currentLang,
        lesson: currentLesson,
        day: currentDay,
      })
    );
    loadLessonDay();
  } else {
    // Final day (Friday) — offer next lesson
    alert(
      "✅ You’ve reached the end of this lesson.\n\nNext lesson coming soon!"
    );
    // Optional: preload lesson-02 or redirect
    // currentLesson = "lesson-02";
    // currentDay = 1;
    // localStorage.setItem("e-hbd.progress", JSON.stringify({
    //   lang: currentLang,
    //   lesson: currentLesson,
    //   day: currentDay
    // }));
    // loadLessonDay();
  }
}

// Optional: Auto-hide presenter controls when idle
if (document.body.classList.contains("presentation-mode")) {
  let timer;
  const controls = document.getElementById("presenter-controls");

  function showControls() {
    controls.style.opacity = "1";
    clearTimeout(timer);
    timer = setTimeout(() => {
      controls.style.opacity = "0";
    }, 5000);
  }

  document.addEventListener("mousemove", showControls);
  showControls();
}
