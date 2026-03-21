import { Entity } from "../engine.js";
import { Process } from "../process.js";

// Este buffer representa el scanner de equipaje con capacidad limitada
export class Pipe extends Entity {
  constructor(config = {}) {
    super(config.id);
    this.label = config.label ?? "Scanner de equipaje";
    this.type = "Pipe";
    this.moduleName = "Pipes";
    this.x = config.x ?? 335;
    this.y = config.y ?? 145;
    this.width = config.width ?? 260;
    this.height = config.height ?? 120;
    this.capacity = config.capacity ?? 4;
    this.items = [];
    this.state = "waiting";
    this.visualVariant = "pipe";
    this.detailLimit = 3;
    this.itemList = [];
    this.tags = ["FIFO"];
    this.syncVisuals();
  }

  push(item) {
    if (this.items.length >= this.capacity) {
      this.state = "blocked";
      this.syncVisuals();
      return false;
    }

    this.items.push(item);
    this.state = "running";
    this.syncVisuals();
    return true;
  }

  pop() {
    if (this.items.length === 0) {
      this.state = "waiting";
      this.syncVisuals();
      return null;
    }

    const item = this.items.shift();
    this.state = this.items.length === 0 ? "waiting" : "running";
    this.syncVisuals();
    return item;
  }

  syncVisuals() {
    this.detailLines = [
      `Capacidad ${this.items.length}/${this.capacity}`,
      this.items.length === 0 ? "Sin equipaje en cola" : "Maletas en cola",
    ];
    this.itemList = this.items.map((item) => ({ name: item }));
  }
}

// Este proceso mete equipaje al pipe y se bloquea cuando ya no cabe nada
export class BaggageInput extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Cinta de entrada",
      type: "Writer",
      moduleName: "Pipes",
      state: "running",
      x: config.x ?? 35,
      y: config.y ?? 160,
      visualVariant: "baggage",
    });

    this.pipeId = config.pipeId;
    this.writeTimer = 0;
    this.writeInterval = config.writeInterval ?? 1.2;
    this.baggageCount = 1;
    this.itemList = [];
    this.itemDisplayTimer = 0;
    this.tags = ["Writer"];
  }

  update(deltaTime, engine) {
    if (this.state === "stopped") {
      return;
    }

    if (this.itemDisplayTimer > 0) {
      this.itemDisplayTimer -= deltaTime;

      if (this.itemDisplayTimer <= 0) {
        this.itemList = [];
      }
    }

    this.writeTimer += deltaTime;

    if (this.writeTimer < this.writeInterval) {
      return;
    }

    this.writeTimer = 0;
    const pipe = engine.entities.find((entity) => entity.id === this.pipeId);

    if (!pipe) {
      return;
    }

    const baggageId = `BG${this.baggageCount}`;
    const inserted = pipe.push(baggageId);

    if (!inserted) {
      this.setState("blocked", engine, `${this.name} se bloquea porque el scanner esta lleno`);
      this.detailLines = ["Esperando espacio libre"];
      this.itemList = [];
      return;
    }

    this.baggageCount += 1;
    this.setState("running", engine, `${this.name} envia ${baggageId} al scanner`);
    this.detailLines = [`Enviando ${baggageId}`];
    this.itemList = [{ name: baggageId }];
    this.itemDisplayTimer = 0.9;
  }
}

// Este proceso saca equipaje del pipe y se bloquea cuando no hay nada que leer
export class BaggageOutput extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Cinta de salida",
      type: "Reader",
      moduleName: "Pipes",
      state: "waiting",
      x: config.x ?? 710,
      y: config.y ?? 160,
      visualVariant: "baggage",
    });

    this.pipeId = config.pipeId;
    this.readTimer = 0;
    this.readInterval = config.readInterval ?? 1.8;
    this.itemList = [];
    this.itemDisplayTimer = 0;
    this.tags = ["Reader"];
  }

  update(deltaTime, engine) {
    if (this.state === "stopped") {
      return;
    }

    if (this.itemDisplayTimer > 0) {
      this.itemDisplayTimer -= deltaTime;

      if (this.itemDisplayTimer <= 0) {
        this.itemList = [];
      }
    }

    this.readTimer += deltaTime;

    if (this.readTimer < this.readInterval) {
      return;
    }

    this.readTimer = 0;
    const pipe = engine.entities.find((entity) => entity.id === this.pipeId);

    if (!pipe) {
      return;
    }

    const baggage = pipe.pop();

    if (!baggage) {
      this.setState("blocked", engine, `${this.name} se bloquea porque no hay equipaje`);
      this.detailLines = ["Esperando lectura"];
      this.itemList = [];
      return;
    }

    this.setState("running", engine, `${this.name} recibe ${baggage}`);
    this.detailLines = [`Recibiendo ${baggage}`];
    this.itemList = [{ name: baggage }];
    this.itemDisplayTimer = 1.1;
  }
}

// Esto arma el escenario del scanner de equipaje
export function createPipesScenario({ prefix = "pipes", offsetX = 0, offsetY = 0 } = {}) {
  const pipe = new Pipe({
    id: `${prefix}-pipe`,
    x: 335 + offsetX,
    y: 145 + offsetY,
  });

  return [
    new BaggageInput({
      id: `${prefix}-input`,
      x: 35 + offsetX,
      y: 160 + offsetY,
      pipeId: pipe.id,
    }),
    pipe,
    new BaggageOutput({
      id: `${prefix}-output`,
      x: 710 + offsetX,
      y: 160 + offsetY,
      pipeId: pipe.id,
    }),
  ];
}
