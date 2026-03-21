import { Entity } from "../engine.js";
import { Process } from "../process.js";

// Esta cola representa el check in trabajando en orden FIFO
export class MessageQueue extends Entity {
  constructor(config = {}) {
    super(config.id);
    this.label = config.label ?? "Check in";
    this.type = "Queue";
    this.moduleName = "Queue";
    this.x = config.x ?? 330;
    this.y = config.y ?? 110;
    this.width = config.width ?? 260;
    this.height = config.height ?? 190;
    this.state = "waiting";
    this.visualVariant = "queue";
    this.items = [];
    this.tags = ["FIFO"];
    this.syncVisuals();
  }

  enqueue(item) {
    this.items.push(item);
    this.state = "running";
    this.syncVisuals();
  }

  dequeue() {
    const item = this.items.shift() ?? null;
    this.state = this.items.length === 0 ? "waiting" : "running";
    this.syncVisuals();
    return item;
  }

  syncVisuals() {
    this.detailLines = [
      `En fila ${this.items.length}`,
      this.items.length === 0 ? "Sin pasajeros" : this.items.map((item) => item.name).join("  "),
    ];
  }
}

// Este pasajero se pone en la fila y espera turno
export class Passenger extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Pasajero",
      type: "Mensaje",
      moduleName: "Queue",
      state: "running",
      x: config.x ?? 50,
      y: config.y ?? 100,
      width: 140,
      height: 86,
      visualVariant: "passenger",
    });

    this.queueId = config.queueId;
    this.walkSpeed = config.walkSpeed ?? 70;
    this.targetX = config.targetX ?? 180;
    this.joinedQueue = false;
    this.beingServed = false;
    this.tags = ["Ticket"];
  }

  onAdded(engine) {
    super.onAdded(engine);

    this.listen("queue:served", ({ passengerId }) => {
      if (passengerId !== this.id) {
        return;
      }

      this.beingServed = false;
      this.active = false;
      engine.emit("log", { message: `${this.name} termina su check in` });
    });
  }

  update(deltaTime, engine) {
    if (this.state === "stopped" || !this.active) {
      return;
    }

    if (!this.joinedQueue) {
      this.x = Math.min(this.targetX, this.x + this.walkSpeed * deltaTime);
      this.detailLines = ["Caminando a la fila"];

      if (this.x >= this.targetX) {
        const queue = engine.entities.find((entity) => entity.id === this.queueId);

        if (!queue) {
          return;
        }

        queue.enqueue({ id: this.id, name: this.name });
        this.joinedQueue = true;
        this.setState("waiting", engine, `${this.name} entra a la fila de check in`);
        this.detailLines = ["Esperando turno"];
      }

      return;
    }

    if (!this.beingServed) {
      this.detailLines = ["En cola"];
    }
  }
}

// Este agente atiende pasajeros uno por uno consumiendo de la cola
export class CheckInAgent extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Agente de check in",
      type: "Consumer",
      moduleName: "Queue",
      state: "running",
      x: config.x ?? 700,
      y: config.y ?? 130,
      width: 170,
      height: 110,
      visualVariant: "agent",
    });

    this.queueId = config.queueId;
    this.serviceTimer = 0;
    this.serviceDuration = config.serviceDuration ?? 2.4;
    this.currentPassenger = null;
    this.tags = ["Atencion"];
  }

  update(deltaTime, engine) {
    if (this.state === "stopped") {
      return;
    }

    const queue = engine.entities.find((entity) => entity.id === this.queueId);

    if (!queue) {
      return;
    }

    if (!this.currentPassenger) {
      const nextPassenger = queue.dequeue();

      if (!nextPassenger) {
        this.setState("waiting", engine);
        this.detailLines = ["Sin pasajeros"];
        return;
      }

      this.currentPassenger = nextPassenger;
      this.serviceTimer = 0;
      this.setState("running", engine, `${this.name} empieza a atender a ${nextPassenger.name}`);
      this.detailLines = [`Atendiendo a ${nextPassenger.name}`];

      const passenger = engine.entities.find((entity) => entity.id === nextPassenger.id);

      if (passenger) {
        passenger.beingServed = true;
        passenger.setState("blocked", engine);
        passenger.detailLines = ["Mostrando documento"];
      }

      return;
    }

    this.serviceTimer += deltaTime;

    if (this.serviceTimer < this.serviceDuration) {
      return;
    }

    const donePassenger = this.currentPassenger;
    this.currentPassenger = null;
    this.serviceTimer = 0;
    engine.emit("queue:served", { passengerId: donePassenger.id });
    engine.emit("log", { message: `${this.name} termina con ${donePassenger.name}` });
  }
}

// Esto crea el escenario del check in con fila y atencion FIFO
export function createQueueScenario({ prefix = "queue", offsetX = 0, offsetY = 0 } = {}) {
  const queue = new MessageQueue({
    id: `${prefix}-queue`,
    x: 330 + offsetX,
    y: 110 + offsetY,
  });

  return [
    new Passenger({
      id: `${prefix}-passenger-1`,
      name: "Ana",
      x: 35 + offsetX,
      y: 70 + offsetY,
      targetX: 180 + offsetX,
      queueId: queue.id,
    }),
    new Passenger({
      id: `${prefix}-passenger-2`,
      name: "Luis",
      x: 35 + offsetX,
      y: 240 + offsetY,
      targetX: 180 + offsetX,
      queueId: queue.id,
      walkSpeed: 55,
    }),
    queue,
    new CheckInAgent({
      id: `${prefix}-agent`,
      x: 700 + offsetX,
      y: 130 + offsetY,
      queueId: queue.id,
    }),
  ];
}
