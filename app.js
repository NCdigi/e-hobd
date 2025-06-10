let currentLang = "en";
let currentLesson = "lesson-01";
let currentDay = 1;
let UI = {};

async function loadUIStrings() {
  try {
    const res = await fetch(`ui/${currentLang}.json`);
    UI = await res.json();
  } catch (err) {
    console.warn("UI language file not found, defaulting to empty.");
    UI = {};
  }
}

function getDayPath() {
  return `content/${currentLang}/${currentLesson}/day-${currentDay}.json`;
}

function localize(key, fallback = "") {
  return UI[key] || fallback;
}

function localizeDay(dayText) {
  return UI.dayNames?.[dayText.toLowerCase()] || dayText;
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

    sabbathBlock.style.display = isSabbath ? "block" : "none";
    sabbathContainer.innerHTML = "";
    dayContent.innerHTML = "";
    document.querySelector(".media").style.display = "none";
    document.querySelector(".day-nav").style.display = "flex";

    if (lesson.title) {
      document.getElementById("lesson-title").textContent = lesson.title;
    }

    prevBtn.disabled = currentDay === 1;
    nextBtn.disabled = currentDay === 7;
    prevBtn.style.display = currentDay === 1 ? "none" : "inline-block";
    nextBtn.style.display = currentDay === 7 ? "none" : "inline-block";

    // 🟤 Sabbath
    if (isSabbath) {
      sabbathBlock.querySelector("h2").textContent =
        localize("sabbathAfternoon");
      document.querySelector(".memory-verse h3").textContent =
        localize("memoryVerse");
      document.querySelector(".fundamental-belief h3").textContent =
        localize("fundamentalBelief");
      document.querySelector(".key-thought h3").textContent =
        localize("keyThought");
      document.querySelector(".introduction h3").textContent =
        localize("introduction");

      document.getElementById("sabbath-intro").textContent =
        lesson.sabbathIntro || "";
      document.getElementById("memory-verse").textContent =
        lesson.memoryVerse || "";
      document.getElementById("fundamental-belief").textContent =
        lesson.fundamentalBelief || "";
      document.getElementById("key-thought").textContent =
        lesson.keyThought || "";
      document.getElementById("introduction").textContent =
        lesson.introduction || "";

      (lesson.sabbathQuestions || []).forEach((q) => {
        const qDiv = document.createElement("div");
        qDiv.className = "question-block";

        if (!q.number) {
          qDiv.innerHTML = `<p><strong>${q.question || ""}</strong></p>`;
        } else {
          qDiv.innerHTML = `<p><strong>${q.number}. ${
            q.question || ""
          }</strong></p>`;
        }

        sabbathContainer.appendChild(qDiv);
      });

      // 🔵 Friday
    } else if (isFriday) {
      dayContent.innerHTML = `
        <div class="day-title">${localizeDay(lesson.day)}</div>
        <div class="question-block">
          <h3>${localize("generalReview")}</h3>
          <textarea placeholder="${localize("reviewPrompt")}"></textarea>
        </div>
        <div class="media">
          <h3>${localize("watchListen")}</h3>
          <audio controls src="${lesson.media?.audio || ""}"></audio>
          <video controls width="100%" src="${
            lesson.media?.video || ""
          }"></video>
        </div>
      `;

      // 🟡 Weekdays
    } else {
      dayContent.innerHTML = `<div class="day-title">${localizeDay(
        lesson.day || ""
      )}</div>`;

      (lesson.entries || []).forEach((entry) => {
        const block = document.createElement("div");

        // Reflective: no number, no textarea
        if (!entry.number) {
          block.className = "question-block reflective-question";
          block.innerHTML = `<p class="question-text"><strong>${
            entry.question || ""
          }</strong></p>`;
        } else {
          block.className = "question-block";
          block.innerHTML = `
    <p class="question-text"><strong>${entry.number}. ${
            entry.question || ""
          }</strong></p>
    <p><em>Scripture:</em> ${(entry.scripture || []).join(", ")}</p>
    <textarea placeholder="${localize("writeThoughts")}"></textarea>
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

    // Localized navigation labels
    prevBtn.textContent = localize("prev");
    nextBtn.textContent = localize("next");
  } catch (err) {
    console.error("Failed to load lesson or UI strings:", err);
  }
}

// Navigation
document.getElementById("prev-day").addEventListener("click", (e) => {
  if (currentDay <= 1) {
    e.preventDefault();
    return;
  }
  currentDay--;
  loadLessonDay();
});

document.getElementById("next-day").addEventListener("click", (e) => {
  if (currentDay >= 7) {
    e.preventDefault();
    return;
  }
  currentDay++;
  loadLessonDay();
});

// Language Switcher
document
  .getElementById("language-switcher")
  .addEventListener("change", function () {
    currentLang = this.value;
    currentDay = 1;
    loadLessonDay();
  });

// Initial Load
loadLessonDay();
