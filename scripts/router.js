import { bootBackgroundMusic } from './bgm.js';
bootBackgroundMusic(); // Only called once across the app

const buttonSound = new Audio("./Sound-Effects/Button-Press.wav");
buttonSound.volume = 0.1;

function playButtonSound() {
  // Ensure the sound plays from the start
  buttonSound.currentTime = 0;
  buttonSound.play();
}

// Play sound when nav links are clicked
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("nav a").forEach(link => {
    link.addEventListener("click", playButtonSound);
  });
});

const content = document.getElementById("content");
const styleLink = document.getElementById("page-style");

const routes = {
  "home": {
    html: "./pages/Home.html",
    js: "./scripts/Home.js",
    css: "./styles/Home.css"
  },
  "duel-id": {
    html: "./pages/Duel-ID.html",
    js: "./scripts/Duel-ID.js",
    css: "./styles/Duel-ID.css"
  },
  "card-case": {
    html: "./pages/Card-Case.html",
    js: "./scripts/Card-Case.js",
    css: "./styles/Card-Case.css"
  },
  "pack-opener": {
    html: "./pages/Pack-Opener.html",
    js: "./scripts/Pack-Opener.js",
    css: "./styles/Pack-Opener.css"
  },
  "admin": {
    html: "./pages/Admin.html",
    js: "./scripts/Admin.js",
    css: "./styles/Admin.css"
  }
};

async function loadPage(route) {
  const page = routes[route] || routes["home"];

  const existingWrapper = content.querySelector(".page-wrapper");
  if (existingWrapper) {
    existingWrapper.classList.add("transition-out");
    await new Promise(resolve => {
      existingWrapper.addEventListener("animationend", resolve, { once: true });
    });
    existingWrapper.remove();
  }

  const res = await fetch(page.html);
  const html = await res.text();

  const newWrapper = document.createElement("div");
  newWrapper.classList.add("page-wrapper", "transition-in");
  newWrapper.innerHTML = html;
  content.appendChild(newWrapper);

  newWrapper.addEventListener("animationend", () => {
    newWrapper.classList.remove("transition-in");
  }, { once: true });

  styleLink.setAttribute("href", page.css);
console.log("🎨 CSS Loaded:", styleLink.href);

  const oldScript = document.getElementById("page-script");
  if (oldScript) oldScript.remove();

const script = document.createElement("script");
script.type = "module";
script.id = "page-script";
script.src = page.js;

script.onload = async () => {
  const module = await import(script.src); // ✅ Use actual resolved path
  if (route === "admin" && module.setupAdminPage) module.setupAdminPage();
  else if (route === "home" && module.setupHomePage) module.setupHomePage();
  else if (route === "card-case" && module.setupCardCasePage) module.setupCardCasePage();
  else if (route === "pack-opener" && module.setupPackOpenerPage) module.setupPackOpenerPage();
  else if (route === "duel-id" && module.setupDuelIdPage) module.setupDuelIdPage();
};

  document.body.appendChild(script);
}

function getRouteFromHash() {
  return location.hash.replace("#", "").toLowerCase() || "home";
}

window.addEventListener("hashchange", () => {
  loadPage(getRouteFromHash());
});

window.addEventListener("DOMContentLoaded", () => {
  loadPage(getRouteFromHash());
});
