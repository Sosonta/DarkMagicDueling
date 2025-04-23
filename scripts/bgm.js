let bgm;

export function bootBackgroundMusic() {
  if (sessionStorage.getItem("bgmStarted")) {
    startBGM();
    return;
  }

  const handleUserClick = () => {
    sessionStorage.setItem("bgmStarted", "true");
    startBGM();
    document.removeEventListener("click", handleUserClick);
  };

  document.addEventListener("click", handleUserClick);
}

function startBGM() {
  if (bgm) return;

  bgm = document.getElementById("bgm");
  if (!bgm) return console.warn("Missing #bgm audio element.");

  bgm.volume = 0;

  bgm.play().then(() => {
    let vol = 0;
    const target = 0.1;
    const fade = setInterval(() => {
      vol += 0.01;
      bgm.volume = Math.min(vol, target);
      if (vol >= target) clearInterval(fade);
    }, 100);
  }).catch(err => console.warn("Music play failed:", err));
}