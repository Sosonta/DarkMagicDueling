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

export function setupPackOpenerPage() {

const packDropdown = document.getElementById("pack-dropdown");
const packQtyInput = document.getElementById("pack-qty");
const openPackBtn = document.getElementById("open-pack-btn");
const cardGrid = document.getElementById("card-grid");
const revealAllBtn = document.getElementById("reveal-all-btn");
const nextPackBtn = document.getElementById("next-pack-btn");
const summaryGrid = document.getElementById("summary-grid");
const rarityPriority = {
  "Secret Rare": 1,
  "Ultra Rare": 2,
  "Super Rare": 3,
  "Rare": 4,
  "Common": 5
};

let selectedPackName = null;
let cardPool = {};
let cardsJson = [];
let packsToOpen = 0;
let currentRevealIndex = 0;
let totalPacksSelected = 0;
let revealedCardImages = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  document.getElementById("pack-opener-panel").style.display = "block";

  const userPacksSnap = await getDocs(collection(db, "duelIDs", user.uid, "packs"));
  userPacksSnap.forEach(doc => {
    const qty = doc.data().qty;
    if (qty > 0) {
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = `${doc.id} (x${qty})`;
      packDropdown.appendChild(option);
    }
  });

  const cardData = await fetch("cards.json").then(res => res.json());
  cardsJson = cardData;
});

function playRandomPackOpenSound() {
  const i = Math.floor(Math.random() * 4) + 1;
  const audio = new Audio(`./Sound-Effects/Open-Pack-0${i}.wav`);
  audio.volume = 0.1;
  audio.play().catch((e) => console.warn("Sound playback failed:", e));
}

function playButtonSound() {
  const audio = new Audio("./Sound-Effects/Button-Press.wav");
  audio.volume = 0.1;
  audio.play().catch((e) => console.warn("Sound playback failed:", e));
}

function playRevealSummarySound() {
  const audio = new Audio("./Sound-Effects/Reveal-All-Login.wav");
  audio.volume = 0.1;
  audio.play().catch((e) => console.warn("Sound playback failed:", e));
}

function allCardsRevealed() {
  const slots = document.querySelectorAll(".card-slot");
  return [...slots].every(slot => slot.classList.contains("revealed"));
}

packDropdown.addEventListener("change", () => {
  selectedPackName = packDropdown.value;

  const selectedOption = packDropdown.selectedOptions[0];
  const match = selectedOption.textContent.match(/\(x(\d+)\)/);
  const maxQty = match ? parseInt(match[1]) : 1;

  packQtyInput.max = maxQty;
  if (parseInt(packQtyInput.value) > maxQty) {
    packQtyInput.value = maxQty;
  }
});

openPackBtn.addEventListener("click", async () => {
playButtonSound();
  const user = auth.currentUser;
  if (!user || !selectedPackName) return;

  summaryGrid.innerHTML = ""; // ✅ Reset on new pack opening

  const packQty = parseInt(packQtyInput.value);
  if (isNaN(packQty) || packQty < 1) return;

  const poolDoc = await getDoc(doc(db, "pools", user.uid, "userPools", selectedPackName));
  if (!poolDoc.exists()) return alert("Pool not found.");

  cardPool = poolDoc.data().pool;
packsToOpen = packQty;
totalPacksSelected = packQty;
  currentRevealIndex = 0;

revealedCardImages = []; // ✅ Reset when opening a new batch
summaryGrid.innerHTML = "";

  openNextPack(user);
});

async function openNextPack(user) {
  const selectedCards = generatePack(cardPool);

document.querySelectorAll('.card-slot.fanning').forEach(slot => {
  slot.classList.remove('fanning');
});

  // Save cards immediately
  selectedCards.forEach(async card => {
    const ref = doc(db, "duelIDs", user.uid, "cards", card.name);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data().qty : 0;
    await setDoc(ref, {
      qty: existing + 1,
      obtained: new Date().toISOString(),
    });

  });

  // Safely decrement pack count by 1
  const packRef = doc(db, "duelIDs", user.uid, "packs", selectedPackName);
  const packSnap = await getDoc(packRef);
  const currentQty = packSnap.exists() ? packSnap.data().qty : 0;
  await updateDoc(packRef, { qty: Math.max(currentQty - 1, 0) });

// 🔄 Update dropdown label
const packOption = [...packDropdown.options].find(opt => opt.value === selectedPackName);
if (packOption) {
  packOption.textContent = `${selectedPackName} (x${Math.max(currentQty - 1, 0)})`;
}


  packsToOpen--;

const current = totalPacksSelected - packsToOpen;
const progressText = `Opening Pack ${current} of ${totalPacksSelected}`;
  const progressEl = document.getElementById("pack-progress");
  progressEl.textContent = progressText;
  progressEl.style.display = "block";

  // Populate grid with card backs
if (packsToOpen === totalPacksSelected) {
  summaryGrid.innerHTML = "";
}
  cardGrid.innerHTML = "";

  // First row: 4 cards
  const topRow = document.createElement("div");
  topRow.classList.add("card-row");
for (let i = 0; i < 4; i++) {
  const slot = createCardSlot(selectedCards[i]);
  slot.classList.add('fanning');
  slot.style.animationDelay = `${i * 0.1}s`;

  slot.addEventListener('animationstart', () => {
    playRandomPackOpenSound();
  }, { once: true });

  topRow.appendChild(slot);
}
  cardGrid.appendChild(topRow);

  // Second row: 5 cards
  const bottomRow = document.createElement("div");
  bottomRow.classList.add("card-row");
for (let i = 4; i < 9; i++) {
  const slot = createCardSlot(selectedCards[i]);
  slot.classList.add('fanning');
  slot.style.animationDelay = `${(i - 4) * 0.1 + 0.4}s`;

  slot.addEventListener('animationstart', () => {
    playRandomPackOpenSound();
  }, { once: true });

  bottomRow.appendChild(slot);
}
  cardGrid.appendChild(bottomRow);

  openPackBtn.disabled = true;
  revealAllBtn.disabled = false;
  nextPackBtn.disabled = true;
}

function createCardSlot(card) {
  const slot = document.createElement("div");
  slot.classList.add("card-slot");

  const inner = document.createElement("div");
  inner.classList.add("card-inner");

  const front = document.createElement("div");
  front.classList.add("card-face", "front");
  front.style.backgroundImage = "url('Card-Back.jpg')";

  const back = document.createElement("div");
  back.classList.add("card-face", "back");
  back.style.backgroundImage = `url(${card.image_url})`;

  inner.appendChild(front);
  inner.appendChild(back);
  slot.appendChild(inner);

slot.addEventListener("click", () => {
  if (!slot.classList.contains("revealed")) {
    slot.classList.add("revealed");
    revealedCardImages.push(card.image_url);

    if (allCardsRevealed()) {
      revealAllBtn.disabled = true;

      if (packsToOpen > 0) {
        nextPackBtn.disabled = false;
      } else {
        openPackBtn.disabled = false;

        // ✅ Only show summary now
        addToSummaryGrid();
      }
    }
  }
});

  return slot;
}

revealAllBtn.addEventListener("click", () => {
playButtonSound();
document.querySelectorAll(".card-slot").forEach((slot) => {
  if (!slot.classList.contains("revealed")) {
    slot.classList.add("revealed");

    const back = slot.querySelector(".card-face.back");
    const imageUrl = back.style.backgroundImage.slice(5, -2); // Remove url("...")

    revealedCardImages.push(imageUrl);
  }
});

  revealAllBtn.disabled = true;

  if (packsToOpen > 0) {
    nextPackBtn.disabled = false;
  } else {
    openPackBtn.disabled = false;
    addToSummaryGrid(); // ✅ Only after last reveal
  }
});

nextPackBtn.addEventListener("click", () => {
playButtonSound();
  const user = auth.currentUser;
  if (!user || packsToOpen < 1) return;
  openNextPack(user);
});

function generatePack(pool) {
  const commons = pool["Common"] || [];
  const rarePool = [
    ...Array(75).fill("Rare"),
    ...Array(16).fill("Super Rare"),
    ...Array(7).fill("Ultra Rare"),
    ...Array(2).fill("Secret Rare")
  ];

  const chosenRarity = rarePool[Math.floor(Math.random() * rarePool.length)];
  const chosen = [];

  for (let i = 0; i < 8; i++) {
    const name = commons[Math.floor(Math.random() * commons.length)];
    const card = cardsJson.find(c => c.name === name);
    if (card) chosen.push(card);
  }

  const rareName = (pool[chosenRarity] || [])[Math.floor(Math.random() * (pool[chosenRarity]?.length || 1))];
  const rareCard = cardsJson.find(c => c.name === rareName);
  if (rareCard) chosen.push(rareCard);

  return chosen;
}

function addToSummaryGrid() {
  playRevealSummarySound();
  // Step 1: Create a rarity map using current cardPool
  const rarityMap = {};
  for (const [rarity, names] of Object.entries(cardPool)) {
    names.forEach(name => {
      rarityMap[name] = rarity;
    });
  }

  // Step 2: Build card objects from image URL + rarity lookup
  const cardsToShow = revealedCardImages.map(imgUrl => {
    const card = cardsJson.find(c => c.image_url === imgUrl);
    const rarity = rarityMap[card?.name] || "Common";
    return {
      name: card?.name || "Unknown",
      image_url: imgUrl,
      rarity,
      rarityIndex: rarityPriority[rarity] || 999
    };
  });

  // Step 3: Sort them by rarity + name
  cardsToShow.sort((a, b) => {
    if (a.rarityIndex !== b.rarityIndex) return a.rarityIndex - b.rarityIndex;
    return a.name.localeCompare(b.name);
  });

  // Step 4: Display
  cardsToShow.forEach(card => {
    const thumb = document.createElement("div");
    thumb.classList.add("summary-card", "fade-in");
    thumb.style.backgroundImage = `url(${card.image_url})`;
    summaryGrid.appendChild(thumb);
  });
}
}

window.setupPackOpenerPage = setupPackOpenerPage;
