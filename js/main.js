import { Engine } from "./engine.js";
import { Renderer } from "./renderer.js";
import { createQueueScenario } from "./modules/messageQueue.js";
import { createPipesScenario } from "./modules/pipes.js";
import { createSharedMemoryScenario } from "./modules/sharedMemory.js";
import {
  clearFireAlert,
  createSignalsScenario,
  triggerFireAlert,
} from "./modules/signal.js";
import { createSocketsScenario } from "./modules/socket.js";

const MODULE_META = {
  sockets: {
    label: "Sockets",
    description:
      "Torre y aviones intercambian mensajes directos de ida y vuelta como una conexion dedicada",
  },
  "shared-memory": {
    label: "Memoria compartida",
    description:
      "Panel de vuelos donde aviones escriben y pasajeros leen al mismo tiempo",
  },
  pipes: {
    label: "Pipes",
    description:
      "Scanner de equipaje con buffer limitado donde writer y reader pueden bloquearse",
  },
  queue: {
    label: "Queue",
    description:
      "Check in con fila FIFO donde el agente atiende pasajeros uno por uno",
  },
  signals: {
    label: "Signals",
    description:
      "Una senal global FIRE_ALERT se emite una sola vez y todos los procesos reaccionan al mismo tiempo",
  },
  full: {
    label: "Full",
    description:
      "Aeropuerto completo con torre, panel, equipaje, check in y emergencia juntos",
  },
};

// Aqui juntamos los nodos de la interfaz para no andar buscando elementos por todo lado
const ui = {
  startButton: document.querySelector("#start-button"),
  pauseButton: document.querySelector("#pause-button"),
  stepButton: document.querySelector("#step-button"),
  emergencyButton: document.querySelector("#emergency-button"),
  speedSlider: document.querySelector("#speed-slider"),
  speedValue: document.querySelector("#speed-value"),
  moduleSelect: document.querySelector("#module-select"),
  clearLogsButton: document.querySelector("#clear-logs-button"),
  logPanel: document.querySelector("#log-panel"),
};

const renderer = new Renderer();
const engine = new Engine({ renderer });
let shouldResumeAfterEmergency = false;

// Esto mete logs en el panel usando el sistema de eventos del engine
function appendLog(message) {
  if (!ui.logPanel) {
    return;
  }

  const entry = document.createElement("p");
  entry.className =
    "animate-fade-in rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3";
  entry.textContent = message;
  ui.logPanel.prepend(entry);
}

// Esto limpia las entidades activas para poder cargar otro escenario sin mezclar cosas
function clearEngineEntities() {
  const entities = [...engine.entities];

  for (const entity of entities) {
    engine.removeEntity(entity);
  }
}

// Este modulo deja torre y aviones hablando como sockets
function loadSocketsModule() {
  return createSocketsScenario();
}

// Este modulo monta panel de vuelos con escritores y lectores
function loadSharedMemoryModule() {
  return createSharedMemoryScenario();
}

// Este modulo monta el scanner de equipaje con su pipe
function loadPipesModule() {
  return createPipesScenario();
}

// Este modulo monta la cola de check in
function loadQueueModule() {
  return createQueueScenario();
}

// Este modulo deja la baliza y un pequeño escenario para poder disparar la alerta
function loadSignalsModule() {
  return createSignalsScenario();
}

// Este modulo junta todo al mismo tiempo para ver el aeropuerto completo
function loadFullModule() {
  return [
    ...createSocketsScenario({
      prefix: "full-socket",
      offsetX: 20,
      offsetY: 10,
    }),
    ...createSharedMemoryScenario({
      prefix: "full-memory",
      offsetX: 720,
      offsetY: 20,
    }),
    ...createQueueScenario({ prefix: "full-queue", offsetX: 20, offsetY: 470 }),
    ...createPipesScenario({
      prefix: "full-pipes",
      offsetX: 730,
      offsetY: 500,
    }),
    ...createSignalsScenario({
      prefix: "full-signal",
      offsetX: 560,
      offsetY: 900,
    }),
  ];
}

// Esto decide que escenario cargar segun el selector activo
function buildModuleEntities(moduleKey) {
  if (moduleKey === "shared-memory") {
    return loadSharedMemoryModule();
  }

  if (moduleKey === "pipes") {
    return loadPipesModule();
  }

  if (moduleKey === "queue") {
    return loadQueueModule();
  }

  if (moduleKey === "signals") {
    return loadSignalsModule();
  }

  if (moduleKey === "full") {
    return loadFullModule();
  }

  return loadSocketsModule();
}

// Esto devuelve una entidad de referencia para refrescar el hud
function getPrimaryEntity() {
  return engine.entities[0] ?? null;
}

// Esto sincroniza el texto de velocidad con el valor real del engine
function syncSpeedLabel() {
  const value = `${engine.speed.toFixed(1)}x`;

  if (ui.speedValue) {
    ui.speedValue.textContent = value;
  }
}

// Esto carga un escenario completo sin romper el estado del engine
function loadModule(moduleKey) {
  engine.pause();
  engine.emergencyActive = false;
  engine.moduleKey = moduleKey;
  engine.moduleMeta = MODULE_META[moduleKey] ?? MODULE_META.sockets;
  clearEngineEntities();

  const entities = buildModuleEntities(moduleKey);

  for (const entity of entities) {
    engine.addEntity(entity);
  }

  engine.emit("log", {
    message: `Escenario ${engine.moduleMeta.label} cargado`,
  });
  return entities;
}

// Esto deja la emergencia global lista para detener todo cuando toque
function activateEmergency() {
  if (engine.emergencyActive) {
    clearFireAlert(engine);

    if (shouldResumeAfterEmergency) {
      engine.start();
    } else {
      engine.render();
    }

    updateEmergencyButton();
    return;
  }

  shouldResumeAfterEmergency = engine.isRunning;
  triggerFireAlert(engine);
  engine.pause();
  engine.render();
  updateEmergencyButton();
}

function updateEmergencyButton() {
  if (!ui.emergencyButton) {
    return;
  }

  ui.emergencyButton.textContent = engine.emergencyActive
    ? "Desactivar emergencia"
    : "Activar emergencia";
}

// Aqui dejamos todos los controles conectados al engine y a los escenarios
function bindEvents() {
  ui.startButton?.addEventListener("click", () => {
    engine.start();
    engine.render();
    engine.emit("log", { message: "Simulacion iniciada" });
  });

  ui.pauseButton?.addEventListener("click", () => {
    engine.pause();
    engine.render();
    engine.emit("log", { message: "Simulacion pausada" });
  });

  ui.stepButton?.addEventListener("click", () => {
    engine.step(1000 / 8);
    engine.emit("log", { message: "Paso manual ejecutado" });
  });

  ui.speedSlider?.addEventListener("input", (event) => {
    const nextSpeed = Number(event.target.value);
    engine.setSpeed(nextSpeed);
    syncSpeedLabel();
    engine.render();
    engine.emit("log", {
      message: `Velocidad ajustada a ${nextSpeed.toFixed(1)}x`,
    });
  });

  ui.moduleSelect?.addEventListener("change", (event) => {
    loadModule(event.target.value);
    engine.render();
    updateEmergencyButton();
  });

  ui.emergencyButton?.addEventListener("click", () => {
    activateEmergency();
  });

  ui.clearLogsButton?.addEventListener("click", () => {
    if (!ui.logPanel) {
      return;
    }

    ui.logPanel.innerHTML = "";
    appendLog("Panel de logs limpio");
  });
}

// Esto enlaza el sistema de logs del engine con la interfaz
function bindEngineEvents() {
  engine.on("log", ({ message }) => {
    appendLog(message);
  });
}

// Esto deja todo listo al cargar la pagina
function init() {
  const initialModule = ui.moduleSelect?.value ?? "sockets";

  bindEngineEvents();
  bindEvents();
  loadModule(initialModule);
  syncSpeedLabel();
  updateEmergencyButton();
  engine.render();
}

init();
