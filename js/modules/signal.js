import { Entity } from "../engine.js";
import { Process } from "../process.js";

// Esta baliza representa el sistema de emergencia del aeropuerto
export class SignalBeacon extends Entity {
  constructor(config = {}) {
    super(config.id);
    this.label = config.label ?? "Alerta de emergencia";
    this.type = "Signal";
    this.moduleName = "Signals";
    this.x = config.x ?? 275;
    this.y = config.y ?? 140;
    this.width = config.width ?? 220;
    this.height = config.height ?? 120;
    this.state = "waiting";
    this.visualVariant = "signal";
    this.detailLines = ["Sin alerta"];
    this.tags = ["FIRE_ALERT"];
  }

  onAdded(engine) {
    this.unsubscribe = engine.on("FIRE_ALERT", () => {
      this.state = "blocked";
      this.detailLines = ["Emergencia activa"];
    });

    this.unsubscribeClear = engine.on("CLEAR_ALERT", () => {
      this.state = "waiting";
      this.detailLines = ["Sin alerta"];
    });
  }

  onRemoved() {
    this.unsubscribe?.();
    this.unsubscribeClear?.();
    this.unsubscribe = null;
    this.unsubscribeClear = null;
  }
}

// Este proceso representa personal o vehiculos que siguen trabajando hasta que llega la alerta
export class SignalProcess extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Proceso de aeropuerto",
      type: config.type ?? "Proceso",
      moduleName: "Signals",
      state: "running",
      x: config.x ?? 80,
      y: config.y ?? 120,
      width: config.width ?? 160,
      height: config.height ?? 90,
      visualVariant: config.visualVariant ?? "passenger",
    });

    this.originX = this.x;
    this.range = config.range ?? 120;
    this.speed = config.speed ?? 40;
    this.direction = 1;
    this.detailLines = config.detailLines ?? ["Operacion normal"];
    this.tags = config.tags ?? ["Activo"];
  }

  update(deltaTime, engine) {
    if (this.state === "stopped") {
      return;
    }

    this.x += this.speed * deltaTime * this.direction;

    if (this.x >= this.originX + this.range) {
      this.x = this.originX + this.range;
      this.direction = -1;
    }

    if (this.x <= this.originX) {
      this.x = this.originX;
      this.direction = 1;
    }

    if (engine?.emergencyActive) {
      this.detailLines = ["Operacion detenida"];
      this.tags = ["STOP"];
      return;
    }

    this.detailLines = ["Operacion normal", "Esperando alerta global"];
  }

  handleEvent(event, payload, engine = this.engine) {
    super.handleEvent(event, payload, engine);

    if (event === "FIRE_ALERT") {
      this.detailLines = ["Recibe FIRE_ALERT", "Todo se detiene"];
      this.tags = ["Signal RX"];
    }

    if (event === "CLEAR_ALERT") {
      this.detailLines = ["Operacion normal", "Esperando alerta global"];
      this.tags = ["Activo"];
    }
  }
}

// Esto dispara la emergencia global para que todos los procesos reaccionen
export function triggerFireAlert(engine) {
  engine.emergencyActive = true;
  engine.emit("log", { message: "Emergencia activa en el aeropuerto" });
  engine.emit("FIRE_ALERT", { reason: "FIRE_ALERT" });
}

// Esto apaga la alerta para que el sistema vuelva a moverse
export function clearFireAlert(engine) {
  engine.emergencyActive = false;
  engine.emit("log", { message: "Emergencia desactivada" });
  engine.emit("CLEAR_ALERT", { reason: "CLEAR_ALERT" });
}

// Este escenario deja visible la alerta global como modulo individual
export function createSignalsScenario({ prefix = "signals", offsetX = 0, offsetY = 0 } = {}) {
  return [
    new SignalBeacon({
      id: `${prefix}-beacon`,
      x: 330 + offsetX,
      y: 70 + offsetY,
      width: 300,
      height: 130,
    }),
    new SignalProcess({
      id: `${prefix}-crew-1`,
      name: "Bomberos pista",
      type: "Receptor",
      x: 90 + offsetX,
      y: 270 + offsetY,
      range: 180,
      speed: 44,
      visualVariant: "agent",
      tags: ["Signal RX"],
      detailLines: ["Patrullando pista"],
    }),
    new SignalProcess({
      id: `${prefix}-crew-2`,
      name: "Seguridad terminal",
      type: "Receptor",
      x: 320 + offsetX,
      y: 270 + offsetY,
      range: 150,
      speed: 36,
      visualVariant: "passenger",
      tags: ["Signal RX"],
      detailLines: ["Vigilando terminal"],
    }),
    new SignalProcess({
      id: `${prefix}-crew-3`,
      name: "Maletero movil",
      type: "Receptor",
      x: 560 + offsetX,
      y: 270 + offsetY,
      range: 170,
      speed: 50,
      visualVariant: "baggage",
      tags: ["Signal RX"],
      detailLines: ["Moviendo equipaje"],
    }),
  ];
}
