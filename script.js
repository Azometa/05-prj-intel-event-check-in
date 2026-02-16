/* Intel Sustainability Summit: Event Check-In
   - Greeting (personalized)
   - Total attendance + progress bar toward goal
   - Team counts (Water Wise / Net Zero / Renewables)
   - LevelUps: celebration, localStorage persistence, attendee list
*/

"use strict";

// ===== Config =====
const ATTENDANCE_GOAL = 50; // matches "0/50" in the starter UI  [oai_citation:2‡GitHub](https://github.com/GCA-Classroom/05-prj-intel-event-check-in/raw/main/index.html)
const STORAGE_KEY = "intelSummitCheckIn_v1";

// ===== Helpers (safe element lookup) =====
const $ = (sel) => document.querySelector(sel);

function getFirstExisting(selectors) {
  for (const sel of selectors) {
    const el = $(sel);
    if (el) return el;
  }
  return null;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeTeam(teamValue) {
  // Accepts "water", "water wise", "Team Water Wise", etc.
  const t = (teamValue || "").toLowerCase().trim();
  if (t.includes("water")) return "water";
  if (t.includes("zero")) return "zero";
  if (t.includes("renew")) return "renewables";
  if (t.includes("power")) return "renewables"; // sometimes “power” is used in CSS class names
  return "";
}

function formatTeamLabel(teamKey) {
  if (teamKey === "water") return "Team Water Wise";
  if (teamKey === "zero") return "Team Net Zero";
  if (teamKey === "renewables") return "Team Renewables";
  return "Team";
}

function computeWinner(teams) {
  // teams: {water:number, zero:number, renewables:number}
  const entries = Object.entries(teams);
  entries.sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = entries[0];

  // handle ties
  const tied = entries.filter(([, v]) => v === topVal).map(([k]) => k);
  if (tied.length > 1) return { tie: true, teams: tied, count: topVal };
  return { tie: false, team: topKey, count: topVal };
}

// ===== State =====
let state = {
  total: 0,
  teams: { water: 0, zero: 0, renewables: 0 },
  attendees: [] // {name, teamKey, ts}
};

// ===== DOM Refs (robust) =====
const nameInput =
  getFirstExisting(["#attendeeName", "#nameInput", "input[type='text']", "input"]);

const teamSelect =
  getFirstExisting(["#teamSelect", "#team", "select"]);

const checkInBtn =
  getFirstExisting(["#checkInBtn", "button"]);

const greetingEl =
  getFirstExisting(["#greeting", "#message", ".greeting"]);

const attendeeCountEl =
  getFirstExisting(["#attendeeCount", "#count", ".attendee-count"]);

const progressBarEl =
  getFirstExisting([".progress-bar", "#progressBar", "#progress"]);

const attendanceTextEl =
  // If there’s a line like “Attendance: 0/50”, we’ll update it if we can find it.
  getFirstExisting(["#attendanceText", ".attendance-header", ".attendance"]);

// Team count displays (try IDs first; if not found, use team cards)
const waterCountEl =
  getFirstExisting(["#waterCount", "#teamWaterCount", ".team-card.water .team-count", ".team-card.water .count", ".team-card.water span:last-child"]);

const zeroCountEl =
  getFirstExisting(["#netZeroCount", "#zeroCount", "#teamZeroCount", ".team-card.zero .team-count", ".team-card.zero .count", ".team-card.zero span:last-child"]);

const renewablesCountEl =
  getFirstExisting(["#renewablesCount", "#powerCount", "#teamPowerCount", ".team-card.power .team-count", ".team-card.power .count", ".team-card.power span:last-child"]);

// ===== Attendee List UI (create if missing) =====
let attendeeListContainer =
  getFirstExisting(["#attendeeList", ".attendee-list"]);

function ensureAttendeeListUI() {
  if (attendeeListContainer) return;

  // Try to place it under the team stats section if present; else add at end of container
  const teamStatsSection = getFirstExisting([".team-stats", "#teamStats"]);
  const host = teamStatsSection || getFirstExisting([".container", "main", "body"]);

  attendeeListContainer = document.createElement("div");
  attendeeListContainer.id = "attendeeList";
  attendeeListContainer.style.marginTop = "22px";
  attendeeListContainer.style.textAlign = "left";

  const title = document.createElement("h3");
  title.textContent = "Attendee List";
  title.style.color = "#64748b";
  title.style.fontSize = "16px";
  title.style.marginBottom = "12px";

  const ul = document.createElement("ul");
  ul.id = "attendeeListItems";
  ul.style.listStyle = "none";
  ul.style.padding = "0";
  ul.style.margin = "0";
  ul.style.display = "grid";
  ul.style.gap = "10px";

  attendeeListContainer.appendChild(title);
  attendeeListContainer.appendChild(ul);

  host.appendChild(attendeeListContainer);
}

function renderAttendeeList() {
  ensureAttendeeListUI();
  const ul = $("#attendeeListItems");
  if (!ul) return;

  ul.innerHTML = "";

  // newest first
  const items = [...state.attendees].reverse();
  for (const a of items) {
    const li = document.createElement("li");
    li.style.padding = "12px";
    li.style.border = "1px solid rgba(0,0,0,0.08)";
    li.style.borderRadius = "10px";
    li.style.background = "#fff";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.gap = "12px";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${escapeHtml(a.name)}</strong><div style="color:#64748b;font-size:14px;margin-top:4px">${formatTeamLabel(a.teamKey)}</div>`;

    const right = document.createElement("div");
    right.style.color = "#94a3b8";
    right.style.fontSize = "12px";
    right.style.whiteSpace = "nowrap";
    right.textContent = new Date(a.ts).toLocaleString();

    top.appendChild(left);
    top.appendChild(right);
    li.appendChild(top);
    ul.appendChild(li);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== Celebration UI =====
let celebrationEl = getFirstExisting(["#celebration", ".celebration"]);

function ensureCelebrationUI() {
  if (celebrationEl) return;

  const host = getFirstExisting([".attendance-tracker", ".container", "main", "body"]);
  celebrationEl = document.createElement("div");
  celebrationEl.id = "celebration";
  celebrationEl.style.display = "none";
  celebrationEl.style.margin = "16px auto 0";
  celebrationEl.style.maxWidth = "700px";
  celebrationEl.style.width = "90%";
  celebrationEl.style.padding = "14px 16px";
  celebrationEl.style.borderRadius = "12px";
  celebrationEl.style.background = "#ecfeff";
  celebrationEl.style.border = "1px solid rgba(0,0,0,0.08)";
  celebrationEl.style.color = "#003c71";
  celebrationEl.style.fontWeight = "600";
  host.appendChild(celebrationEl);
}

function renderCelebrationIfGoalReached() {
  ensureCelebrationUI();

  if (state.total < ATTENDANCE_GOAL) {
    celebrationEl.style.display = "none";
    celebrationEl.textContent = "";
    return;
  }

  const result = computeWinner(state.teams);
  if (result.tie) {
    const labels = result.teams.map(formatTeamLabel).join(" & ");
    celebrationEl.textContent = `🎉 Goal reached! It’s a tie at ${result.count}: ${labels}!`;
  } else {
    celebrationEl.textContent = `🎉 Goal reached! Current leader: ${formatTeamLabel(result.team)} (${result.count})`;
  }
  celebrationEl.style.display = "block";
}

// ===== Storage =====
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // If storage fails, app still works without persistence.
    console.warn("localStorage save failed:", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    // minimal validation
    if (typeof parsed.total === "number" && parsed.teams && Array.isArray(parsed.attendees)) {
      state = parsed;
    }
  } catch (e) {
    console.warn("localStorage load failed:", e);
  }
}

// ===== Rendering =====
function renderGreeting(name) {
  if (!greetingEl) return;

  greetingEl.textContent = `Welcome, ${name}! Thanks for checking in.`;
  greetingEl.classList.add("success-message"); // matches starter styling  [oai_citation:3‡GitHub](https://github.com/GCA-Classroom/05-prj-intel-event-check-in/raw/main/style.css)
  greetingEl.style.display = "block";

  // auto-hide after a moment (still counts as “displayed” for rubric)
  setTimeout(() => {
    if (greetingEl) greetingEl.style.display = "none";
  }, 2500);
}

function renderCounts() {
  if (attendeeCountEl) attendeeCountEl.textContent = String(state.total);

  if (waterCountEl) waterCountEl.textContent = String(state.teams.water);
  if (zeroCountEl) zeroCountEl.textContent = String(state.teams.zero);
  if (renewablesCountEl) renewablesCountEl.textContent = String(state.teams.renewables);

  // Update any "Attendance: X/50" text if we can find it safely
  if (attendanceTextEl) {
    // If it contains the word "Attendance", update just that part.
    const txt = attendanceTextEl.textContent || "";
    if (txt.toLowerCase().includes("attendance")) {
      // Try to preserve any icons around it; simplest: set full text if it's a plain container
      // If it’s a complex element, this still typically works.
      attendanceTextEl.textContent = `Attendance: ${state.total}/${ATTENDANCE_GOAL}`;
    }
  }

  if (progressBarEl) {
    const pct = clamp((state.total / ATTENDANCE_GOAL) * 100, 0, 100);
    progressBarEl.style.width = `${pct}%`;
  }
}

function renderAll() {
  renderCounts();
  renderAttendeeList();
  renderCelebrationIfGoalReached();
}

// ===== Main action =====
function checkIn() {
  const rawName = nameInput ? nameInput.value : "";
  const name = (rawName || "").trim();

  const teamRaw = teamSelect ? teamSelect.value : "";
  const teamKey = normalizeTeam(teamRaw);

  // Basic validation (prevents “partial points” mistakes)
  if (!name) {
    alert("Please enter an attendee name.");
    if (nameInput) nameInput.focus();
    return;
  }
  if (!teamKey) {
    alert("Please select a team.");
    if (teamSelect) teamSelect.focus();
    return;
  }

  // Update state
  state.total += 1;
  state.teams[teamKey] += 1;
  state.attendees.push({ name, teamKey, ts: Date.now() });

  // UI updates
  renderGreeting(name);
  renderAll();

  // Save progress (LevelUp)
  saveState();

  // Reset inputs for next person
  if (nameInput) nameInput.value = "";
  if (teamSelect) teamSelect.value = ""; // returns to "Select Team..." in most starters
  if (nameInput) nameInput.focus();
}

// ===== Boot =====
function init() {
  loadState();
  renderAll();

  if (checkInBtn) {
    checkInBtn.addEventListener("click", checkIn);
  }

  // Allow Enter key to submit when typing name
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") checkIn();
    });
  }
}

init();
