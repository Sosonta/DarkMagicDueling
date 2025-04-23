import { app, auth, db } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const soundEffects = {
  "Button-Press.wav": new Audio("./Sound-Effects/Button-Press.wav"),
  "Card-Select.wav": new Audio("./Sound-Effects/Card-Select.wav"),
  "Add-Card.wav": new Audio("./Sound-Effects/Add-Card.wav"),
  "Minus-Card.wav": new Audio("./Sound-Effects/Minus-Card.wav"),
  "Button-Exit.wav": new Audio("./Sound-Effects/Button-Exit.wav")
};

// Set volume for all
Object.values(soundEffects).forEach(audio => audio.volume = 0.1);

function playSoundEffect(filename) {
  const audio = soundEffects[filename];
  if (audio) {
    audio.currentTime = 0; // rewind to start
    audio.play().catch((e) => console.warn("Sound playback failed:", e));
  }
}

let cardData = [];
let selectedCard = null;
const deckLimits = { main: 60, extra: 15, side: 15 };
let deck = { main: [], extra: [], side: [] };
let userCollection = {};
let currentPage = 1;
let sortMode = 'alphabetical';
let currentDeckName = null;
let mainGrid, extraGrid, sideGrid, collectionGrid, previewImg;

const filterState = {
  nameIncludes: '', effectIncludes: '',
  atkMin: null, atkMax: null, defMin: null, defMax: null,
  types: new Set(), races: new Set(), attributes: new Set(), levels: new Set()
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

function attachFilterListeners() {
  document.getElementById("name-filter").addEventListener("input", (e) => {
    filterState.nameIncludes = e.target.value.toLowerCase();
    renderCollection(userCollection);
  });

  document.getElementById("effect-filter").addEventListener("input", (e) => {
    filterState.effectIncludes = e.target.value.toLowerCase();
    renderCollection(userCollection);
  });

[
  { id: "atk-min", key: "atkMin" },
  { id: "atk-max", key: "atkMax" },
  { id: "def-min", key: "defMin" },
  { id: "def-max", key: "defMax" }
].forEach(({ id, key }) => {
  document.getElementById(id).addEventListener("input", (e) => {
    const value = parseInt(e.target.value, 10);
    filterState[key] = isNaN(value) ? null : value;
    renderCollection(userCollection);
  });
});
}

function populateDropdownFilters(cardData) {
  const cardTypeSet = new Set();
  const attributeSet = new Set();
  const raceSet = new Set();
  const levelSet = new Set();

  cardData.forEach(card => {
    if (card.type) cardTypeSet.add(card.type);
    if (card.attribute) attributeSet.add(card.attribute);
    if (card.race) raceSet.add(card.race);
    if (card.level) levelSet.add(card.level);
    if (card.linkval) levelSet.add(card.linkval); // Link monsters
  });

  function fillDropdown(set, containerId, stateSet, isGroupedType = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    // 👉 If this is the card type dropdown, insert groupedTypes first
    if (isGroupedType) {
      Object.keys(groupedTypes).forEach(group => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = group;

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) stateSet.add(group);
          else stateSet.delete(group);
          renderCollection(userCollection);
        });

        label.appendChild(checkbox);
        label.append(" " + group);
        container.appendChild(label);
      });

      // Add divider
      const hr = document.createElement("hr");
      hr.style.margin = "6px 0";
      container.appendChild(hr);
    }

    [...set]
  .sort((a, b) => {
    const numA = Number(a), numB = Number(b);
    return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : String(a).localeCompare(String(b));
  })
  .forEach(value => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) stateSet.add(value);
        else stateSet.delete(value);
        renderCollection(userCollection);
      });

      label.appendChild(checkbox);
      label.append(" " + value);
      container.appendChild(label);
    });
  }

  fillDropdown(cardTypeSet, "card-type-filter", filterState.types, true); // 👈 true for grouped
  fillDropdown(attributeSet, "attribute-filter", filterState.attributes);
  fillDropdown(raceSet, "race-filter", filterState.races);
  fillDropdown(levelSet, "level-filter", filterState.levels);
}

  function countZone(list) {
    return list.reduce((sum, c) => sum + c.count, 0);
  }

  function updateDeckNameDisplay() {
    document.getElementById("current-deck-name").textContent = currentDeckName || "Unsaved Deck";
  }

  function addToDeck(zone, card) {
    const cardInfo = cardData.find(c => c.name === card.name);
    if (!cardInfo) return alert("Card data not found.");

    const isExtraDeckCard = /Fusion|Synchro|XYZ|Link/i.test(cardInfo.type);
    const isValidZone = (isExtraDeckCard && (zone === "extra" || zone === "side")) ||
                        (!isExtraDeckCard && (zone === "main" || zone === "side"));
    if (!isValidZone) return alert(`"${card.name}" cannot be added to the ${zone} deck.`);

    const totalCopies = deck.main.concat(deck.extra, deck.side)
      .filter(c => c.name === card.name)
      .reduce((sum, c) => sum + c.count, 0);
    if (totalCopies >= 3) return alert("You can’t have more than 3 copies total in your deck.");
    if (totalCopies >= userCollection[card.name]?.qty) return alert("You don’t own enough copies of this card.");

    const zoneList = deck[zone];
    const zoneCount = zoneList.reduce((sum, c) => sum + c.count, 0);
    if (zoneCount >= deckLimits[zone]) return alert(`${zone} deck is full.`);

    const existing = zoneList.find(c => c.name === card.name);
    existing ? existing.count++ : zoneList.push({ name: card.name, image_url: card.image_url, count: 1 });
    renderDeck();
  }

  function renderDeckZone(grid, list, zone) {
    grid.innerHTML = "";
    list.forEach(card => {
      for (let i = 0; i < card.count; i++) {
        const el = document.createElement("img");
        el.src = card.image_url;
        el.alt = card.name;
        el.title = `${card.name} (x1)`;
        el.setAttribute("draggable", "true");
        el.addEventListener("dragstart", e => {
          e.dataTransfer.setData("text/plain", JSON.stringify({ name: card.name, image_url: card.image_url, fromZone: zone }));
        });
        el.addEventListener("click", () => {
          previewImg.style.opacity = 0;
          previewImg.onload = () => previewImg.style.opacity = 1;
          previewImg.src = card.image_url;
          selectedCard = card;
          playSoundEffect("Card-Select.wav");
          document.getElementById("card-qty-display").textContent = `x${userCollection[card.name]?.qty || 0}`;
          document.getElementById("card-controls").style.display = "flex";
        });
        el.addEventListener("contextmenu", e => {
          e.preventDefault();
          const zoneList = deck[zone];
          const index = zoneList.findIndex(c => c.name === card.name);
          if (index > -1) {
            if (zoneList[index].count > 1) zoneList[index].count--;
            else zoneList.splice(index, 1);
            playSoundEffect("Minus-Card.wav");
            renderDeck();
          }
        });
        grid.appendChild(el);
      }
    });
  }

  function renderDeck() {
    renderDeckZone(mainGrid, deck.main, "main");
    renderDeckZone(extraGrid, deck.extra, "extra");
    renderDeckZone(sideGrid, deck.side, "side");
    document.querySelector('#main-deck h2').textContent = `Main Deck (${countZone(deck.main)}/60)`;
    document.querySelector('#extra-deck h2').textContent = `Extra Deck (${countZone(deck.extra)}/15)`;
    document.querySelector('#side-deck h2').textContent = `Side Deck (${countZone(deck.side)}/15)`;
  }

async function openDeckModal(mode) {
  const user = auth.currentUser;
  if (!user) return alert("Not logged in");

  const deckModal = document.getElementById("deck-modal");
  const deckList = document.getElementById("deck-list");
  const deckModalTitle = document.getElementById("deck-modal-title");

  const snap = await getDocs(collection(db, "duelIDs", user.uid, "decks"));
  const deckNames = snap.docs.map(doc => doc.id);

  // Set title
  deckModalTitle.textContent = {
    load: "Load a Deck",
    copy: "Copy a Deck",
    delete: "Delete a Deck"
  }[mode];

  // Clear previous list
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

    if (filterState.types.size) {
  const typeMatch = [...filterState.types].some(type =>
    type === card.type || (groupedTypes[type] && groupedTypes[type](card.type))
  );
  if (!typeMatch) return false;
}
    if (filterState.races.size && !filterState.races.has(card.race)) return false;
    if (filterState.attributes.size && !filterState.attributes.has(card.attribute)) return false;
    if (filterState.levels.size && !filterState.levels.has(level) && !filterState.levels.has(link)) return false;

    return true;
  });
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
      return bDate - aDate;
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

    img.onload = () => cardEl.classList.add("visible");

    img.addEventListener("click", () => {
      previewImg.style.opacity = 0;
      previewImg.onload = () => previewImg.style.opacity = 1;
      previewImg.src = card.image_url;

      selectedCard = card;
      playSoundEffect("Card-Select.wav");
      document.getElementById("card-qty-display").textContent = `x${userCollection[card.name]?.qty || 0}`;
      document.getElementById("card-controls").style.display = "flex";
    });

    img.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const isExtra = /(Fusion|Synchro|XYZ|Link)/i.test(card.type);
      const validZones = isExtra ? ["extra", "side"] : ["main", "side"];

      for (const zone of validZones) {
        const count = deck[zone].reduce((sum, c) => sum + (c.name === card.name ? c.count : 0), 0);
        if (count < 3 && deck[zone].length < deckLimits[zone]) {
          addToDeck(zone, { name: card.name, image_url: card.image_url });
          playSoundEffect("Add-Card.wav");
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
}

  document.body.addEventListener("dragover", e => e.preventDefault());
  document.body.addEventListener("drop", e => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const card = JSON.parse(data);
    const from = card.fromZone;
    if (!from) return;
    const zoneList = deck[from];
    const index = zoneList.findIndex(c => c.name === card.name);
    if (index > -1) {
      if (zoneList[index].count > 1) zoneList[index].count--;
      else zoneList.splice(index, 1);
      renderDeck();
    }
  });

// 🧠 Reinitialize listeners and data when this page loads via router
export async function setupCardCasePage() {
  console.log("✅ setupCardCasePage called");

mainGrid = document.querySelector('[data-zone="main"]');
extraGrid = document.querySelector('[data-zone="extra"]');
sideGrid = document.querySelector('[data-zone="side"]');
collectionGrid = document.getElementById('collection-grid');
previewImg = document.getElementById('card-preview-img');

  [mainGrid, extraGrid, sideGrid].forEach(grid => {
    const zone = grid.dataset.zone;
    grid.addEventListener("dragover", e => e.preventDefault());
    grid.addEventListener("drop", e => {
      e.preventDefault();
      const card = JSON.parse(e.dataTransfer.getData("text/plain"));
      addToDeck(zone, card);
    });
  });

document.getElementById("load-deck")?.addEventListener("click", () => {
  playSoundEffect("Button-Press.wav");
  openDeckModal("load");
});

document.getElementById("copy-deck")?.addEventListener("click", () => {
  playSoundEffect("Button-Press.wav");
  openDeckModal("copy");
});

document.getElementById("delete-deck")?.addEventListener("click", () => {
  playSoundEffect("Button-Press.wav");
  openDeckModal("delete");
});

document.getElementById("save-deck")?.addEventListener("click", async () => {
  playSoundEffect("Button-Press.wav");
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

document.getElementById("save-deck-as")?.addEventListener("click", async () => {
  playSoundEffect("Button-Press.wav");
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

document.getElementById("delete-amount-confirm")?.addEventListener("click", async () => {
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
  document.getElementById("delete-prompt-modal").style.display = "none";
});

document.getElementById("delete-amount-all")?.addEventListener("click", async () => {
  if (!selectedCard) return;
  const cardName = selectedCard.name;
  const user = auth.currentUser;
  if (!user) return;

  const cardRef = doc(db, "duelIDs", user.uid, "cards", cardName);
  await deleteDoc(cardRef);
  delete userCollection[cardName];

  renderCollection(userCollection);
  renderDeck();
  document.getElementById("delete-prompt-modal").style.display = "none";
});

document.getElementById("delete-collection-btn")?.addEventListener("click", async () => {
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
  userCollection = {};
  renderCollection(userCollection);
  renderDeck();
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

  console.log("✅ setupCardCasePage called");

document.getElementById("clear-filters")?.addEventListener("click", () => {
  playSoundEffect("Button-Press.wav");
});

document.querySelectorAll(".dropdown-toggle").forEach(button => {
  button.addEventListener("click", () => {
    playSoundEffect("Button-Press.wav");
  });
});

document.querySelectorAll('.dropdown-toggle').forEach(button => {
  button.addEventListener('click', e => {
    const dropdown = button.parentElement;
    const isActive = dropdown.classList.contains('active');

    // Close all dropdowns first
    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));

    // Only play sound if it's about to open
    if (!isActive) {
      dropdown.classList.add('active');
      playSoundEffect("Button-Press.wav");
    }

    e.stopPropagation();
  });
});

  document.querySelectorAll('.dropdown-content').forEach(content => {
    content.addEventListener('click', e => e.stopPropagation());
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
  });

  // 🧠 Fetch user and collection
  onAuthStateChanged(auth, async (user) => {
    if (!user) return alert("You must be logged in to view your collection.");

    const snapshot = await getDocs(collection(db, "duelIDs", user.uid, "cards"));
    userCollection = {};
    snapshot.forEach(docSnap => {
      userCollection[docSnap.id] = docSnap.data();
    });

    const res = await fetch("cards.json");
    cardData = (await res.json()).filter(c => c.type !== "Skill Card");
    cardData.sort((a, b) => a.name.localeCompare(b.name));
    cardData.forEach(card => {
      if (userCollection[card.name]) {
        userCollection[card.name].image_url = card.image_url;
      }
    });

    populateDropdownFilters(cardData);
    attachFilterListeners();
    renderCollection(userCollection);
    renderDeck();
  });

  // 🟩 Reattach +1/-1 buttons
  document.getElementById("add-one-btn")?.addEventListener("click", () => {
    if (!selectedCard) return;
    const { name, image_url } = selectedCard;
    const isExtra = /(Fusion|Synchro|XYZ|Link)/i.test(selectedCard.type);
    const validZones = isExtra ? ["extra", "side"] : ["main", "side"];

    for (const zone of validZones) {
      const count = deck[zone].reduce((sum, c) => sum + (c.name === name ? c.count : 0), 0);
      if (count < 3 && deck[zone].length < deckLimits[zone]) {
        addToDeck(zone, { name, image_url });
        playSoundEffect("Add-Card.wav");
        break;
      }
    }
    renderDeck();
  });

  document.getElementById("remove-one-btn")?.addEventListener("click", () => {
    if (!selectedCard) return;
    for (const zone of ["main", "extra", "side"]) {
      const index = deck[zone].findIndex(c => c.name === selectedCard.name);
      if (index > -1) {
        if (deck[zone][index].count > 1) {
          deck[zone][index].count--;
        } else {
          deck[zone].splice(index, 1);
        }
        playSoundEffect("Minus-Card.wav");
        break;
      }
    }
    renderDeck();
  });

  // 🎛️ Settings modal and sort buttons
  document.getElementById("deck-settings-btn")?.addEventListener("click", () => {
    playSoundEffect("Button-Press.wav");
    document.getElementById("settings-modal").style.display = "flex";
  });

  document.getElementById("close-settings-btn")?.addEventListener("click", () => {
    playSoundEffect("Button-Exit.wav");
    document.getElementById("settings-modal").style.display = "none";
  });

  document.getElementById("sort-recent-btn")?.addEventListener("click", () => {
    sortMode = 'recent';
    renderCollection(userCollection);
    playSoundEffect("Button-Press.wav");
  });

  document.getElementById("sort-alpha-btn")?.addEventListener("click", () => {
    sortMode = 'alphabetical';
    renderCollection(userCollection);
    playSoundEffect("Button-Press.wav");
  });

  // 🧹 Delete modal logic
  document.getElementById("delete-selected-btn")?.addEventListener("click", () => {
    playSoundEffect("Button-Press.wav");
    document.getElementById("settings-modal").style.display = "none";
    document.getElementById("delete-prompt-modal").style.display = "flex";
  });

  document.getElementById("delete-amount-cancel")?.addEventListener("click", () => {
    document.getElementById("delete-prompt-modal").style.display = "none";
  });

  document.getElementById("close-deck-modal")?.addEventListener("click", () => {
    playSoundEffect("Button-Exit.wav");
    document.getElementById("deck-modal").style.display = "none";
  });
}