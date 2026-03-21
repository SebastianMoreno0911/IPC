import { Entity } from "./engine.js";

let processCounter = 1;

// Esta clase base representa cualquier proceso del aeropuerto que reacciona a eventos
export class Process extends Entity {
  constructor({
    id,
    pid,
    name,
    type = "Proceso",
    moduleName = "General",
    state = "waiting",
    x = 24,
    y = 24,
    width = 160,
    height = 96,
    visualVariant = "process",
  } = {}) {
    super(id);
    this.pid = pid ?? processCounter++;
    this.name = name ?? `Proceso ${this.pid}`;
    this.label = this.name;
    this.type = type;
    this.moduleName = moduleName;
    this.state = state;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.visualVariant = visualVariant;
    this.detailLines = [];
    this.tags = [];
    this.engine = null;
    this.unsubscribers = [];
    this.stateBeforeEmergency = null;
    this.wasStoppedByEmergency = false;
  }

  // Aqui guardamos el engine y dejamos el proceso listo para escuchar eventos globales
  onAdded(engine) {
    this.engine = engine;

    this.unsubscribers.push(
      engine.on("FIRE_ALERT", (payload) => {
        this.handleEvent("FIRE_ALERT", payload, engine);
      }),
      engine.on("CLEAR_ALERT", (payload) => {
        this.handleEvent("CLEAR_ALERT", payload, engine);
      }),
    );
  }

  // Esto limpia listeners cuando el proceso sale del escenario
  onRemoved() {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }

    this.unsubscribers = [];
    this.engine = null;
  }

  update(_deltaTime, _engine) {}

  // Este metodo se pisa en cada proceso cuando quiera reaccionar a eventos del aeropuerto
  handleEvent(event, payload, engine = this.engine) {
    if (event === "FIRE_ALERT") {
      if (this.state !== "stopped") {
        this.stateBeforeEmergency = this.state;
        this.wasStoppedByEmergency = true;
      }

      this.setState("stopped", engine);
      this.detailLines = ["Operacion detenida por alerta"];
    }

    if (event === "CLEAR_ALERT" && this.wasStoppedByEmergency) {
      this.wasStoppedByEmergency = false;
      this.setState(this.stateBeforeEmergency ?? "waiting", engine);
      this.stateBeforeEmergency = null;
    }

    void payload;
  }

  // Esto centraliza el cambio de estado para que tambien pueda dejar logs cuando haga falta
  setState(newState, engine = this.engine, message = "") {
    if (this.state === newState && !message) {
      return;
    }

    this.state = newState;

    if (message && engine) {
      engine.emit("log", { message });
    }
  }

  // Esto ayuda a registrar listeners propios sin repetir codigo
  listen(event, handler, engine = this.engine) {
    if (!engine) {
      return;
    }

    const unsubscribe = engine.on(event, handler);
    this.unsubscribers.push(unsubscribe);
  }
}
