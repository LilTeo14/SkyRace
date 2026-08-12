import {
  isSupabaseConfigured,
  loadRemoteData,
  saveRemotePilot,
  saveRemoteRun,
  clearRemoteRuns,
  subscribeToRemoteChanges
} from "./data-service.js";

(function () {
  "use strict";

  const STORAGE_KEY = "skyrace-state-v1";
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("skyrace-live") : null;

  const defaultPilots = [
    { id: "pilot-ms", name: "Matías Silva", drone: "MS-07" },
    { id: "pilot-cr", name: "Camila Rojas", drone: "CR-21" },
    { id: "pilot-tf", name: "Tomás Fuentes", drone: "TF-X1" },
    { id: "pilot-av", name: "Antonia Vega", drone: "AV-14" },
    { id: "pilot-dm", name: "Diego Muñoz", drone: "DM-88" },
    { id: "pilot-sp", name: "Sofía Pérez", drone: "SP-05" }
  ];

  const now = Date.now();
  const defaultRuns = [
    { id: "demo-1", pilotId: "pilot-cr", splits: [8420, 9110, 7780, 9630, 8840], total: 43780, createdAt: now - 12 * 60 * 1000, demo: true },
    { id: "demo-2", pilotId: "pilot-tf", splits: [8610, 9320, 8060, 9470, 8790], total: 44250, createdAt: now - 9 * 60 * 1000, demo: true },
    { id: "demo-3", pilotId: "pilot-av", splits: [8990, 8950, 8320, 9660, 8810], total: 44730, createdAt: now - 6 * 60 * 1000, demo: true },
    { id: "demo-4", pilotId: "pilot-dm", splits: [9170, 9410, 8240, 9780, 8990], total: 45590, createdAt: now - 3 * 60 * 1000, demo: true },
    { id: "demo-5", pilotId: "pilot-sp", splits: [9010, 9630, 8380, 9890, 9210], total: 46120, createdAt: now - 60 * 1000, demo: true }
  ];

  let data = loadData();
  let selectedPilotId = data.pilots[0]?.id || "";
  let timerState = "idle";
  let startMark = 0;
  let elapsed = 0;
  let recordedSplits = [];
  let animationFrame = 0;
  let toastTimeout = 0;
  let remoteRefreshTimeout = 0;

  const elements = {
    tabs: document.querySelectorAll(".view-tab"),
    views: document.querySelectorAll(".view-panel"),
    pilotSelect: document.getElementById("pilot-select"),
    selectedAvatar: document.getElementById("selected-avatar"),
    stopwatch: document.getElementById("stopwatch"),
    timerStatus: document.getElementById("timer-status"),
    currentSection: document.getElementById("current-section"),
    timerHint: document.getElementById("timer-hint"),
    trackProgress: document.getElementById("track-progress"),
    raceAction: document.getElementById("race-action"),
    actionTitle: document.getElementById("action-title"),
    actionSubtitle: document.getElementById("action-subtitle"),
    cancelRun: document.getElementById("cancel-run"),
    leaderboardBody: document.getElementById("leaderboard-body"),
    publicLeaderboardBody: document.getElementById("public-leaderboard-body"),
    podium: document.getElementById("podium"),
    publicPodium: document.getElementById("public-podium"),
    recentList: document.getElementById("recent-list"),
    runCount: document.getElementById("run-count"),
    lastUpdated: document.getElementById("last-updated"),
    publicRunners: document.getElementById("public-runners"),
    publicClock: document.getElementById("public-clock"),
    addPilotButton: document.getElementById("add-pilot-button"),
    pilotDialog: document.getElementById("pilot-dialog"),
    pilotForm: document.getElementById("pilot-form"),
    pilotName: document.getElementById("pilot-name"),
    droneName: document.getElementById("drone-name"),
    exportButton: document.getElementById("export-button"),
    openPublicView: document.getElementById("open-public-view"),
    clearResults: document.getElementById("clear-results"),
    toast: document.getElementById("toast"),
    syncStatus: document.getElementById("sync-status")
  };

  function loadData() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && Array.isArray(stored.pilots) && Array.isArray(stored.runs)) return stored;
    } catch (error) {
      console.warn("No se pudieron leer los datos guardados.", error);
    }
    const initial = { pilots: defaultPilots, runs: defaultRuns };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); } catch (_) {}
    return initial;
  }

  function persist(message) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
    if (channel) channel.postMessage({ type: "refresh", message });
    elements.lastUpdated.textContent = "Actualizado ahora";
  }

  function reportRemoteError(error) {
    console.error(error);
    elements.syncStatus.textContent = "Error de conexión";
    showToast("No se pudo sincronizar con Supabase; revisa la conexión");
  }

  async function refreshFromSupabase() {
    try {
      const remoteData = await loadRemoteData();
      if (!remoteData) return;
      data = remoteData;
      if (!data.pilots.some((pilot) => pilot.id === selectedPilotId)) {
        selectedPilotId = data.pilots[0]?.id || "";
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
      renderAll();
      elements.syncStatus.textContent = "Supabase activo";
      elements.lastUpdated.textContent = "Sincronizado ahora";
    } catch (error) {
      reportRemoteError(error);
    }
  }

  function initializeBackend() {
    if (!isSupabaseConfigured) {
      elements.syncStatus.textContent = "Modo local";
      return;
    }

    elements.syncStatus.textContent = "Conectando…";
    refreshFromSupabase();
    subscribeToRemoteChanges(() => {
      clearTimeout(remoteRefreshTimeout);
      remoteRefreshTimeout = window.setTimeout(refreshFromSupabase, 120);
    });
  }

  function refreshFromStorage() {
    try {
      const next = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!next || !Array.isArray(next.pilots) || !Array.isArray(next.runs)) return;
      data = next;
      if (!data.pilots.some((pilot) => pilot.id === selectedPilotId)) selectedPilotId = data.pilots[0]?.id || "";
      renderAll();
    } catch (_) {}
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function formatTime(milliseconds, precise = true) {
    const safe = Math.max(0, Math.round(milliseconds));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const hundredths = Math.floor((safe % 1000) / 10);
    const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return precise ? `${base}.${String(hundredths).padStart(2, "0")}` : base;
  }

  function stopwatchMarkup(milliseconds) {
    const formatted = formatTime(milliseconds);
    const [base, fraction] = formatted.split(".");
    return `${base}<span>.${fraction}</span>`;
  }

  function getPilot(id) {
    return data.pilots.find((pilot) => pilot.id === id) || { name: "Piloto", drone: "—" };
  }

  function bestRuns() {
    const bestByPilot = new Map();
    data.runs.forEach((run) => {
      const current = bestByPilot.get(run.pilotId);
      if (!current || run.total < current.total) bestByPilot.set(run.pilotId, run);
    });
    return Array.from(bestByPilot.values()).sort((a, b) => a.total - b.total);
  }

  function renderPilotSelect() {
    elements.pilotSelect.innerHTML = data.pilots.map((pilot) => (
      `<option value="${escapeHtml(pilot.id)}">${escapeHtml(pilot.name)} · ${escapeHtml(pilot.drone)}</option>`
    )).join("");
    elements.pilotSelect.value = selectedPilotId;
    const selected = getPilot(selectedPilotId);
    elements.selectedAvatar.textContent = initials(selected.name);
    elements.pilotSelect.disabled = timerState === "running";
  }

  function renderTrack() {
    const activeIndex = timerState === "running" ? recordedSplits.length : timerState === "finished" ? -1 : 0;
    elements.trackProgress.innerHTML = Array.from({ length: 5 }, (_, index) => {
      let stateClass = "";
      if (index < recordedSplits.length || timerState === "finished") stateClass = "complete";
      else if (index === activeIndex) stateClass = "active";
      return `<div class="track-step ${stateClass}"><span class="dot"></span>S${index + 1}</div>`;
    }).join("");
  }

  function renderTimer() {
    const segmentNumber = Math.min(recordedSplits.length + 1, 5);
    elements.stopwatch.innerHTML = stopwatchMarkup(elapsed);
    elements.currentSection.textContent = timerState === "finished" ? "RECORRIDO COMPLETO" : `SECCIÓN ${segmentNumber} / 5`;
    elements.timerStatus.className = `timer-status ${timerState}`;
    elements.raceAction.className = `race-action ${timerState}`;

    if (timerState === "idle") {
      elements.timerStatus.innerHTML = "<i></i> LISTO PARA INICIAR";
      elements.timerHint.textContent = "El cronómetro comenzará con la primera pulsación";
      elements.actionTitle.textContent = "INICIAR CONTRARRELOJ";
      elements.actionSubtitle.textContent = "Pulsa para comenzar";
      elements.cancelRun.disabled = true;
    } else if (timerState === "running") {
      elements.timerStatus.innerHTML = "<i></i> CRONÓMETRO EN MARCHA";
      const previous = recordedSplits.length ? recordedSplits[recordedSplits.length - 1].cumulative : 0;
      elements.timerHint.textContent = recordedSplits.length
        ? `Última sección: ${formatTime(recordedSplits[recordedSplits.length - 1].duration)}`
        : "Piloto en pista · esperando primer paso";
      elements.actionTitle.textContent = recordedSplits.length === 4 ? "FINALIZAR CARRERA" : `MARCAR SECCIÓN ${segmentNumber}`;
      elements.actionSubtitle.textContent = recordedSplits.length === 4 ? "Registra la sección 5 y detiene el tiempo" : `Tiempo parcial: ${formatTime(elapsed - previous)}`;
      elements.cancelRun.disabled = false;
    } else {
      elements.timerStatus.innerHTML = "<i></i> TIEMPO REGISTRADO";
      elements.timerHint.textContent = "El resultado ya está visible en el leaderboard";
      elements.actionTitle.textContent = "PREPARAR SIGUIENTE INTENTO";
      elements.actionSubtitle.textContent = "Reiniciar el cronómetro";
      elements.cancelRun.disabled = true;
    }
    renderTrack();
  }

  function podiumCards(runs) {
    const labels = ["1º LUGAR", "2º LUGAR", "3º LUGAR"];
    return [0, 1, 2].map((index) => {
      const run = runs[index];
      if (!run) return `<article class="podium-card ${index === 0 ? "first" : ""}"><span class="podium-rank">${labels[index]}</span><strong>Por definir</strong><span class="podium-time">--:--.--</span><small>Esperando resultado</small></article>`;
      const pilot = getPilot(run.pilotId);
      const gap = index === 0 ? "Mejor tiempo" : `+${formatTime(run.total - runs[0].total)}`;
      return `<article class="podium-card ${index === 0 ? "first" : ""}"><span class="podium-rank">${labels[index]}</span><strong>${escapeHtml(pilot.name)}</strong><span class="podium-time">${formatTime(run.total)}</span><small>${escapeHtml(pilot.drone)} · ${gap}</small></article>`;
    }).join("");
  }

  function tableRows(runs, publicMode = false) {
    if (!runs.length) return `<tr class="empty-row"><td colspan="8"><strong>Aún no hay tiempos registrados</strong><br>El primer resultado aparecerá aquí automáticamente.</td></tr>`;
    return runs.map((run, index) => {
      const pilot = getPilot(run.pilotId);
      const pilotCell = `<div class="pilot-cell"><span class="avatar">${initials(pilot.name)}</span><div><div class="pilot-name">${escapeHtml(pilot.name)}</div><div class="drone-name">${escapeHtml(pilot.drone)}</div></div></div>`;
      const rankLabel = index === 0 ? "01" : String(index + 1).padStart(2, "0");
      const splits = run.splits.map((split) => `<td>${formatTime(split)}</td>`).join("");
      return `<tr><td class="rank ${index < 3 ? "top" : ""}">${rankLabel}</td><td>${pilotCell}</td>${splits}<td class="total-time ${index === 0 ? "best-time" : ""}">${formatTime(run.total)}</td></tr>`;
    }).join("");
  }

  function renderLeaderboard() {
    const ranked = bestRuns();
    elements.podium.innerHTML = podiumCards(ranked);
    elements.publicPodium.innerHTML = podiumCards(ranked);
    elements.leaderboardBody.innerHTML = tableRows(ranked);
    elements.publicLeaderboardBody.innerHTML = tableRows(ranked, true);
    elements.publicRunners.textContent = `${ranked.length} ${ranked.length === 1 ? "PILOTO CLASIFICADO" : "PILOTOS CLASIFICADOS"}`;
  }

  function renderRecent() {
    const recent = [...data.runs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
    elements.runCount.textContent = `${data.runs.length} ${data.runs.length === 1 ? "intento" : "intentos"}`;
    if (!recent.length) {
      elements.recentList.innerHTML = `<div class="empty-state"><strong>Sin intentos todavía</strong>Completa una carrera para iniciar el registro.</div>`;
      return;
    }
    elements.recentList.innerHTML = recent.map((run) => {
      const pilot = getPilot(run.pilotId);
      const time = new Date(run.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
      return `<article class="recent-run"><span class="avatar">${initials(pilot.name)}</span><div class="recent-run-info"><strong>${escapeHtml(pilot.name)}</strong><small>${escapeHtml(pilot.drone)} · ${time}</small></div><div class="recent-run-time"><strong>${formatTime(run.total)}</strong><small>${run.demo ? "DEMO" : "OFICIAL"}</small></div></article>`;
    }).join("");
  }

  function renderAll() {
    renderPilotSelect();
    renderTimer();
    renderLeaderboard();
    renderRecent();
  }

  function updateFrame() {
    if (timerState !== "running") return;
    elapsed = performance.now() - startMark;
    elements.stopwatch.innerHTML = stopwatchMarkup(elapsed);
    const previous = recordedSplits.length ? recordedSplits[recordedSplits.length - 1].cumulative : 0;
    elements.actionSubtitle.textContent = recordedSplits.length === 4
      ? "Registra la sección 5 y detiene el tiempo"
      : `Tiempo parcial: ${formatTime(elapsed - previous)}`;
    animationFrame = requestAnimationFrame(updateFrame);
  }

  function startRun() {
    if (!selectedPilotId) {
      showToast("Agrega y selecciona un piloto antes de comenzar");
      return;
    }
    timerState = "running";
    elapsed = 0;
    recordedSplits = [];
    startMark = performance.now();
    renderPilotSelect();
    renderTimer();
    animationFrame = requestAnimationFrame(updateFrame);
  }

  function markSection() {
    elapsed = performance.now() - startMark;
    const previousCumulative = recordedSplits.length ? recordedSplits[recordedSplits.length - 1].cumulative : 0;
    recordedSplits.push({ cumulative: elapsed, duration: elapsed - previousCumulative });

    if (recordedSplits.length === 5) finishRun();
    else renderTimer();
  }

  function finishRun() {
    cancelAnimationFrame(animationFrame);
    timerState = "finished";
    const splits = recordedSplits.map((split) => Math.round(split.duration));
    const total = splits.reduce((sum, split) => sum + split, 0);
    elapsed = total;
    const run = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pilotId: selectedPilotId,
      splits,
      total,
      createdAt: Date.now()
    };
    data.runs.push(run);
    persist("Nuevo tiempo registrado");
    if (isSupabaseConfigured) saveRemoteRun(run).catch(reportRemoteError);
    renderAll();
    showToast(`Tiempo oficial: ${formatTime(total)}`);
  }

  function resetTimer() {
    cancelAnimationFrame(animationFrame);
    timerState = "idle";
    elapsed = 0;
    recordedSplits = [];
    renderAll();
  }

  function handleRaceAction() {
    if (timerState === "idle") startRun();
    else if (timerState === "running") markSection();
    else resetTimer();
  }

  function switchView(viewName) {
    elements.tabs.forEach((tab) => {
      const active = tab.dataset.view === viewName;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    elements.views.forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}-view`));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addPilot(event) {
    event.preventDefault();
    const name = elements.pilotName.value.trim();
    const drone = elements.droneName.value.trim().toUpperCase();
    if (!name || !drone) return;
    const pilot = { id: `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, drone };
    data.pilots.push(pilot);
    selectedPilotId = pilot.id;
    persist("Piloto agregado");
    if (isSupabaseConfigured) saveRemotePilot(pilot).catch(reportRemoteError);
    elements.pilotForm.reset();
    elements.pilotDialog.close();
    renderAll();
    showToast(`${name} fue agregado a la parrilla`);
  }

  function exportCsv() {
    const ranked = bestRuns();
    if (!ranked.length) {
      showToast("No hay resultados para exportar");
      return;
    }
    const rows = [["Posición", "Piloto", "Drone", "Sección 1", "Sección 2", "Sección 3", "Sección 4", "Sección 5", "Tiempo total"]];
    ranked.forEach((run, index) => {
      const pilot = getPilot(run.pilotId);
      rows.push([index + 1, pilot.name, pilot.drone, ...run.splits.map((split) => formatTime(split)), formatTime(run.total)]);
    });
    const csv = "\ufeff" + rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `skyrace-resultados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Resultados exportados en CSV");
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimeout = window.setTimeout(() => elements.toast.classList.remove("show"), 2800);
  }

  elements.raceAction.addEventListener("click", handleRaceAction);
  elements.pilotSelect.addEventListener("change", (event) => {
    selectedPilotId = event.target.value;
    elements.selectedAvatar.textContent = initials(getPilot(selectedPilotId).name);
  });
  elements.cancelRun.addEventListener("click", () => {
    if (timerState === "running" && window.confirm("¿Cancelar este intento? Los tiempos parciales no se guardarán.")) {
      resetTimer();
      showToast("Intento cancelado");
    }
  });
  elements.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  elements.openPublicView.addEventListener("click", () => switchView("public"));
  elements.addPilotButton.addEventListener("click", () => {
    elements.pilotDialog.showModal();
    window.setTimeout(() => elements.pilotName.focus(), 50);
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => elements.pilotDialog.close()));
  elements.pilotForm.addEventListener("submit", addPilot);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.clearResults.addEventListener("click", () => {
    if (!data.runs.length) {
      showToast("No hay resultados para borrar");
      return;
    }
    if (window.confirm("¿Borrar todos los resultados? Esta acción no se puede deshacer.")) {
      data.runs = [];
      persist("Resultados eliminados");
      if (isSupabaseConfigured) clearRemoteRuns().catch(reportRemoteError);
      renderAll();
      showToast("El leaderboard quedó listo para la carrera");
    }
  });
  document.addEventListener("keydown", (event) => {
    const editing = /INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName || "") || elements.pilotDialog.open;
    if (event.code === "Space" && !editing) {
      event.preventDefault();
      handleRaceAction();
    }
  });
  window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) refreshFromStorage(); });
  if (channel) channel.addEventListener("message", refreshFromStorage);

  function updateClock() {
    elements.publicClock.textContent = new Date().toLocaleTimeString("es-CL", { hour12: false });
  }
  updateClock();
  window.setInterval(updateClock, 1000);

  renderAll();
  initializeBackend();
})();
