import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const NAME_KEY = "familyTodo.displayName";
const FILTER_KEY = "familyTodo.statusFilter";
const KIND_KEY = "familyTodo.kindFilter";
const SORT_KEY = "familyTodo.sort";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const els = {
  addBtn: document.getElementById("add-btn"),
  whoami: document.getElementById("whoami"),
  activeList: document.getElementById("active-list"),
  completedList: document.getElementById("completed-list"),
  completedWrap: document.getElementById("completed-wrap"),
  completedCount: document.getElementById("completed-count"),
  emptyState: document.getElementById("empty-state"),
  loadingState: document.getElementById("loading-state"),
  configWarning: document.getElementById("config-warning"),
  statusChips: document.querySelectorAll('.chip[data-filter]'),
  kindChips: document.querySelectorAll('.chip[data-kind]'),
  sortSelect: document.getElementById("sort-select"),
  // Task dialog
  taskDialog: document.getElementById("task-dialog"),
  taskForm: document.getElementById("task-form"),
  dialogTitle: document.getElementById("dialog-title"),
  fTitle: document.getElementById("f-title"),
  fDate: document.getElementById("f-date"),
  fTime: document.getElementById("f-time"),
  fPriority: document.getElementById("f-priority"),
  fIsBuy: document.getElementById("f-isbuy"),
  fPlace: document.getElementById("f-place"),
  placeField: document.getElementById("place-field"),
  deleteBtn: document.getElementById("delete-btn"),
  cancelBtn: document.getElementById("cancel-btn"),
  // Name dialog
  nameDialog: document.getElementById("name-dialog"),
  nameForm: document.getElementById("name-form"),
  fName: document.getElementById("f-name"),
  // Confirm dialog
  confirmDialog: document.getElementById("confirm-dialog"),
  confirmText: document.getElementById("confirm-text"),
  confirmOk: document.getElementById("confirm-ok"),
  confirmCancel: document.getElementById("confirm-cancel")
};

const state = {
  tasks: [],
  statusFilter: localStorage.getItem(FILTER_KEY) || "all",
  kindFilter: localStorage.getItem(KIND_KEY) || "all",
  sort: localStorage.getItem(SORT_KEY) || "due",
  displayName: localStorage.getItem(NAME_KEY) || "",
  editingId: null,
  db: null,
  tasksCol: null
};

// ---------- Firebase init ----------
function initFirebase() {
  if (!firebaseConfigured) {
    els.loadingState.hidden = true;
    els.configWarning.hidden = false;
    return false;
  }
  try {
    const app = initializeApp(firebaseConfig);
    state.db = getFirestore(app);
    state.tasksCol = collection(state.db, "tasks");
    return true;
  } catch (err) {
    console.error("Firebase init failed", err);
    els.loadingState.hidden = true;
    els.configWarning.hidden = false;
    els.configWarning.textContent = "Firebase couldn't initialize. Check firebase-config.js — see the README.";
    return false;
  }
}

function subscribeTasks() {
  const q = query(state.tasksCol, orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    state.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    els.loadingState.hidden = true;
    render();
  }, (err) => {
    console.error("Firestore subscription error", err);
    els.loadingState.hidden = true;
    els.configWarning.hidden = false;
    els.configWarning.textContent = "Couldn't read tasks. Check Firestore rules — see the README.";
  });
}

// ---------- Helpers ----------
function tsToDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

function formatDue(date) {
  if (!date) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (sameDay) return hasTime ? `Today ${timeStr}` : "Today";
  if (isTomorrow) return hasTime ? `Tomorrow ${timeStr}` : "Tomorrow";
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return hasTime ? `${dateStr} ${timeStr}` : dateStr;
}

function isOverdue(date, completed) {
  if (!date || completed) return false;
  return date.getTime() < Date.now();
}

function setActiveChip(group, value, attr) {
  group.forEach((c) => c.classList.toggle("is-active", c.dataset[attr] === value));
}

// ---------- Render ----------
function applyFilters(tasks) {
  return tasks.filter((t) => {
    if (state.kindFilter === "buy" && !t.isBuy) return false;
    if (state.kindFilter === "task" && t.isBuy) return false;
    return true;
  });
}

function sortTasks(tasks) {
  const copy = tasks.slice();
  if (state.sort === "priority") {
    copy.sort((a, b) => {
      const ap = PRIORITY_RANK[a.priority] ?? 1;
      const bp = PRIORITY_RANK[b.priority] ?? 1;
      if (ap !== bp) return ap - bp;
      return dueValue(a) - dueValue(b);
    });
  } else {
    copy.sort((a, b) => dueValue(a) - dueValue(b));
  }
  return copy;
}

function dueValue(t) {
  const d = tsToDate(t.dueAt);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

function render() {
  setActiveChip(els.statusChips, state.statusFilter, "filter");
  setActiveChip(els.kindChips, state.kindFilter, "kind");
  els.sortSelect.value = state.sort;
  els.whoami.textContent = state.displayName ? `👤 ${state.displayName}` : "Set name";

  const filtered = applyFilters(state.tasks);
  const active = sortTasks(filtered.filter((t) => !t.completed));
  const completed = sortTasks(filtered.filter((t) => t.completed));

  const showActive = state.statusFilter !== "completed";
  const showCompleted = state.statusFilter !== "active";

  els.activeList.innerHTML = "";
  els.completedList.innerHTML = "";

  if (showActive) {
    active.forEach((t) => els.activeList.appendChild(renderRow(t)));
  }
  if (showCompleted) {
    completed.forEach((t) => els.completedList.appendChild(renderRow(t)));
  }

  els.completedCount.textContent = String(completed.length);
  els.completedWrap.hidden = !showCompleted || completed.length === 0;
  els.activeList.hidden = !showActive;

  const totalShown =
    (showActive ? active.length : 0) + (showCompleted ? completed.length : 0);
  els.emptyState.hidden = totalShown > 0;
}

function renderRow(t) {
  const li = document.createElement("li");
  li.className = `task priority-${t.priority || "medium"}`;
  li.dataset.id = t.id;

  const due = tsToDate(t.dueAt);
  const overdue = isOverdue(due, t.completed);

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "check";
  check.checked = !!t.completed;
  check.setAttribute("aria-label", t.completed ? "Mark incomplete" : "Mark complete");
  check.addEventListener("click", (e) => e.stopPropagation());
  check.addEventListener("change", () => toggleComplete(t));

  const body = document.createElement("div");
  body.className = "body";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = t.title || "(untitled)";
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "meta";

  if (t.priority) {
    const badge = document.createElement("span");
    badge.className = `badge priority-${t.priority}`;
    badge.textContent = t.priority.toUpperCase();
    meta.appendChild(badge);
  }

  if (t.isBuy) {
    const kind = document.createElement("span");
    kind.className = "badge kind-buy";
    kind.textContent = t.place ? `BUY · ${t.place}` : "BUY";
    meta.appendChild(kind);
  }

  if (due) {
    const dueEl = document.createElement("span");
    dueEl.className = "due" + (overdue ? " overdue" : "");
    dueEl.textContent = formatDue(due);
    meta.appendChild(dueEl);
  }

  if (t.completed && t.completedBy) {
    const by = document.createElement("span");
    by.className = "author";
    by.textContent = `done by ${t.completedBy}`;
    meta.appendChild(by);
  } else if (!t.completed && t.createdBy) {
    const by = document.createElement("span");
    by.className = "author";
    by.textContent = `from ${t.createdBy}`;
    meta.appendChild(by);
  }

  body.appendChild(meta);

  li.appendChild(check);
  li.appendChild(body);

  li.addEventListener("click", () => openEdit(t));
  return li;
}

// ---------- Mutations ----------
async function toggleComplete(t) {
  const now = !t.completed;
  try {
    await updateDoc(doc(state.db, "tasks", t.id), {
      completed: now,
      completedAt: now ? serverTimestamp() : null,
      completedBy: now ? (state.displayName || null) : null
    });
  } catch (err) {
    console.error(err);
    alert("Couldn't update. Check your connection.");
  }
}

async function saveTask(payload) {
  if (state.editingId) {
    await updateDoc(doc(state.db, "tasks", state.editingId), payload);
  } else {
    await addDoc(state.tasksCol, {
      ...payload,
      completed: false,
      completedAt: null,
      completedBy: null,
      createdAt: serverTimestamp(),
      createdBy: state.displayName || null
    });
  }
}

async function deleteTask(id) {
  await deleteDoc(doc(state.db, "tasks", id));
}

// ---------- Dialogs ----------
function openAdd() {
  if (!state.displayName) { openNamePrompt(); return; }
  state.editingId = null;
  els.dialogTitle.textContent = "New item";
  els.taskForm.reset();
  els.fPriority.value = "medium";
  els.fIsBuy.checked = false;
  els.placeField.hidden = true;
  els.deleteBtn.hidden = true;
  els.taskDialog.showModal();
  setTimeout(() => els.fTitle.focus(), 50);
}

function openEdit(t) {
  state.editingId = t.id;
  els.dialogTitle.textContent = "Edit item";
  els.fTitle.value = t.title || "";
  const due = tsToDate(t.dueAt);
  if (due) {
    const pad = (n) => String(n).padStart(2, "0");
    els.fDate.value = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
    const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0;
    els.fTime.value = hasTime ? `${pad(due.getHours())}:${pad(due.getMinutes())}` : "";
  } else {
    els.fDate.value = "";
    els.fTime.value = "";
  }
  els.fPriority.value = t.priority || "medium";
  els.fIsBuy.checked = !!t.isBuy;
  els.fPlace.value = t.place || "";
  els.placeField.hidden = !els.fIsBuy.checked;
  els.deleteBtn.hidden = false;
  els.taskDialog.showModal();
}

function readForm() {
  const title = els.fTitle.value.trim();
  if (!title) return null;
  let dueAt = null;
  if (els.fDate.value) {
    const [y, m, d] = els.fDate.value.split("-").map(Number);
    let hh = 0, mm = 0;
    if (els.fTime.value) {
      const [h, min] = els.fTime.value.split(":").map(Number);
      hh = h || 0; mm = min || 0;
    }
    const localDate = new Date(y, (m - 1), d, hh, mm, 0, 0);
    dueAt = Timestamp.fromDate(localDate);
  }
  const isBuy = els.fIsBuy.checked;
  return {
    title,
    dueAt,
    priority: els.fPriority.value || "medium",
    isBuy,
    place: isBuy ? els.fPlace.value.trim() : ""
  };
}

function openNamePrompt() {
  els.fName.value = state.displayName || "";
  els.nameDialog.showModal();
  setTimeout(() => els.fName.focus(), 50);
}

function openConfirmDelete(t) {
  els.confirmText.textContent = `"${t.title}" will be removed for everyone.`;
  els.confirmDialog.returnValue = "";
  els.confirmDialog.showModal();
  const onOk = async () => {
    cleanup();
    els.confirmDialog.close("ok");
    try {
      await deleteTask(t.id);
      els.taskDialog.close();
    } catch (err) {
      console.error(err);
      alert("Couldn't delete. Check your connection.");
    }
  };
  const onCancel = () => { cleanup(); els.confirmDialog.close("cancel"); };
  const cleanup = () => {
    els.confirmOk.removeEventListener("click", onOk);
    els.confirmCancel.removeEventListener("click", onCancel);
  };
  els.confirmOk.addEventListener("click", onOk);
  els.confirmCancel.addEventListener("click", onCancel);
}

// ---------- Wiring ----------
function wire() {
  els.addBtn.addEventListener("click", openAdd);
  els.whoami.addEventListener("click", openNamePrompt);

  els.statusChips.forEach((c) =>
    c.addEventListener("click", () => {
      state.statusFilter = c.dataset.filter;
      localStorage.setItem(FILTER_KEY, state.statusFilter);
      render();
    })
  );

  els.kindChips.forEach((c) =>
    c.addEventListener("click", () => {
      state.kindFilter = c.dataset.kind;
      localStorage.setItem(KIND_KEY, state.kindFilter);
      render();
    })
  );

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    localStorage.setItem(SORT_KEY, state.sort);
    render();
  });

  els.fIsBuy.addEventListener("change", () => {
    els.placeField.hidden = !els.fIsBuy.checked;
  });

  els.cancelBtn.addEventListener("click", () => els.taskDialog.close("cancel"));

  els.taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = readForm();
    if (!payload) return;
    try {
      await saveTask(payload);
      els.taskDialog.close("saved");
    } catch (err) {
      console.error(err);
      alert("Couldn't save. Check your connection.");
    }
  });

  els.deleteBtn.addEventListener("click", () => {
    const t = state.tasks.find((x) => x.id === state.editingId);
    if (t) openConfirmDelete(t);
  });

  els.nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.fName.value.trim();
    if (!name) return;
    state.displayName = name;
    localStorage.setItem(NAME_KEY, name);
    els.nameDialog.close("ok");
    render();
  });

  // Tap outside a dialog closes it
  [els.taskDialog, els.nameDialog, els.confirmDialog].forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d) d.close("backdrop");
    });
  });
}

// ---------- Boot ----------
function boot() {
  wire();
  if (!initFirebase()) return;
  subscribeTasks();
  if (!state.displayName) openNamePrompt();
}

boot();
