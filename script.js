// ---------- Data Model ----------
let items = JSON.parse(localStorage.getItem("clarioItems")) || [];

// ---------- DOM Elements ----------
const addItemBtn = document.getElementById("add-item-btn");
const addItemFormDiv = document.getElementById("add-item-form");
const itemForm = document.getElementById("item-form");
const cancelItemBtn = document.getElementById("cancel-item");

const upcomingList = document.getElementById("upcoming-list");
const itemsList = document.getElementById("items-list");
const monthlyTotalSpan = document.getElementById("monthly-total");

const personalBtn = document.getElementById("personal-mode");
const businessBtn = document.getElementById("business-mode");

let currentMode = "personal";

// ---------- Utility Functions ----------
function saveItems() {
  localStorage.setItem("clarioItems", JSON.stringify(items));
}

function formatDate(d) {
  const date = new Date(d);
  const today = new Date();
  const diffTime = date - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return "Past";
  return `In ${diffDays} days`;
}

function calculateMonthlyTotal() {
  const total = items
    .filter(i => i.type === "payment" && i.mode === currentMode)
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  monthlyTotalSpan.textContent = total.toFixed(2);
}

function getUpcomingItems() {
  return items
    .filter(i => i.status === "upcoming" && i.mode === currentMode)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);
}

// ---------- Rendering Functions ----------
function renderUpcoming() {
  upcomingList.innerHTML = "";
  const upcoming = getUpcomingItems();
  upcoming.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="item-title">${item.title}</span>
      <span class="item-due">${formatDate(item.dueDate)}</span>
      ${item.type === "payment" ? `<span class="item-amount">$${item.amount}</span>` : ""}
    `;
    upcomingList.appendChild(li);
  });
}

function renderAllItems() {
  itemsList.innerHTML = "";
  items
    .filter(i => i.mode === currentMode)
    .forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="item-title">${item.title}</span>
        <span class="item-due">${formatDate(item.dueDate)}</span>
        ${item.type === "payment" ? `<span class="item-amount">$${item.amount}</span>` : ""}
        <span class="status-${item.status}">${item.status}</span>
        <button class="mark-done">✔</button>
        <button class="delete-item">🗑️</button>
      `;

      li.querySelector(".mark-done").addEventListener("click", () => {
        item.status = "done";
        saveItems();
        processRecurringItems(item); // prevent duplicate recurring
        renderDashboard();
      });

      li.querySelector(".delete-item").addEventListener("click", () => {
        items = items.filter(i => i.id !== item.id);
        saveItems();
        renderDashboard();
      });

      itemsList.appendChild(li);
    });
}

function renderDashboard() {
  renderUpcoming();
  renderAllItems();
  calculateMonthlyTotal();
}

// ---------- Mode Toggle ----------
function setMode(mode) {
  currentMode = mode;
  personalBtn.classList.toggle("active", mode === "personal");
  businessBtn.classList.toggle("active", mode === "business");
  renderDashboard();
}

personalBtn.addEventListener("click", () => setMode("personal"));
businessBtn.addEventListener("click", () => setMode("business"));

// ---------- Add Item Form ----------
addItemBtn.addEventListener("click", () => {
  addItemFormDiv.classList.add("show");
});

cancelItemBtn.addEventListener("click", () => {
  addItemFormDiv.classList.remove("show");
  itemForm.reset();
});

itemForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const newItem = {
    id: Date.now().toString(),
    title: document.getElementById("item-title").value,
    type: document.getElementById("item-type").value,
    dueDate: document.getElementById("item-due-date").value,
    amount: Number(document.getElementById("item-amount").value) || 0,
    recurring: document.getElementById("item-recurring").value || null,
    status: "upcoming",
    reminder: document.getElementById("item-reminder").checked,
    mode: document.getElementById("item-mode").value,
    createdAt: new Date().toISOString(),
    recurringProcessed: false
  };

  items.push(newItem);
  saveItems();
  renderDashboard();
  addItemFormDiv.classList.remove("show");
  itemForm.reset();
});

// ---------- Conditional Amount Field ----------
const typeSelect = document.getElementById("item-type");
const amountLabel = document.getElementById("amount-label");

typeSelect.addEventListener("change", () => {
  amountLabel.style.display = typeSelect.value === "payment" ? "block" : "none";
});

// ---------- Recurring Items ----------
function processRecurringItems(doneItem) {
  // Only process if recurring and not already processed
  if (!doneItem || !doneItem.recurring || doneItem.recurringProcessed) return;

  const dueDate = new Date(doneItem.dueDate);
  let newDueDate;

  switch (doneItem.recurring) {
    case "daily": newDueDate = new Date(dueDate.setDate(dueDate.getDate() + 1)); break;
    case "weekly": newDueDate = new Date(dueDate.setDate(dueDate.getDate() + 7)); break;
    case "monthly": newDueDate = new Date(dueDate.setMonth(dueDate.getMonth() + 1)); break;
    case "yearly": newDueDate = new Date(dueDate.setFullYear(dueDate.getFullYear() + 1)); break;
  }

  if (newDueDate) {
    const newItem = { ...doneItem };
    newItem.id = Date.now().toString();
    newItem.dueDate = newDueDate.toISOString().split("T")[0];
    newItem.status = "upcoming";
    newItem.recurringProcessed = false;
    items.push(newItem);

    doneItem.recurringProcessed = true; // mark original done item
    saveItems();
  }
}

// ---------- Notifications ----------
function checkReminders() {
  const now = new Date();
  const reminderItems = items.filter(i => i.reminder && i.status === "upcoming");

  reminderItems.forEach(item => {
    const dueDate = new Date(item.dueDate);
    const diffHours = (dueDate - now) / (1000 * 60 * 60);
    if (diffHours <= 24 && diffHours > 23.99) notifyUser(item);
  });
}

function notifyUser(item) {
  if (Notification.permission === "granted") {
    new Notification("Clario Reminder", {
      body: `${item.title} is due ${formatDate(item.dueDate)}`
    });
  }
}

if ("Notification" in window) {
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

// ---------- Service Worker Registration ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}

// ---------- Run Initial Setup ----------
setMode(currentMode);
renderDashboard();
setInterval(checkReminders, 1000 * 60 * 60); // every hour
