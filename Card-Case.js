// Card-Case.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Firebase setup
const firebaseConfig = { /* your config */ };
import { auth, db } from "./firebase.js";

// DOM elements
const mainGrid = document.querySelector('[data-zone="main"]');
const extraGrid = document.querySelector('[data-zone="extra"]');
const sideGrid = document.querySelector('[data-zone="side"]');
const collectionGrid = document.getElementById('collection-grid');
const previewImg = document.getElementById('card-preview-img');

let cardData = [];
let selectedCard = null;
const deckLimits = { main: 60, extra: 15, side: 15 };
let deck = { main: [], extra: [], side: [] }; // each holds { name, image_url, count }
let userCollection = {}; // { cardName: { image_url, qty } }
let currentPage = 1;
let sortMode = 'alphabetical'; // or 'recent'
let currentDeckName = null; // null means "Unsaved Deck"

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

fetch('cards.json')
  .then(res => res.json())
  .then(cards => {
    cards = cards.filter(c => c.type !== "Skill Card");
    cardData = cards.sort((a, b) => a.name.localeCompare(b.name));
    populateDropdownFilters(cards);
    attachFilterListeners();
    renderCollection(userCollection);
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
      renderCollection(userCollection);
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
        renderCollection(userCollection);
      });
    }
  });

  document.getElementById('name-filter')?.addEventListener('input', e => {
    filterState.nameIncludes = e.target.value.toLowerCase();
    currentPage = 1;
    renderCollection(userCollection);
  });

  document.getElementById('effect-filter')?.addEventListener('input', e => {
    filterState.effectIncludes = e.target.value.toLowerCase();
    currentPage = 1;
    renderCollection(userCollection);
  });

  document.getElementById('clear-filters')?.addEventListener('click', () => {
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
    renderCollection(userCollection);
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

async function fetchCollection(user) {
  const colRef = collection(db, "duelIDs", user.uid, "cards");
  const snapshot = await getDocs(colRef);
  const ownedCards = {};

  snapshot.forEach(doc => {
    ownedCards[doc.id] = doc.data().qty;
  });

  return ownedCards;
}

function renderCollection(ownedCards) {
  const collectionGrid = document.getElementById("collection-grid");
  collectionGrid.innerHTML = "";

  let cardsToShow = cardData.filter(card => ownedCards[card.name]);

  // 🔀 Apply sorting
  if (sortMode === 'recent') {
cardsToShow.sort((a, b) => {
  const aDateRaw = ownedCards[a.name]?.obtained;
  const bDateRaw = ownedCards[b.name]?.obtained;

  const aDate = aDateRaw ? new Date(aDateRaw).getTime() : 0;
  const bDate = bDateRaw ? new Date(bDateRaw).getTime() : 0;

  return bDate - aDate; // Most recent first
});
  } else {
    cardsToShow.sort((a, b) => a.name.localeCompare(b.name));
  }

  const filteredCards = applyFilters(cardsToShow);

  filteredCards.forEach(card => {
    const qty = ownedCards[card.name]?.qty || 0;

    const cardEl = document.createElement("div");
    cardEl.classList.add("collection-card");

    const img = document.createElement("img");
    img.src = card.image_url;
    img.alt = card.name;
    img.title = `${card.name} (x${qty})`;

img.addEventListener("click", () => {
  previewImg.style.opacity = 0;
  previewImg.onload = () => previewImg.style.opacity = 1;
  previewImg.src = card.image_url;

  selectedCard = card;

  const qtyDisplay = document.getElementById("card-qty-display");
  qtyDisplay.textContent = `x${userCollection[card.name]?.qty || 0}`;

  const controls = document.getElementById("card-controls");
  controls.style.display = "flex"; // Show the controls
});

img.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const isExtra = /(Fusion|Synchro|XYZ|Link)/i.test(card.type);
  const validZones = isExtra ? ["extra", "side"] : ["main", "side"];

  for (const zone of validZones) {
    const count = deck[zone].reduce((sum, c) => sum + (c.name === card.name ? c.count : 0), 0);
    if (count < 3 && deck[zone].length < deckLimits[zone]) {
      addToDeck(zone, { name: card.name, image_url: card.image_url });
      renderDeck();
      break;
    }
  }
});

    img.setAttribute("draggable", "true");
    img.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({
        name: card.name,
        image_url: card.image_url
      }));
    });

    cardEl.appendChild(img);
    collectionGrid.appendChild(cardEl);
  });

  console.log("Rendering filtered collection:", filteredCards.map(c => c.name));
}

// Load collection from Firestore
onAuthStateChanged(auth, async (user) => {
  if (!user) return alert("You must be logged in to view your collection.");

  const cardsRef = collection(db, "duelIDs", user.uid, "cards");
  const snapshot = await getDocs(cardsRef);
snapshot.forEach(docSnap => {
  const cardName = docSnap.id;
  const data = docSnap.data();
  userCollection[cardName] = {
    qty: data.qty,
    obtained: data.obtained || null // ← include timestamp if available
  };
});

const res = await fetch("cards.json");
cardData = await res.json(); // <— assigns to the global array

  // Add debug logs
  console.log("User Collection:", userCollection);
console.log("All Cards Loaded:", cardData.length);

cardData.forEach(card => {
if (userCollection[card.name]) {
  userCollection[card.name].image_url = card.image_url;
}
});

renderCollection(userCollection);
});

function createCardElement(name, image_url, qty = 1, zone = null) {
  const el = document.createElement("img");
  el.src = image_url;
  el.alt = name;
  el.title = `${name} (${qty})`;

  if (zone) {
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({
        name,
        image_url,
        fromZone: zone
      }));
    });
  }

  return el;
}

// Enable drop zones for decks
[mainGrid, extraGrid, sideGrid].forEach(grid => {
  const zone = grid.dataset.zone;
  grid.addEventListener("dragover", e => e.preventDefault());
  grid.addEventListener("drop", e => {
    e.preventDefault();
    const card = JSON.parse(e.dataTransfer.getData("text/plain"));
    addToDeck(zone, card);
  });
});

function addToDeck(zone, card) {
  const cardInfo = cardData.find(c => c.name === card.name);
  if (!cardInfo) return alert("Card data not found.");

  const isExtraDeckCard = /Fusion|Synchro|XYZ|Link/i.test(cardInfo.type);
  const isValidZone =
    (isExtraDeckCard && (zone === "extra" || zone === "side")) ||
    (!isExtraDeckCard && (zone === "main" || zone === "side"));

  if (!isValidZone) {
    return alert(`"${card.name}" cannot be added to the ${zone} deck.`);
  }

  // ✅ Total copies across all zones
  const totalCopies = deck.main.concat(deck.extra, deck.side)
    .filter(c => c.name === card.name)
    .reduce((sum, c) => sum + c.count, 0);

  if (totalCopies >= 3) return alert("You can’t have more than 3 copies total in your deck.");
  if (totalCopies >= userCollection[card.name]?.qty) return alert("You don’t own enough copies of this card.");

  const zoneList = deck[zone];
  const zoneCount = zoneList.reduce((sum, c) => sum + c.count, 0);
  if (zoneCount >= deckLimits[zone]) return alert(`${zone} deck is full.`);

  const existing = zoneList.find(c => c.name === card.name);
  if (existing) {
    existing.count++;
  } else {
    zoneList.push({ name: card.name, image_url: card.image_url, count: 1 });
  }

  renderDeck();
}

function renderDeck() {
  renderDeckZone(mainGrid, deck.main, "main");
  renderDeckZone(extraGrid, deck.extra, "extra");
  renderDeckZone(sideGrid, deck.side, "side");

  document.querySelector('#main-deck h2').textContent = `Main Deck (${countZone(deck.main)}/60)`;
  document.querySelector('#extra-deck h2').textContent = `Extra Deck (${countZone(deck.extra)}/15)`;
  document.querySelector('#side-deck h2').textContent = `Side Deck (${countZone(deck.side)}/15)`;
}

function renderDeckZone(grid, list, zone) {
  grid.innerHTML = "";
  list.forEach(card => {
    for (let i = 0; i < card.count; i++) {
      const el = createCardElement(card.name, card.image_url, 1, zone);

      el.addEventListener("click", () => {
        previewImg.style.opacity = 0;
        previewImg.onload = () => previewImg.style.opacity = 1;
        previewImg.src = card.image_url;

        selectedCard = card;

        const qtyDisplay = document.getElementById("card-qty-display");
        qtyDisplay.textContent = `x${userCollection[card.name]?.qty || 0}`;
        qtyDisplay.style.display = "block";
      });
el.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const zoneList = deck[zone];
  const index = zoneList.findIndex(c => c.name === card.name);
  if (index > -1) {
    if (zoneList[index].count > 1) {
      zoneList[index].count--;
    } else {
      zoneList.splice(index, 1);
    }
    renderDeck();
  }
});

      grid.appendChild(el);
    }
  });
}

function countZone(list) {
  return list.reduce((sum, c) => sum + c.count, 0);
}

document.body.addEventListener("dragover", (e) => {
  e.preventDefault();
});

document.body.addEventListener("drop", (e) => {
  e.preventDefault();
  const data = e.dataTransfer.getData("text/plain");
  if (!data) return;

  const card = JSON.parse(data);
  const from = card.fromZone;
  if (!from) return; // Do nothing if it's not from a deck zone

  const zoneList = deck[from];
  const cardIndex = zoneList.findIndex(c => c.name === card.name);
  if (cardIndex > -1) {
    if (zoneList[cardIndex].count > 1) {
      zoneList[cardIndex].count--;
    } else {
      zoneList.splice(cardIndex, 1);
    }
    renderDeck();
  }
});

// 🟨 Dropdown button toggle support
document.querySelectorAll('.dropdown-toggle').forEach(button => {
  button.addEventListener('click', e => {
    const dropdown = button.parentElement;
    const isActive = dropdown.classList.contains('active');

    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
    if (!isActive) dropdown.classList.add('active');

    e.stopPropagation();
  });
});

// Prevent inner clicks from closing the dropdown
document.querySelectorAll('.dropdown-content').forEach(content => {
  content.addEventListener('click', e => e.stopPropagation());
});

// Close all dropdowns when clicking anywhere else
document.addEventListener('click', () => {
  document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
});
window.onload = () => {
document.getElementById("add-one-btn").addEventListener("click", () => {
  if (!selectedCard) return;
  const name = selectedCard.name;
  const image_url = selectedCard.image_url;

  // Try to add to main by default, fallback to extra if it's an Extra Deck type
  const isExtra = /(Fusion|Synchro|XYZ|Link)/i.test(selectedCard.type);
  const validZones = isExtra ? ["extra", "side"] : ["main", "side"];

  for (const zone of validZones) {
    const count = deck[zone].reduce((sum, c) => sum + (c.name === name ? c.count : 0), 0);
    if (count < 3 && deck[zone].length < deckLimits[zone]) {
      addToDeck(zone, { name, image_url });
      break;
    }
  }

  renderDeck();
});

const settingsBtn = document.getElementById("deck-settings-btn");
const settingsModal = document.getElementById("settings-modal");
const deletePromptModal = document.getElementById("delete-prompt-modal");

settingsBtn.addEventListener("click", () => {
  settingsModal.style.display = "flex";
});

document.getElementById("close-settings-btn").addEventListener("click", () => {
  settingsModal.style.display = "none";
});

document.getElementById("delete-selected-btn").addEventListener("click", () => {
  settingsModal.style.display = "none";
  deletePromptModal.style.display = "flex";
});

document.getElementById("sort-recent-btn").addEventListener("click", () => {
  sortMode = 'recent';
  renderCollection(userCollection);
});

document.getElementById("sort-alpha-btn").addEventListener("click", () => {
  sortMode = 'alphabetical';
  renderCollection(userCollection);
});

// DELETE LOGIC
document.getElementById("delete-amount-confirm").addEventListener("click", async () => {
  const amount = parseInt(document.getElementById("delete-amount").value, 10);
  if (!selectedCard || isNaN(amount)) return;

  const cardName = selectedCard.name;
  const user = auth.currentUser;
  if (!user) return;

  const cardRef = doc(db, "duelIDs", user.uid, "cards", cardName);
  const currentQty = userCollection[cardName]?.qty || 0;
  const newQty = currentQty - amount;

  if (newQty > 0) {
    await setDoc(cardRef, { qty: newQty }, { merge: true });
    userCollection[cardName].qty = newQty;
  } else {
    await deleteDoc(cardRef);
    delete userCollection[cardName];
  }

  renderCollection(userCollection);
  renderDeck();
  deletePromptModal.style.display = "none";
});

document.getElementById("delete-amount-all").addEventListener("click", async () => {
  if (!selectedCard) return;
  const cardName = selectedCard.name;
  const user = auth.currentUser;
  if (!user) return;

  const cardRef = doc(db, "duelIDs", user.uid, "cards", cardName);
  await deleteDoc(cardRef);
  delete userCollection[cardName];

  renderCollection(userCollection);
  renderDeck();
  deletePromptModal.style.display = "none";
});

document.getElementById("delete-amount-cancel").addEventListener("click", () => {
  deletePromptModal.style.display = "none";
});

document.getElementById("delete-collection-btn").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("You must be logged in.");

  const confirmed = confirm("Are you sure you want to delete your entire collection?");
  if (!confirmed) return;

  const colRef = collection(db, "duelIDs", user.uid, "cards");
  const snapshot = await getDocs(colRef);

  const deletions = [];
  snapshot.forEach(docSnap => {
    deletions.push(deleteDoc(doc(db, "duelIDs", user.uid, "cards", docSnap.id)));
  });

  await Promise.all(deletions);
  userCollection = {}; // clear local copy
  renderCollection(userCollection);
  renderDeck();
});

document.getElementById("save-deck").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const deckData = {
    main: deck.main,
    extra: deck.extra,
    side: deck.side,
    updated: new Date().toISOString()
  };

  if (!currentDeckName) {
    const name = prompt("Name your deck:");
    if (!name) return;
    await setDoc(doc(db, "duelIDs", user.uid, "decks", name), deckData);
    currentDeckName = name;
  } else {
    await setDoc(doc(db, "duelIDs", user.uid, "decks", currentDeckName), deckData);
  }

  updateDeckNameDisplay();
  alert("Deck saved.");
});

document.getElementById("save-deck-as").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const name = prompt("Save deck as:");
  if (!name) return;

  const deckData = {
    main: deck.main,
    extra: deck.extra,
    side: deck.side,
    created: new Date().toISOString()
  };

  await setDoc(doc(db, "duelIDs", user.uid, "decks", name), deckData);
  currentDeckName = name;
  updateDeckNameDisplay();
  alert(`Deck saved as "${name}".`);
});

const deckModal = document.getElementById("deck-modal");
const deckList = document.getElementById("deck-list");
const deckModalTitle = document.getElementById("deck-modal-title");
const closeDeckModal = document.getElementById("close-deck-modal");

closeDeckModal.addEventListener("click", () => {
  deckModal.classList.add("hidden");
});

async function openDeckModal(mode) {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const snap = await getDocs(collection(db, "duelIDs", user.uid, "decks"));
  const deckNames = snap.docs.map(doc => doc.id);

  // Update modal title
  deckModalTitle.textContent = {
    load: "Load a Deck",
    copy: "Copy a Deck",
    delete: "Delete a Deck"
  }[mode];

  deckList.innerHTML = "";

  if (mode === "load") {
    const clear = document.createElement("li");
    clear.textContent = "Clear Deck";
    clear.addEventListener("click", () => {
      deck = { main: [], extra: [], side: [] };
      currentDeckName = null;
      renderDeck();
      updateDeckNameDisplay();
      deckModal.style.display = "none";
    });
    deckList.appendChild(clear);
  }

  deckNames.forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    li.addEventListener("click", async () => {
      deckModal.style.display = "none";

      if (mode === "load") {
        await loadDeckByName(name);
      } else if (mode === "copy") {
        const newName = prompt("Name for the copied deck:");
        if (newName) await copyDeckByName(name, newName);
      } else if (mode === "delete") {
        const confirmDel = confirm(`Are you sure you want to delete "${name}"?`);
        if (confirmDel) await deleteDeckByName(name);
      }
    });
    deckList.appendChild(li);
  });

  deckModal.style.display = "flex";
}

function updateDeckNameDisplay() {
  document.getElementById("current-deck-name").textContent =
    currentDeckName || "Unsaved Deck";
}

async function loadDeckByName(name) {
  const user = auth.currentUser;
  const docRef = doc(db, "duelIDs", user.uid, "decks", name);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return alert("Deck not found");

  const data = snap.data();
  deck = {
    main: data.main || [],
    extra: data.extra || [],
    side: data.side || []
  };
  currentDeckName = name;
  renderDeck();
  updateDeckNameDisplay();
}

async function copyDeckByName(originalName, newName) {
  const user = auth.currentUser;
  const docRef = doc(db, "duelIDs", user.uid, "decks", originalName);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return alert("Deck not found");

  const data = snap.data();
  await setDoc(doc(db, "duelIDs", user.uid, "decks", newName), {
    ...data,
    copiedFrom: originalName,
    created: new Date().toISOString()
  });

  alert(`Copied "${originalName}" to "${newName}"`);
}

async function deleteDeckByName(name) {
  const user = auth.currentUser;
  await deleteDoc(doc(db, "duelIDs", user.uid, "decks", name));
  if (name === currentDeckName) {
    currentDeckName = null;
    updateDeckNameDisplay();
    deck = { main: [], extra: [], side: [] };
    renderDeck();
  }
  alert(`Deleted "${name}"`);
}

document.getElementById("load-deck").addEventListener("click", () => openDeckModal("load"));
document.getElementById("copy-deck").addEventListener("click", () => openDeckModal("copy"));
document.getElementById("delete-deck").addEventListener("click", () => openDeckModal("delete"));

document.getElementById("close-deck-modal").addEventListener("click", () => {
  document.getElementById("deck-modal").style.display = "none";
});

document.getElementById("remove-one-btn").addEventListener("click", () => {
  if (!selectedCard) return;

  for (const zone of ["main", "extra", "side"]) {
    const index = deck[zone].findIndex(c => c.name === selectedCard.name);
    if (index > -1) {
      if (deck[zone][index].count > 1) {
        deck[zone][index].count--;
      } else {
        deck[zone].splice(index, 1);
      }
      break;
    }
  }

  renderDeck();
});
};