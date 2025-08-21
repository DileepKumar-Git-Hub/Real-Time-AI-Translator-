// ---- Helpers ----
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");
const srcSel = $("#srcLang");
const tgtSel = $("#tgtLang");
const srcText = $("#srcText");
const outText = $("#outText");
const badges = $("#badges");

let languages = [];
let recognizing = false;
let recognition = null;

// ---- UI: Populate language selects ----
async function loadLanguages() {
  const res = await fetch("/api/languages");
  const data = await res.json();
  languages = data.languages;

  // Fill "To" select
  tgtSel.innerHTML = "";
  languages.forEach(({ code, name }) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${name} (${code})`;
    // default English
    if (code === "en") opt.selected = true;
    tgtSel.appendChild(opt);
  });

  // Add all languages to "From" (after Auto)
  languages.forEach(({ code, name }) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${name} (${code})`;
    srcSel.appendChild(opt);
  });
}

// ---- Translate call ----
async function doTranslate() {
  const text = srcText.value.trim();
  if (!text) {
    outText.textContent = "";
    badges.innerHTML = "";
    status("Enter text to translate.");
    return;
  }

  status("Translating…");
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source: srcSel.value || "auto",
        target: tgtSel.value
      })
    });
    const data = await res.json();
    if (!data.ok) {
      status(`❌ ${data.error || "Translation failed."}`);
      return;
    }
    outText.textContent = data.translated;
    renderBadges(data);
    status("Done.");
  } catch (e) {
    status("❌ Network error.");
  }
}

function renderBadges({ source, detected_source, target }) {
  const items = [];
  if (detected_source) items.push(badge(`Detected: ${detected_source}`));
  items.push(badge(`From: ${source || "auto"}`));
  items.push(badge(`To: ${target}`));
  badges.innerHTML = items.join("");
}

function badge(txt) {
  return `<span class="badge">${txt}</span>`;
}

function status(msg) {
  statusEl.textContent = msg;
}

// ---- Swap languages ----
$("#btnSwap").addEventListener("click", () => {
  const prevSrc = srcSel.value;
  const prevTgt = tgtSel.value;
  // if source is auto, try to use detected badge value if present
  if (prevSrc === "auto") {
    const det = (statusEl.dataset.detected || "").trim();
  }
  srcSel.value = prevTgt;
  tgtSel.value = prevSrc === "auto" ? tgtSel.value : prevSrc;
});

// ---- Copy / Download ----
$("#btnCopy").addEventListener("click", async () => {
  const txt = outText.textContent.trim();
  if (!txt) return alert("Nothing to copy.");
  try {
    await navigator.clipboard.writeText(txt);
    alert("✅ Copied translation to clipboard.");
  } catch {
    alert("❌ Copy failed.");
  }
});

$("#btnDownload").addEventListener("click", () => {
  const txt = outText.textContent.trim();
  if (!txt) return alert("Nothing to download.");
  const blob = new Blob([txt], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "translation.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 400);
});

// ---- Keyboard shortcut ----
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") doTranslate();
});

// ---- Buttons ----
$("#btnTranslate").addEventListener("click", doTranslate);

// ---- Speech to text (Web Speech API; Chrome) ----
function setupSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $("#btnSpeak").disabled = true;
    $("#btnSpeak").title = "Speech Recognition unsupported in this browser.";
    status("Speech recognition not supported in this browser.");
    return;
  }
  recognition = new SR();
  recognition.lang = "en-US"; // mic language; user can type any language; translation handles source
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => {
    recognizing = true;
    $("#btnSpeak").textContent = "⏹️ Stop";
    status("Listening… speak now.");
  };

  recognition.onerror = (e) => {
    status(`Speech error: ${e.error}`);
  };

  recognition.onend = () => {
    recognizing = false;
    $("#btnSpeak").textContent = "🎙️ Speak";
    status("Stopped listening.");
  };

  recognition.onresult = async (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    // Show interim in input (dim)
    if (interim) {
      status("Transcribing…");
      srcText.value = interim;
    }
    if (final) {
      srcText.value = final;
      await doTranslate();
    }
  };

  $("#btnSpeak").addEventListener("click", () => {
    if (!recognition) return;
    if (recognizing) recognition.stop();
    else recognition.start();
  });
}

// ---- Init ----
(async function init() {
  await loadLanguages();
  setupSpeech();
  status("Ready.");
})();
