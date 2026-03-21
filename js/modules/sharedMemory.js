import { Entity } from "../engine.js";
import { Process } from "../process.js";

// Esta memoria compartida funciona como el panel de vuelos del aeropuerto
export class SharedMemory extends Entity {
  constructor(config = {}) {
    super(config.id);
    this.label = config.label ?? "Panel de vuelos";
    this.type = "Memoria";
    this.moduleName = "Memoria compartida";
    this.x = config.x ?? 320;
    this.y = config.y ?? 85;
    this.width = config.width ?? 320;
    this.height = config.height ?? 240;
    this.state = "running";
    this.visualVariant = "panel";
    this.flights = config.flights ?? [
      { code: "AR101", status: "En puerta" },
      { code: "AR245", status: "Embarcando" },
      { code: "AR320", status: "A tiempo" },
    ];
    this.detailLimit = 8;
    this.detailLines = this.buildLines();
    this.tags = ["Compartida"];
  }

  writeFlight(index, status) {
    if (!this.flights[index]) {
      return;
    }

    this.flights[index].status = status;
    this.detailLines = this.buildLines();
  }

  readFlights() {
    return this.flights.map((flight) => ({ ...flight }));
  }

  buildLines() {
    return this.flights.map((flight) => `${flight.code}  ${flight.status}`);
  }
}

// Este avion escribe estados en el panel como si fuera un productor
export class FlightWriter extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Avion escritor",
      type: "Writer",
      moduleName: "Memoria compartida",
      state: "running",
      x: config.x ?? 40,
      y: config.y ?? 85,
      visualVariant: "airplane",
    });

    this.flightIndex = config.flightIndex ?? 0;
    this.writeTimer = 0;
    this.writeInterval = config.writeInterval ?? 2.2;
    this.statusSteps = ["En puerta", "Rodando", "Abordando", "Despegando"];
    this.stepIndex = 0;
    this.sharedMemoryId = config.sharedMemoryId;
    this.tags = ["Writer"];
  }

  update(deltaTime, engine) {
    if (this.state === "stopped") {
      return;
    }

    this.writeTimer += deltaTime;
    this.x += Math.sin(performance.now() * 0.001 + this.pid) * 0.25;

    if (this.writeTimer < this.writeInterval) {
      return;
    }

    this.writeTimer = 0;
    const panel = engine.entities.find((entity) => entity.id === this.sharedMemoryId);

    if (!panel) {
      return;
    }

    const nextStatus = this.statusSteps[this.stepIndex % this.statusSteps.length];
    panel.writeFlight(this.flightIndex, nextStatus);
    this.detailLines = [`Escribe ${nextStatus}`];
    engine.emit("log", {
      message: `${this.name} actualiza el panel con ${nextStatus}`,
    });

    this.stepIndex += 1;
  }
}

// Este pasajero lee el panel como si consumiera memoria compartida sin mutex
export class PassengerReader extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Pasajero lector",
      type: "Reader",
      moduleName: "Memoria compartida",
      state: "waiting",
      x: config.x ?? 720,
      y: config.y ?? 160,
      visualVariant: "passenger",
      width: 140,
      height: 88,
    });

    this.readTimer = 0;
    this.readInterval = config.readInterval ?? 1.8;
    this.sharedMemoryId = config.sharedMemoryId;
    this.detailLimit = 5;
    this.tags = ["Reader"];
  }

  update(deltaTime, engine) {
    if (this.state === "stopped") {
      return;
    }

    this.readTimer += deltaTime;

    if (this.readTimer < this.readInterval) {
      return;
    }

    this.readTimer = 0;
    const panel = engine.entities.find((entity) => entity.id === this.sharedMemoryId);

    if (!panel) {
      return;
    }

    const flights = panel.readFlights();
    const latestFlight = flights[(this.pid + flights.length) % flights.length];

    this.setState("running", engine);
    this.detailLines = [
      `Lee ${latestFlight.code}`,
      ...flights.map((flight) => `${flight.code}  ${flight.status}`),
    ];
    engine.emit("log", {
      message: `${this.name} consulta ${latestFlight.code} en el panel`,
    });
  }
}

// Esto crea el escenario de memoria compartida con panel, avion y pasajero
export function createSharedMemoryScenario({
  prefix = "shared",
  offsetX = 0,
  offsetY = 0,
} = {}) {
  const panel = new SharedMemory({
    id: `${prefix}-panel`,
    x: 320 + offsetX,
    y: 85 + offsetY,
  });

  return [
    panel,
    new FlightWriter({
      id: `${prefix}-writer-1`,
      name: "Vuelo AR101",
      x: 40 + offsetX,
      y: 70 + offsetY,
      sharedMemoryId: panel.id,
      flightIndex: 0,
    }),
    new FlightWriter({
      id: `${prefix}-writer-2`,
      name: "Vuelo AR245",
      x: 40 + offsetX,
      y: 260 + offsetY,
      sharedMemoryId: panel.id,
      flightIndex: 1,
      writeInterval: 3,
    }),
    new PassengerReader({
      id: `${prefix}-reader-1`,
      name: "Pasajero Ana",
      x: 720 + offsetX,
      y: 165 + offsetY,
      sharedMemoryId: panel.id,
    }),
  ];
}
