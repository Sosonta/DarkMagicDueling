import { app, auth, db } from "./firebase.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

export function setupAdminPage() {

const wrapper = document.querySelector('.page-wrapper');
if (wrapper) {
  wrapper.addEventListener('animationend', () => {
    renderCardGrid(cardData); // NOW safe to run
  }, { once: true });
} else {
  renderCardGrid(cardData); // Fallback
}

async function loadUserList() {
  userList.innerHTML = "";
  const snapshot = await getDocs(collection(db, "duelIDs"));

  snapshot.forEach(docSnap => {
    const li = document.createElement("li");
    const data = docSnap.data();
    li.textContent = data.displayName || data.username || docSnap.id;
li.addEventListener("click", () => {
  playButtonPressSound();
  selectedUser = docSnap.id;
  userDisplay.textContent = li.textContent;
  userModal.style.display = "none";
});
    userList.appendChild(li);
  });

  userModal.classList.remove("hidden");
}

let allowedCardNames = new Set();

// --- Global State ---
let selectedUser = null;
let selectedPool = null;
let cardData = [];        // All cards from cards.json
let selectedCard = null;  // Currently selected card
let currentPage = 1;
let currentPoolName = null;
const poolNameDisplay = document.getElementById("pool-name-display");
const userModal = document.getElementById("user-modal");
const userList = document.getElementById("user-list");
const userDisplay = document.getElementById("selected-user-display");

function getCurrentPoolData() {
  const data = {};
  Object.keys(rarityGrids).forEach(rarity => {
    const names = Array.from(rarityGrids[rarity].querySelectorAll('img')).map(img => img.alt);
    data[rarity] = names;
  });
  return data;
}

function setCurrentPoolName(name) {
  currentPoolName = name;
  poolNameDisplay.textContent = name || "No Pool Loaded";
}

function playCardSelectSound() {
  const audio = new Audio("./Sound-Effects/Card-Select.wav");
  audio.volume = 0.1;
  audio.play().catch((e) => console.warn("Sound playback failed:", e));
}

function playButtonPressSound() {
  const audio = new Audio("./Sound-Effects/Button-Press.wav");
  audio.volume = 0.1;
  audio.play().catch(e => console.warn("Sound playback failed:", e));
}

const cardsPerPage = 56;
const pageInfo = document.getElementById('page-info');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const cardGrid = document.getElementById('card-grid');
const previewImg = document.getElementById('preview-img');

const filterState = {
  nameIncludes: '',
  effectIncludes: '',
  atkMin: null,
  atkMax: null,
  defMin: null,
  defMax: null,
  types: new Set(),
  races: new Set(),
  attributes: new Set(),
  levels: new Set()
};

const groupedTypes = {
  "Monster": type => type !== "Spell Card" && type !== "Trap Card",
'Spell': type => type === "Spell Card",
'Trap': type => type === "Trap Card",
  'Normal Monster': type => ["Normal Monster", "Gemini Monster", "Normal Tuner Monster", "Pendulum Normal Monster"].includes(type),
  'Effect Monster': type => ["Effect Monster", "Flip Effect Monster", "Flip Tuner Effect Monster", "Pendulum Effect Monster", "Pendulum Flip Effect Monster", "Pendulum Tuner Effect Monster", "Spirit Monster", "Toon Monster", "Tuner Monster", "Union Effect Monster"].includes(type),
  'Ritual Monster': type => ["Ritual Monster", "Pendulum Effect Ritual Monster", "Ritual Effect Monster"].includes(type),
  'Fusion Monster': type => ["Fusion Monster", "Pendulum Effect Fusion Monster"].includes(type),
  'Synchro Monster': type => ["Synchro Monster", "Synchro Pendulum Effect Monster", "Synchro Tuner Monster"].includes(type),
  'XYZ Monster': type => ["XYZ Monster", "XYZ Pendulum Effect Monster"].includes(type),
  'Pendulum Monster': type => ["Pendulum Normal Monster", "Pendulum Effect Fusion Monster", "Pendulum Effect Monster", "Pendulum Effect Ritual Monster", "Pendulum Flip Effect Monster", "Pendulum Tuner Effect Monster", "Synchro Pendulum Effect Monster", "XYZ Pendulum Effect Monster"].includes(type),
  'Link Monster': type => type === "Link Monster",
  'Tuner': type => ["Tuner Monster", "Flip Tuner Effect Monster", "Normal Tuner Monster", "Pendulum Tuner Effect Monster", "Synchro Tuner Monster"].includes(type)
};

// --- Fetch cards and initialize ---
fetch('cards.json')
  .then(res => res.json())
  .then(cards => {
    cards = cards.filter(c => c.type !== "Skill Card");
    cardData = cards.sort((a, b) => a.name.localeCompare(b.name));

const datalist = document.getElementById("card-name-options");
cardData.forEach(card => {
  const option = document.createElement("option");
  option.value = card.name;
  datalist.appendChild(option);
});

    populateDropdownFilters(cards);
    attachFilterListeners();
  })
  .catch(err => console.error("Failed to load cards.json:", err));

function populateDropdownFilters(cards) {
  const types = new Set();
  const attributes = new Set();
  const races = new Set();
  const levels = new Set();

  cards.forEach(card => {
    if (card.type) types.add(card.type);
    if (card.attribute) attributes.add(card.attribute);
    if (card.race) races.add(card.race);
    if (card.level != null) levels.add(card.level);
    if (card.linkval != null) levels.add(card.linkval);
  });

  const typeContainer = document.getElementById("card-type-filter");
  const attrContainer = document.getElementById("attribute-filter");
  const raceContainer = document.getElementById("race-filter");
  const levelContainer = document.getElementById("level-filter");


  function addCheckbox(container, value, key, isGroup = false) {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "0.3rem";
    label.style.marginBottom = "0.3rem";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = value;
    checkbox.dataset.group = isGroup;

    checkbox.addEventListener('change', () => {
      if (key === 'levels') value = parseInt(value);
      if (isGroup) {
        const groupTypes = groupedTypes[value];
        const expanded = typeof groupTypes === 'function'
          ? [...new Set(cardData.map(card => card.type).filter(groupTypes))]
          : groupTypes;

        expanded.forEach(type => {
          checkbox.checked
            ? filterState[key].add(type)
            : filterState[key].delete(type);
        });
      } else {
        checkbox.checked
          ? filterState[key].add(value)
          : filterState[key].delete(value);
      }
      currentPage = 1;
      renderCardGrid();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(value));
    container.appendChild(label);
  }

  Object.keys(groupedTypes).forEach(group => addCheckbox(typeContainer, group, 'types', true));
  typeContainer.appendChild(document.createElement('hr'));
  [...types].sort().forEach(type => addCheckbox(typeContainer, type, 'types'));
  [...attributes].sort().forEach(attr => addCheckbox(attrContainer, attr, 'attributes'));
  [...races].sort().forEach(race => addCheckbox(raceContainer, race, 'races'));
  [...levels].sort((a, b) => a - b).forEach(level => addCheckbox(levelContainer, level, 'levels'));
}

function attachFilterListeners() {
  const keyMap = {
    'atk-min': 'atkMin', 'atk-max': 'atkMax',
    'def-min': 'defMin', 'def-max': 'defMax'
  };

  ['atk-min', 'atk-max', 'def-min', 'def-max'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', e => {
        const val = parseInt(e.target.value, 10);
        filterState[keyMap[id]] = isNaN(val) ? null : val;
        currentPage = 1;
        renderCardGrid();
      });
    }
  });

  document.getElementById('name-filter')?.addEventListener('input', e => {
    filterState.nameIncludes = e.target.value.toLowerCase();
    currentPage = 1;
    renderCardGrid();
  });

  document.getElementById('effect-filter')?.addEventListener('input', e => {
    filterState.effectIncludes = e.target.value.toLowerCase();
    currentPage = 1;
    renderCardGrid();
  });

document.getElementById('clear-filters')?.addEventListener('click', () => {
  const audio = new Audio("./Sound-Effects/Button-Press.wav");
  audio.volume = 0.1;
  audio.play().catch(err => console.warn("Sound failed:", err));

    Object.assign(filterState, {
      nameIncludes: '',
      effectIncludes: '',
      atkMin: null,
      atkMax: null,
      defMin: null,
      defMax: null,
      types: new Set(),
      races: new Set(),
      attributes: new Set(),
      levels: new Set()
    });

    document.querySelectorAll('#filter-bar input[type="text"], #filter-bar input[type="number"]').forEach(el => el.value = '');
    document.querySelectorAll('#filter-bar input[type="checkbox"]').forEach(el => el.checked = false);

    currentPage = 1;
    renderCardGrid();
  });
}

function applyFilters(cards) {
  return cards.filter(card => {
    const name = card.name?.toLowerCase() || '';
    const effect = card.desc?.toLowerCase() || '';
    const atk = card.atk ?? 0;
    const def = card.def ?? 0;
    const level = card.level ?? 0;
    const link = card.linkval ?? null;

    if (filterState.nameIncludes && !name.includes(filterState.nameIncludes)) return false;
    if (filterState.effectIncludes && !effect.includes(filterState.effectIncludes)) return false;
    if (filterState.atkMin !== null && atk < filterState.atkMin) return false;
    if (filterState.atkMax !== null && atk > filterState.atkMax) return false;
    if (filterState.defMin !== null && def < filterState.defMin) return false;
    if (filterState.defMax !== null && def > filterState.defMax) return false;

    if (filterState.types.size && !filterState.types.has(card.type)) return false;
    if (filterState.races.size && !filterState.races.has(card.race)) return false;
    if (filterState.attributes.size && !filterState.attributes.has(card.attribute)) return false;
    if (filterState.levels.size && !filterState.levels.has(level) && !filterState.levels.has(link)) return false;

    return true;
  });
}

// The rest of your existing Admin.js logic stays the same — renderCardGrid, addCardToPool, etc.


const rarityGrids = {
  "Common": document.querySelector('.rarity-row[data-rarity="Common"] .rarity-grid'),
  "Rare": document.querySelector('.rarity-row[data-rarity="Rare"] .rarity-grid'),
  "Super Rare": document.querySelector('.rarity-row[data-rarity="Super Rare"] .rarity-grid'),
  "Ultra Rare": document.querySelector('.rarity-row[data-rarity="Ultra Rare"] .rarity-grid'),
  "Secret Rare": document.querySelector('.rarity-row[data-rarity="Secret Rare"] .rarity-grid')
};

// 🟦 Add drag-over and drop handling to each rarity grid
Object.entries(rarityGrids).forEach(([rarity, grid]) => {
  grid.addEventListener('dragover', (e) => {
    e.preventDefault();
    grid.classList.add('dragover');
  });

  grid.addEventListener('dragleave', () => {
    grid.classList.remove('dragover');
  });

grid.addEventListener('drop', (e) => {
  e.preventDefault();
  grid.classList.remove('dragover');

  const cardData = JSON.parse(e.dataTransfer.getData('text/plain'));
  const cardName = cardData.name;

  // Try to find the card in ANY grid
  let foundCardEl = null;
  let foundGrid = null;

  for (const [r, g] of Object.entries(rarityGrids)) {
    const match = Array.from(g.querySelectorAll('img')).find(img => img.alt === cardName);
    if (match) {
      foundCardEl = match;
      foundGrid = g;
      break;
    }
  }

  if (foundCardEl && foundGrid) {
    foundCardEl.remove();
    grid.appendChild(foundCardEl);
    selectedPoolCard = { el: foundCardEl, rarity };
  } else {
    // It's coming from the browser panel
    addCardToPool(cardData, rarity);
  }
});
});

const removeBtn = document.getElementById('remove-card-btn');
const moveDropdown = document.getElementById('change-rarity-select');

let selectedPoolCard = null; // for selecting in rarity grid

removeBtn.addEventListener('click', () => {
  if (!selectedPoolCard) return alert("No card selected in the pool.");

  const audio = new Audio("./Sound-Effects/Dismantle.wav");
  audio.volume = 0.1;
  audio.play().catch(err => console.warn("Dismantle sound failed:", err));

  selectedPoolCard.el.remove();
  selectedPoolCard = null;
});

moveDropdown.addEventListener('change', () => {
  if (!selectedPoolCard) return alert("No card selected to move.");

  const newRarity = moveDropdown.value;
  const oldEl = selectedPoolCard.el;

  // Remove from current grid
  oldEl.remove();

  // Append to new rarity grid
  rarityGrids[newRarity].appendChild(oldEl);

  // Update selected card reference
  selectedPoolCard = { el: oldEl, rarity: newRarity };

  // Clear selection in dropdown
  moveDropdown.value = "Move to...";
});

function addCardToPool(card, rarity = "Common") {
  const grid = rarityGrids[rarity];

const cardEl = document.createElement('img');
cardEl.src = card.image_url;
cardEl.alt = card.name;
cardEl.title = card.name;
cardEl.classList.add('card-fade'); // 🟨 Start invisible

cardEl.onload = () => {
  cardEl.classList.add('visible'); // 🟩 Fade in when fully loaded
};

  // Make it draggable within pool
  cardEl.setAttribute('draggable', 'true');

  cardEl.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(card));
    e.dataTransfer.setData('from-rarity', rarity);
  });

  // Click = select it
  cardEl.addEventListener('click', () => {
    document.querySelectorAll('.rarity-grid img').forEach(img => img.classList.remove('selected'));
    cardEl.classList.add('selected');
    selectedPoolCard = { el: cardEl, rarity };
    previewImg.src = card.image_url;
  playCardSelectSound();
  });

  grid.appendChild(cardEl);
}

async function savePool() {
  playButtonPressSound();
  if (!currentPoolName) return alert("No pool loaded. Use Save As instead.");

  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const docRef = doc(db, "pools", user.uid, "userPools", currentPoolName);
  const data = {
    name: currentPoolName,
    pool: getCurrentPoolData(),
    updatedAt: new Date()
  };

  await setDoc(docRef, data);
  alert(`Saved pool "${currentPoolName}"`);
}

async function savePoolAs() {
  playButtonPressSound();
  const name = prompt("Enter a new name for this pool:");
  if (!name) return;

  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const docRef = doc(db, "pools", user.uid, "userPools", name);
  const data = {
    name,
    pool: getCurrentPoolData(),
    createdAt: new Date()
  };

  await setDoc(docRef, data);
  setCurrentPoolName(name);
  alert(`Saved pool as "${name}"`);
}

async function loadPool() {
    playButtonPressSound();
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const snapshot = await getDocs(collection(db, "pools", user.uid, "userPools"));
  const poolNames = snapshot.docs.map(doc => doc.id);
  const name = prompt(`Load which pool?\n${poolNames.join("\n")}`);
  if (!name) return;

  const docRef = doc(db, "pools", user.uid, "userPools", name);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return alert("Pool not found");

  const data = snap.data().pool;

  // Clear current
  Object.values(rarityGrids).forEach(grid => grid.innerHTML = '');

  // Rebuild each grid
  for (const rarity in data) {
    data[rarity].forEach(name => {
      const card = cardData.find(c => c.name === name);
      if (card) addCardToPool(card, rarity);
    });
  }

  setCurrentPoolName(name);
  alert(`Loaded pool "${name}"`);
}

async function copyPool() {
  playButtonPressSound();
  if (!currentPoolName) return alert("No pool loaded.");

  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const newName = prompt("Enter name for the copied pool:");
  if (!newName) return;

  const originalData = getCurrentPoolData();
  await setDoc(doc(db, "pools", user.uid, newName), {
    name: newName,
    pool: originalData,
    createdAt: new Date()
  });

  setCurrentPoolName(newName);
  alert(`Copied current pool as "${newName}"`);
}

function clearPool() {
  playButtonPressSound();
  if (!confirm("Clear all cards from this pool?")) return;

  Object.values(rarityGrids).forEach(grid => grid.innerHTML = '');
  selectedPoolCard = null;
}

async function deletePool() {
    playButtonPressSound();
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const name = prompt("Enter the name of the pool to delete:");
  if (!name) return;

  const confirmDelete = confirm(`Delete pool "${name}"? This cannot be undone.`);
  if (!confirmDelete) return;

  await deleteDoc(doc(db, "pools", user.uid, "userPools", name));

  if (name === currentPoolName) setCurrentPoolName(null);

  alert(`Deleted pool "${name}"`);
}

window.openPoolModal = openPoolModal;
window.savePool = savePool;
window.savePoolAs = savePoolAs;
window.loadPool = loadPool;
window.copyPool = copyPool;
window.clearPool = clearPool;
window.deletePool = deletePool;

function renderCardGrid(cards = cardData) {
  const filtered = applyFilters(cards);
  allowedCardNames = new Set(filtered.map(c => c.name)); // 🔥 Set allowed names

  const totalPages = Math.ceil(filtered.length / cardsPerPage);
  currentPage = Math.min(currentPage, totalPages || 1);
  const start = (currentPage - 1) * cardsPerPage;
  const end = start + cardsPerPage;
  const pageCards = filtered.slice(start, end);

  cardGrid.innerHTML = '';
  pageCards.forEach(card => {
    const cardImg = document.createElement('img');
    cardImg.src = card.image_url;
    cardImg.alt = card.name;
    cardImg.title = card.name;
    cardImg.classList.add('card-fade');

    cardImg.onload = () => cardImg.classList.add('visible');
    if (cardImg.complete) cardImg.classList.add('visible');

    cardImg.addEventListener('click', () => {
      selectedCard = card;
      previewImg.style.opacity = 0;
      previewImg.onload = () => (previewImg.style.opacity = 1);
      previewImg.src = card.image_url;
      playCardSelectSound();
    });

    cardImg.setAttribute('draggable', 'true');
    cardImg.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify(card));
    });

    cardGrid.appendChild(cardImg);
  });

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;

  // 🟡 NEW: Filter rarity grid after rendering
  filterRarityGrids();
}

function filterRarityGrids() {
  Object.values(rarityGrids).forEach(grid => {
    grid.querySelectorAll("img").forEach(img => {
      const isVisible = allowedCardNames.has(img.alt);
      img.style.display = isVisible ? "inline-block" : "none";
    });
  });
}

prevPageBtn.addEventListener('click', () => {
    playButtonPressSound();
  if (currentPage > 1) {
    currentPage--;
    renderCardGrid(cardData);
  }
});

nextPageBtn.addEventListener('click', () => {
    playButtonPressSound();
  const totalPages = Math.ceil(cardData.length / cardsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderCardGrid(cardData);
  }
});

// Toggle dropdown on button click
document.querySelectorAll('.dropdown-toggle').forEach(button => {
  button.addEventListener('click', e => {
    const dropdown = button.parentElement;
    const isActive = dropdown.classList.contains('active');

    // 🔊 Play sound effect
    const audio = new Audio("./Sound-Effects/Button-Press.wav");
    audio.volume = 0.1;
    audio.play().catch(err => console.warn("Sound failed:", err));

    // Close all dropdowns first
    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));

    // Re-open this one if it wasn't already active
    if (!isActive) dropdown.classList.add('active');

    e.stopPropagation();
  });
});

// Prevent clicks inside dropdown from closing it
document.querySelectorAll('.dropdown-content').forEach(content => {
  content.addEventListener('click', e => {
    e.stopPropagation();
  });
});

// Close dropdowns when clicking elsewhere
document.addEventListener('click', () => {
  document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
});

const modal = document.getElementById("pool-modal");
const poolList = document.getElementById("pool-list");
const modalTitle = document.getElementById("modal-title");
document.getElementById("close-modal").addEventListener("click", () => {
  const audio = new Audio("./Sound-Effects/Button-Exit.wav");
  audio.volume = 0.1;
  audio.play().catch(err => console.warn("Exit sound failed:", err));
  modal.classList.add("hidden");
});

async function openPoolModal(actionType) {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  modalTitle.textContent = actionType === "load" ? "Load Pool" : "Delete Pool";
  poolList.innerHTML = "";

  const snapshot = await getDocs(collection(db, "pools", user.uid, "userPools"));
  const poolNames = snapshot.docs.map(doc => doc.id);

  // 🔹 Add "Empty Pool" option at the top if loading
  if (actionType === "load") {
    const li = document.createElement("li");
    li.textContent = "Empty Pool";
    li.classList.add("special-option");
    li.addEventListener("click", () => {
playButtonPressSound();
      Object.values(rarityGrids).forEach(grid => (grid.innerHTML = ""));
      selectedPoolCard = null;
      setCurrentPoolName(null);
      modal.classList.add("hidden");
    });
    poolList.appendChild(li);
  }

  poolNames.forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", () => {
    playButtonPressSound();
      modal.classList.add("hidden");
      if (actionType === "load") loadPoolByName(name);
      else deletePoolByName(name);
    });
    poolList.appendChild(li);
  });

  modal.classList.remove("hidden");
}

async function loadPoolByName(name) {
  const user = auth.currentUser;
  const docRef = doc(db, "pools", user.uid, "userPools", name);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return alert("Pool not found");

  const data = snap.data().pool;
  Object.values(rarityGrids).forEach(grid => (grid.innerHTML = ""));
  for (const rarity in data) {
    data[rarity].forEach(cardName => {
      const card = cardData.find(c => c.name === cardName);
      if (card) addCardToPool(card, rarity);
    });
  }
  setCurrentPoolName(name);
}

async function deletePoolByName(name) {
  const user = auth.currentUser;
  const confirmDelete = confirm(`Delete pool "${name}"?`);
  if (!confirmDelete) return;

  await deleteDoc(doc(db, "pools", user.uid, "userPools", name));
  if (name === currentPoolName) setCurrentPoolName(null);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.body.innerHTML = "<h2>Please log in to access the Admin page.</h2>";
    return;
  }

  const docRef = doc(db, "duelIDs", user.uid);
  const snap = await getDoc(docRef);

  if (!snap.exists() || !snap.data().isAdmin) {
    document.body.innerHTML = "<h2>Access Denied: You are not an Admin.</h2>";
    return;
  }

  // ✅ These DOM elements now exist because the page is fully loaded
  const poolSelector = document.getElementById("pool-select");
  const giveBtn = document.getElementById("give-btn");
  const cardNameInput = document.getElementById("give-card-name");
  const cardQtyInput = document.getElementById("give-card-qty");
  const packQtyInput = document.getElementById("give-pack-qty");

  poolSelector.addEventListener("change", () => {
    selectedPool = poolSelector.value;
  });

giveBtn.addEventListener("click", async () => {
  const audio = new Audio("./Sound-Effects/Craft.wav");
  audio.volume = 0.1;
  audio.play().catch(err => console.warn("Craft sound failed:", err));
    if (!selectedUser) return alert("Select a user first");

    const cardName = cardNameInput.value.trim();
    const cardQty = parseInt(cardQtyInput.value, 10);
    const packQty = parseInt(packQtyInput.value, 10);

    if (!cardName && !selectedPool) return alert("You must select a pool or type a card name.");
    if ((selectedPool && isNaN(packQty)) || (cardName && isNaN(cardQty))) return alert("Enter valid quantities.");

    const userRef = doc(db, "duelIDs", selectedUser);

    // Give packs
    if (selectedPool && !isNaN(packQty)) {
      const packRef = doc(db, "duelIDs", selectedUser, "packs", selectedPool);
      const snap = await getDoc(packRef);
      const existing = snap.exists() ? snap.data().qty : 0;
      await setDoc(packRef, { qty: existing + packQty });
    }

    // Give cards
    if (cardName && !isNaN(cardQty)) {
      const cardRef = doc(db, "duelIDs", selectedUser, "cards", cardName);
      const snap = await getDoc(cardRef);
      const existing = snap.exists() ? snap.data().qty : 0;
      await setDoc(cardRef, {
  qty: existing + cardQty,
  obtained: new Date().toISOString()
});
    }

    alert("Given successfully!");
  });

  const closeUserModalBtn = document.getElementById("close-user-modal");
const selectUserBtn = document.getElementById("select-user-btn");
selectUserBtn.addEventListener("click", () => {
  playButtonPressSound();
  loadUserList();
});

  userDisplay.addEventListener("click", loadUserList);
closeUserModalBtn.addEventListener("click", () => {
  const audio = new Audio("./Sound-Effects/Button-Exit.wav");
  audio.volume = 0.1;
  audio.play().catch(err => console.warn("Exit sound failed:", err));
  userModal.classList.add("hidden");
});

  async function populatePoolSelector() {
    const poolSnap = await getDocs(collection(db, "pools", user.uid, "userPools"));
    poolSelector.innerHTML = '<option value="">-- None --</option>';
    poolSnap.forEach(doc => {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.id;
      poolSelector.appendChild(option);
    });
  }

  document.getElementById('admin-panel').style.display = 'block';
document.querySelector('button[onclick="openPoolModal(\'load\')"]')
  ?.addEventListener('click', () => playButtonPressSound());

document.querySelector('button[onclick="openPoolModal(\'delete\')"]')
  ?.addEventListener('click', () => playButtonPressSound());
  populatePoolSelector();
});
}

window.setupAdminPage = setupAdminPage;