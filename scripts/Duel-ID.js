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
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

export function setupDuelIdPage() {

// DOM Elements
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

// Register
registerBtn.addEventListener('click', async () => {
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const username = document.getElementById('register-username').value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "duelIDs", userCred.user.uid), {
      username,
      email,
      createdAt: new Date().toISOString(),
      character: {
        name: "",
        level: 1,
        class: "",
        currentHp: 0,
        inspiration: 0,
        proficiency: 0,
        credits: 0,
        attributes: {},
        features: [],
        inventory: [],
        profileImage: null
      }
    });
    alert("Registration successful!");
  } catch (err) {
    console.error("Registration error:", err);
    alert("Failed to register. See console for details.");
  }
});

// Login
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  await signInWithEmailAndPassword(auth, email, password);
});

function playLoginRevealSound() {
  const audio = new Audio("./Sound-Effects/Reveal-All-Login.wav");
  audio.volume = 0.1;
  audio.play().catch((e) => console.warn("Sound playback failed:", e));
}

const inspirationInput = document.getElementById('inspiration');
const proficiencyInput = document.getElementById('proficiency');
const nameInput = document.getElementById('duelist-name');
const levelInput = document.getElementById('duelist-level');
const classInput = document.getElementById('duelist-class');
const hpInput = document.getElementById('current-hp');

const maxHpSpan = document.getElementById('max-hp');
const currentHpText = document.getElementById('current-hp-text');
const hpFill = document.getElementById('hp-fill');

onAuthStateChanged(auth, async (user) => {
  if (user) {

const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    location.reload();
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

    // DOM references
    // Show content
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
playLoginRevealSound();
    document.getElementById('logout-section').style.display = 'block';
    document.getElementById('duel-id-entry').style.display = 'block';
    document.getElementById('inventory-section').style.display = 'block';

    // Load user stats from Firestore
    async function loadStats() {
      const docRef = doc(db, "duelIDs", user.uid);
      const snap = await getDoc(docRef);
      const data = snap.data();

      const inspiration = data?.character?.inspiration || 0;
      const proficiency = data?.character?.proficiency || 0;
      const name = data?.character?.name || '';
      const level = data?.character?.level || 1;
      const duelistClass = data?.character?.class || '';
      const currentHp = data?.character?.currentHp || 0;
      const credits = data?.character?.credits || 0;
const imageData = data?.character?.profileImage || null;
if (imageData) {
  profileImage.src = imageData;
}

      document.getElementById('duel-credits').value = credits;
      inspirationInput.value = inspiration;
      proficiencyInput.value = proficiency;
      nameInput.value = name;
      levelInput.value = level;
      classInput.value = duelistClass;
      hpInput.value = currentHp;

// Load attributes and skills
const attributes = data?.character?.attributes || {};
Object.entries(attributes).forEach(([attr, attrData]) => {
  const box = document.querySelector(`.attribute-box[data-attr="${attr}"]`);
  if (!box) return;

  const scoreInput = box.querySelector('.attr-score');
  const modSpan = box.querySelector('.attr-mod');

  scoreInput.value = attrData.score;
  modSpan.textContent = (attrData.modifier >= 0 ? '+' : '') + attrData.modifier;

  const checkboxes = box.querySelectorAll('.skill-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = attrData.skills.includes(cb.dataset.skill);
  });
});

      updateHPBar();
    }

    // Call it immediately
    await loadStats();
    await loadInventory();

    // Re-add item buttons
    document.querySelectorAll('.add-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const column = btn.dataset.column;
        createInventoryItem('', 1, column);
        saveInventoryToFirestore();
      });
    });

    // ✅ ADD THIS RIGHT HERE:
    const conBox = document.querySelector('.attribute-box[data-attr="Constitution"]');
    if (conBox) {
      conBox.querySelector('.attr-score').addEventListener('input', updateHPBar);
levelInput.addEventListener('input', updateHPBar);
hpInput.addEventListener('input', updateHPBar);
    }

    // ✅ Feature logic starts here
    const featuresGrid = document.getElementById('features-grid');
    const addFeatureBtn = document.getElementById('add-feature-btn');

nameInput.addEventListener('input', saveStatsToFirestore);
levelInput.addEventListener('input', saveStatsToFirestore);
classInput.addEventListener('input', saveStatsToFirestore);
hpInput.addEventListener('input', saveStatsToFirestore);


// Auto-save on input
inspirationInput.addEventListener('input', saveStatsToFirestore);
proficiencyInput.addEventListener('input', saveStatsToFirestore);
document.getElementById('duel-credits').addEventListener('input', saveStatsToFirestore);

    function createFeatureCard(title = '', description = '') {
      const card = document.createElement('div');
      card.className = 'feature-card';

      const titleInput = document.createElement('input');
      titleInput.className = 'feature-title';
      titleInput.value = title;
      titleInput.placeholder = 'Feature Title';

      const descInput = document.createElement('textarea');
descInput.className = 'feature-description';
descInput.value = description;
descInput.placeholder = 'Feature Description';
descInput.style.resize = 'none'; // Prevent manual resize

descInput.addEventListener('input', () => {
  descInput.style.height = 'auto'; // Reset first
  descInput.style.height = descInput.scrollHeight + 'px'; // Set to fit content
});

document.querySelectorAll('.attr-score').forEach(input => {
  input.addEventListener('input', saveStatsToFirestore);
});

document.querySelectorAll('.skill-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', saveStatsToFirestore);
});
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-feature-btn';
      deleteBtn.onclick = () => card.remove();

  // 🔽 Place this block here
  titleInput.oninput = saveFeaturesToFirestore;
  descInput.oninput = saveFeaturesToFirestore;
  deleteBtn.onclick = () => {
    card.remove();
    saveFeaturesToFirestore();
  };

      card.appendChild(titleInput);
      card.appendChild(descInput);
      card.appendChild(deleteBtn);
      featuresGrid.appendChild(card);
    }

addFeatureBtn.addEventListener('click', () => {
  createFeatureCard();
  saveFeaturesToFirestore();
});


loadFeatures();

// ✅ Inventory logic starts here
function createInventoryItem(name = '', quantity = 1, column = 0) {
  const grid = document.getElementById(`inventory-grid-${column}`);
  const card = document.createElement('div');
  card.className = 'inventory-card';

  const nameInput = document.createElement('input');
  nameInput.className = 'item-name';
  nameInput.placeholder = 'Item Name';
  nameInput.value = name;

  const quantityInput = document.createElement('input');
  quantityInput.className = 'item-quantity';
  quantityInput.type = 'number';
  quantityInput.min = 1;
  quantityInput.value = quantity;

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.onclick = () => {
    card.remove();
    saveInventoryToFirestore();
  };

  nameInput.oninput = saveInventoryToFirestore;
  quantityInput.oninput = saveInventoryToFirestore;

  card.appendChild(nameInput);
  card.appendChild(quantityInput);
  card.appendChild(deleteBtn);
  grid.appendChild(card);
}

async function loadInventory() {
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, "duelIDs", user.uid);
  const snap = await getDoc(docRef);
  const data = snap.data();

  const inventory = data?.character?.inventory || [];

  // Clear previous content
  [0, 1, 2].forEach(i => {
    const grid = document.getElementById(`inventory-grid-${i}`);
    grid.querySelectorAll('.inventory-card').forEach(el => el.remove());
  });

  inventory.forEach(item => {
    const { name, quantity, column } = item;
    createInventoryItem(name, quantity, column || 0);
  });
}

async function saveInventoryToFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  const items = [];

  [0, 1, 2].forEach(i => {
    const cards = document.querySelectorAll(`#inventory-grid-${i} .inventory-card`);
    cards.forEach(card => {
      const name = card.querySelector('.item-name').value;
      const quantity = parseInt(card.querySelector('.item-quantity').value) || 1;
      items.push({ name, quantity, column: i });
    });
  });

  const docRef = doc(db, "duelIDs", user.uid);
  await updateDoc(docRef, {
    "character.inventory": items
  });
}

// ✅ Define these OUTSIDE the click handler
async function loadFeatures() {
  const user = auth.currentUser;
  if (!user) return; // ✅ Prevents breaking if user is null

  const docRef = doc(db, "duelIDs", user.uid);
  const snap = await getDoc(docRef);
  const data = snap.data();

  const features = data?.character?.features || [];
  features.forEach(f => createFeatureCard(f.title, f.description));
}

async function saveFeaturesToFirestore() {
  const user = auth.currentUser;
  if (!user) return; // ✅ Prevents breaking if user is null

  const docRef = doc(db, "duelIDs", user.uid);
  const featureCards = document.querySelectorAll('.feature-card');
  const features = Array.from(featureCards).map(card => {
    const title = card.querySelector('.feature-title').value;
    const description = card.querySelector('.feature-description').value;
    return { title, description };
  });

    await updateDoc(docRef, {
    "character.features": features
  });
} // closes saveFeaturesToFirestore

  } // ✅ Add this — closes onAuthStateChanged
});

async function saveStatsToFirestore() {
  console.log('Saving stats...');
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, "duelIDs", user.uid);
  const inspiration = parseInt(document.getElementById('inspiration').value) || 0;
  const proficiency = parseInt(document.getElementById('proficiency').value) || 0;
  const credits = parseInt(document.getElementById('duel-credits').value) || 0;
  const name = nameInput.value;
  const level = parseInt(levelInput.value) || 1;
  const duelistClass = classInput.value;
  const currentHp = parseInt(hpInput.value) || 0;

  const attributes = {};
  document.querySelectorAll('.attribute-box').forEach(attrBox => {
    const attr = attrBox.dataset.attr;
    const score = parseInt(attrBox.querySelector('.attr-score').value) || 0;
    const mod = getModifier(score);
    const skills = [];

    const checkboxes = attrBox.querySelectorAll('.skill-checkbox');
    console.log(`Attribute: ${attr}`, checkboxes); // Optional debug log

    checkboxes.forEach(cb => {
      if (cb.checked) skills.push(cb.dataset.skill);
    });

    attributes[attr] = {
      score,
      modifier: mod,
      skills
    };
  });

  await updateDoc(docRef, {
    "character.inspiration": inspiration,
    "character.proficiency": proficiency,
  "character.name": name,
  "character.level": level,
  "character.class": duelistClass,
  "character.currentHp": currentHp,
"character.credits": credits,
"character.attributes": attributes
  });
}

// Handle HP bar behavior

function calculateMaxHP() {
  const level = parseInt(levelInput.value || 1);

  // Grab Constitution score from the attribute box
  const conBox = document.querySelector('.attribute-box[data-attr="Constitution"]');
  const conScore = parseInt(conBox.querySelector('.attr-score').value) || 0;

  return (conScore * 3) + (level * 3);
}

function updateHPBar() {
  const maxHp = calculateMaxHP();
  const currentHp = parseInt(hpInput.value || 0);
  maxHpSpan.textContent = maxHp;
  currentHpText.textContent = currentHp;

  const percent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  hpFill.style.width = `${percent}%`;
  hpFill.style.background = percent > 50 ? 'green' : percent > 25 ? 'orange' : 'red';
}

// Handle right-click image upload
const uploadInput = document.getElementById('upload-image');
const profileImage = document.getElementById('profile-image');

profileImage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  uploadInput.click(); // Trigger file picker
});

uploadInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      const imageData = e.target.result;
      profileImage.src = imageData;

      // ✅ Save to Firestore
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "duelIDs", user.uid);
        await updateDoc(docRef, {
          "character.profileImage": imageData
        });
      }
    };
    reader.readAsDataURL(file);
  }
});

function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

document.querySelectorAll('.attr-score').forEach(input => {
  input.addEventListener('input', () => {
    const score = parseInt(input.value);
    const modSpan = input.nextElementSibling;
    if (!isNaN(score)) {
      const mod = getModifier(score);
      modSpan.textContent = (mod >= 0 ? '+' : '') + mod;
    }
  });

  // Trigger once on load to initialize modifier values
  input.dispatchEvent(new Event('input'));
});
}
window.setupDuelIdPage = setupDuelIdPage;