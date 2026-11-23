const STORAGE_KEY = "ny-gifts-2027-v2";
const APP_VERSION = 2;
const params = new URLSearchParams(location.search);

const ui = {
  view: params.get("tab") === "shopping" ? "shopping" : "people",
  filter: "all",
  search: "",
  selectedId: null
};

let people = loadPeople();

function uid() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function toNumber(value) {
  const cleaned = String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function normalisePerson(person) {
  return {
    id: person && person.id ? String(person.id) : uid(),
    name: String(person?.name || "Без имени"),
    note: String(person?.note || ""),
    spent: toNumber(person?.spent),
    items: Array.isArray(person?.items) ? person.items.map(item => ({
      id: item && item.id ? String(item.id) : uid(),
      label: String(item?.label || "Подарок"),
      bought: Boolean(item?.bought)
    })) : []
  };
}

function loadPeople() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.people)) return parsed.people.map(normalisePerson);
    }
  } catch (error) {
    console.warn("Не удалось прочитать сохранённые данные.", error);
  }
  return [];
}

function savePeople() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: APP_VERSION, savedAt: new Date().toISOString(), people }));
  } catch (error) {
    console.warn("Не удалось сохранить данные.", error);
  }
}

function money(value) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(value) || 0)) + " ₽";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function plural(n, forms) {
  const abs = Math.abs(Number(n) || 0) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
}

function statsFor(person) {
  const total = person.items.length;
  const boughtCount = person.items.filter(item => item.bought).length;
  return {
    total,
    boughtCount,
    percent: total ? Math.round((boughtCount / total) * 100) : 0,
    empty: total === 0
  };
}

function globalStats() {
  return people.reduce((acc, person) => {
    const s = statsFor(person);
    acc.totalItems += s.total;
    acc.boughtItems += s.boughtCount;
    acc.spent += person.spent;
    if (s.empty) acc.emptyPeople += 1;
    return acc;
  }, { totalItems: 0, boughtItems: 0, spent: 0, emptyPeople: 0 });
}

function todoCount() {
  return people.reduce((sum, person) => sum + person.items.filter(item => !item.bought).length, 0);
}

function findPerson(id) {
  return people.find(person => person.id === id);
}

function haystack(person) {
  return [person.name, person.note, ...person.items.map(item => item.label)].join(" ").toLowerCase();
}

function matchSearch(person) {
  return !ui.search || haystack(person).includes(ui.search.toLowerCase());
}

function filteredPeople() {
  return people.filter(person => {
    if (!matchSearch(person)) return false;
    const s = statsFor(person);
    if (ui.filter === "todo") return s.empty || s.boughtCount < s.total;
    if (ui.filter === "done") return !s.empty && s.boughtCount === s.total;
    return true;
  });
}

function renderSummary() {
  const g = globalStats();
  const percent = g.totalItems ? Math.round((g.boughtItems / g.totalItems) * 100) : 0;
  document.getElementById("summary").innerHTML = `
    <div class="stat"><span>Людей</span><strong>${people.length}</strong><small>${people.length ? (g.emptyPeople ? `${g.emptyPeople} без подарков` : "в списке") : "пусто"}</small></div>
    <div class="stat"><span>Подарков</span><strong>${g.totalItems}</strong><small>${g.boughtItems} куплено</small></div>
    <div class="stat"><span>Собрано</span><strong>${percent}%</strong><div class="mini-bar"><i style="width:${percent}%"></i></div><small>${g.boughtItems} из ${g.totalItems}</small></div>
    <div class="stat"><span>Потрачено</span><strong>${money(g.spent)}</strong><small>введено вручную</small></div>
  `;
}

function renderPersonRow(person) {
  const s = statsFor(person);
  return `
    <article class="person-row" data-action="open-person" data-person="${esc(person.id)}" tabindex="0" role="button">
      <div class="avatar">${esc(initials(person.name))}</div>
      <div class="person-info">
        <h3>${esc(person.name)}</h3>
        <p>${person.note ? esc(person.note) : "Без заметки"} · ${s.total ? `${s.total} ${plural(s.total, ["подарок", "подарка", "подарков"])}` : "пока нет подарков"}</p>
        <div class="row-progress"><i style="width:${s.percent}%"></i></div>
      </div>
      <div class="person-meta">
        <span class="percent">${s.percent}%</span>
        <span class="spent">${person.spent ? money(person.spent) : "—"}</span>
      </div>
      <button class="icon-btn" data-action="delete-person" data-person="${esc(person.id)}" aria-label="Удалить ${esc(person.name)}">×</button>
    </article>
  `;
}

function renderPeople() {
  const list = filteredPeople();
  const head = `
    <div class="section-head">
      <div><h2>Люди</h2><p>${people.length ? `${people.length} в списке` : "Список пока пуст"}</p></div>
      <button class="primary" data-action="add-person">+ Добавить</button>
    </div>
  `;
  let body = "";
  if (!people.length) {
    body = `<div class="empty"><strong>Пока никого нет</strong><span>Добавь человека, а потом — подарки для него.</span></div>`;
  } else if (!list.length) {
    body = `<div class="empty">Ничего не найдено. Измени поиск или фильтр.</div>`;
  } else {
    body = `<div class="people-list">${list.map(renderPersonRow).join("")}</div>`;
  }
  document.getElementById("peopleView").innerHTML = head + body;
}

function renderItem(person, item) {
  return `
    <li class="item ${item.bought ? "bought" : ""}">
      <label>
        <input type="checkbox" data-action="toggle" data-person="${esc(person.id)}" data-item="${esc(item.id)}" ${item.bought ? "checked" : ""}>
        <span class="check" aria-hidden="true"></span>
        <span class="item-label">${esc(item.label)}</span>
      </label>
      <button class="icon-btn tiny" data-action="delete-item" data-person="${esc(person.id)}" data-item="${esc(item.id)}" aria-label="Удалить подарок">×</button>
    </li>
  `;
}

function renderPersonDetail() {
  const person = findPerson(ui.selectedId);
  if (!person) {
    if (ui.view === "person") {
      ui.view = "people";
      ui.selectedId = null;
    }
    document.getElementById("personView").innerHTML = "";
    return;
  }
  const s = statsFor(person);
  document.getElementById("personView").innerHTML = `
    <div class="detail-top">
      <button class="back" data-action="back">← Все люди</button>
      <button class="icon-btn" data-action="delete-person" data-person="${esc(person.id)}" aria-label="Удалить человека">×</button>
    </div>
    <div class="detail-card">
      <div class="detail-head">
        <div>
          <p class="eyebrow">Карточка человека</p>
          <h2>${esc(person.name)}</h2>
        </div>
        <div class="ring" style="--p:${s.percent}" aria-label="Собрано ${s.percent}%"><span>${s.percent}%</span></div>
      </div>

      <div class="detail-fields">
        <label class="field">
          <span>Заметка</span>
          <input data-field="note" data-person="${esc(person.id)}" value="${esc(person.note)}" placeholder="Кто это, что важно">
        </label>
        <label class="field">
          <span>Потрачено на подарки, ₽</span>
          <input inputmode="decimal" data-field="spent" data-person="${esc(person.id)}" value="${person.spent || ""}" placeholder="0">
        </label>
      </div>

      <div class="progress"><i style="width:${s.percent}%"></i></div>
      <div class="detail-meta">${s.boughtCount}/${s.total} куплено${s.total ? ` · осталось ${s.total - s.boughtCount}` : " · добавь первый подарок"}</div>

      <div class="section-head compact">
        <h3>Подарки</h3>
        <button class="ghost" data-action="rename-person" data-person="${esc(person.id)}">Переименовать</button>
      </div>

      <ul class="items">${person.items.length ? person.items.map(item => renderItem(person, item)).join("") : `<li class="empty-item">Пока нет подарков.</li>`}</ul>

      <form class="add-item-form" data-form="add-item" data-person="${esc(person.id)}">
        <input name="label" placeholder="Что купить?" autocomplete="off">
        <button type="submit" class="primary">+</button>
      </form>

      <button class="danger" data-action="delete-person" data-person="${esc(person.id)}">Удалить человека</button>
    </div>
  `;
}

function renderShopping() {
  const groups = people.map(person => ({
    person,
    items: person.items.filter(item => !item.bought && matchSearch(person))
  })).filter(group => group.items.length);

  document.getElementById("shoppingView").innerHTML = groups.length
    ? `<div class="section-head"><div><h2>Купить</h2><p>${todoCount()} ${plural(todoCount(), ["позиция", "позиции", "позиций"])}</p></div></div>` + groups.map(group => `
        <article class="shop-person">
          <button class="shop-person-title" data-action="open-person" data-person="${esc(group.person.id)}">${esc(group.person.name)} <span>→</span></button>
          <div class="shop-items">
            ${group.items.map(item => `
              <div class="shop-item">
                <label>
                  <input type="checkbox" data-action="toggle" data-person="${esc(group.person.id)}" data-item="${esc(item.id)}">
                  <span class="item-label">${esc(item.label)}</span>
                </label>
              </div>
            `).join("")}
          </div>
        </article>
      `).join("")
    : `<div class="empty"><strong>Пока нечего покупать</strong><span>${people.length ? "Все подарки отмечены купленными." : "Сначала добавь людей и подарки."}</span></div>`;
}

function updateControls() {
  document.getElementById("peopleCount").textContent = people.length;
  document.getElementById("todoCount").textContent = todoCount();
  document.querySelectorAll(".tab").forEach(button => {
    const active = ui.view === "shopping" ? button.dataset.tab === "shopping" : button.dataset.tab === "people";
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".chip").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === ui.filter);
  });
  document.getElementById("toolbar").hidden = ui.view === "person";
  document.getElementById("filters").hidden = ui.view !== "people";
  document.getElementById("peopleView").hidden = ui.view !== "people";
  document.getElementById("personView").hidden = ui.view !== "person";
  document.getElementById("shoppingView").hidden = ui.view !== "shopping";
}

function render() {
  renderSummary();
  renderPeople();
  renderPersonDetail();
  renderShopping();
  updateControls();
}

function addPerson() {
  const name = window.prompt("Имя и фамилия человека");
  if (!name || !name.trim()) return;
  const person = normalisePerson({ name: name.trim(), note: "", spent: 0, items: [] });
  people.push(person);
  savePeople();
  ui.view = "person";
  ui.selectedId = person.id;
  render();
  requestAnimationFrame(() => document.querySelector('[data-field="note"]')?.focus());
}

function deletePerson(personId) {
  const person = findPerson(personId);
  if (!person) return;
  if (!window.confirm(`Удалить «${person.name}» из списка?`)) return;
  people = people.filter(entry => entry.id !== personId);
  if (ui.selectedId === personId) {
    ui.selectedId = null;
    ui.view = "people";
  }
  savePeople();
  render();
}

function renamePerson(personId) {
  const person = findPerson(personId);
  if (!person) return;
  const name = window.prompt("Имя и фамилия человека", person.name);
  if (!name || !name.trim()) return;
  person.name = name.trim();
  savePeople();
  render();
}

function toggleItem(personId, itemId, bought) {
  const person = findPerson(personId);
  const item = person?.items.find(entry => entry.id === itemId);
  if (!item) return;
  item.bought = bought;
  savePeople();
  render();
}

function addItem(personId, label) {
  const person = findPerson(personId);
  const clean = String(label || "").trim();
  if (!person || !clean) return;
  person.items.push({ id: uid(), label: clean, bought: false });
  savePeople();
  render();
  requestAnimationFrame(() => document.querySelector('[data-form="add-item"] input')?.focus());
}

function deleteItem(personId, itemId) {
  const person = findPerson(personId);
  const item = person?.items.find(entry => entry.id === itemId);
  if (!person || !item) return;
  if (!window.confirm(`Удалить «${item.label}»?`)) return;
  person.items = person.items.filter(entry => entry.id !== itemId);
  savePeople();
  render();
}

function exportData() {
  const payload = { version: APP_VERSION, exportedAt: new Date().toISOString(), people };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "podarki-2027.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function importData(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.people)) throw new Error("bad format");
      if (!window.confirm("Импорт заменит текущий список. Продолжить?")) return;
      people = parsed.people.map(normalisePerson);
      ui.view = "people";
      ui.selectedId = null;
      savePeople();
      render();
    } catch (error) {
      window.alert("Не удалось прочитать файл. Нужен JSON, экспортированный из этого приложения.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

document.addEventListener("change", event => {
  const input = event.target.closest('input[type="checkbox"][data-action="toggle"]');
  if (!input) return;
  toggleItem(input.dataset.person, input.dataset.item, input.checked);
});

document.addEventListener("input", event => {
  const field = event.target.closest("input[data-field]");
  if (!field) return;
  const person = findPerson(field.dataset.person);
  if (!person) return;
  if (field.dataset.field === "note") person.note = field.value;
  if (field.dataset.field === "spent") person.spent = toNumber(field.value);
  savePeople();
  if (field.dataset.field === "spent") renderSummary();
});

document.addEventListener("submit", event => {
  const form = event.target.closest('[data-form="add-item"]');
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector('input[name="label"]');
  addItem(form.dataset.person, input?.value);
});

document.addEventListener("click", event => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const action = actionElement.dataset.action;
  if (action === "add-person") addPerson();
  if (action === "open-person") {
    ui.view = "person";
    ui.selectedId = actionElement.dataset.person;
    render();
  }
  if (action === "back") {
    ui.view = "people";
    ui.selectedId = null;
    render();
  }
  if (action === "delete-person") deletePerson(actionElement.dataset.person);
  if (action === "rename-person") renamePerson(actionElement.dataset.person);
  if (action === "delete-item") deleteItem(actionElement.dataset.person, actionElement.dataset.item);
  if (action === "export") exportData();
  if (action === "import") document.getElementById("importFile").click();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest('.person-row[data-action="open-person"]');
  if (!row) return;
  event.preventDefault();
  ui.view = "person";
  ui.selectedId = row.dataset.person;
  render();
});

document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("search");
  search.value = ui.search;
  search.addEventListener("input", event => {
    ui.search = event.target.value.trim();
    renderPeople();
    renderShopping();
  });
  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      ui.view = button.dataset.tab;
      ui.selectedId = null;
      render();
    });
  });
  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      ui.filter = button.dataset.filter;
      renderPeople();
      updateControls();
    });
  });
  document.getElementById("importFile").addEventListener("change", importData);
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker не зарегистрирован.", error));
  });
}


