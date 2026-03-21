const DEFAULT_MAX_DELTA_TIME = 0.1;
const DEFAULT_SPEED = 1;

// Esta clase base sirve para que cada modulo tenga su propia logica y su propia forma de dibujarse
export class Entity {
  constructor(id) {
    this.id = id ?? crypto.randomUUID();
    this.active = true;
  }

  update(_deltaTime, _engine) {
    // Este metodo luego lo pisa cada entidad para mover su logica
  }

  render(_renderer, _engine) {
    // Este metodo luego lo pisa cada entidad para mostrar lo suyo en pantalla
  }
}

// Este engine es el que manda todo el flujo de la simulacion
// Aqui se controla el tiempo, las entidades y cuando toca actualizar o renderizar
export class Engine {
  constructor({
    renderer = null,
    autoRender = true,
    speed = DEFAULT_SPEED,
    maxDeltaTime = DEFAULT_MAX_DELTA_TIME,
  } = {}) {
    this.rendererInstance = renderer;
    this.autoRender = autoRender;
    this.maxDeltaTime = maxDeltaTime;

    this.entities = [];
    this.listeners = new Map();
    this.isRunning = false;
    this.speed = speed;
    this.deltaTime = 0;
    this.lastTime = 0;
    this.frameId = null;
    this.emergencyActive = false;

    this.boundLoop = this.loop.bind(this);
  }

  // Esto deja escuchar eventos sin acoplar entidades entre si
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  // Esto saca listeners cuando ya no se necesitan
  off(event, callback) {
    const callbacks = this.listeners.get(event);

    if (!callbacks) {
      return;
    }

    callbacks.delete(callback);

    if (callbacks.size === 0) {
      this.listeners.delete(event);
    }
  }

  // Esto dispara eventos para que el resto reaccione sin quedar pegado entre si
  emit(event, payload = {}) {
    const callbacks = this.listeners.get(event);

    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {
      callback(payload);
    }
  }

  // Esto arranca el loop principal y deja corriendo la simulacion
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.boundLoop);
  }

  // Esto pausa todo sin borrar el estado actual
  pause() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  // Esto avanza un solo paso y sirve mucho para depurar o mostrar procesos paso a paso
  step(frameDuration = 1000 / 60) {
    if (this.isRunning) {
      return;
    }

    const deltaTime = Math.min(
      (frameDuration / 1000) * this.speed,
      this.maxDeltaTime,
    );

    this.deltaTime = deltaTime;
    this.update(deltaTime);

    if (this.autoRender) {
      this.render();
    }
  }

  // Con esto cambiamos la velocidad general sin tocar la logica interna de cada modulo
  setSpeed(speed) {
    if (!Number.isFinite(speed) || speed <= 0) {
      throw new Error("Engine speed must be a number greater than 0.");
    }

    this.speed = speed;
  }

  // Aqui metemos una entidad nueva al motor para que empiece a participar en la simulacion
  addEntity(entity) {
    if (!(entity instanceof Entity)) {
      throw new Error("Engine only accepts instances of Entity.");
    }

    if (this.entities.includes(entity)) {
      return entity;
    }

    this.entities.push(entity);

    if (typeof entity.onAdded === "function") {
      entity.onAdded(this);
    }

    return entity;
  }

  // Aqui sacamos entidades por referencia o por id para tener mas flexibilidad
  removeEntity(entityOrId) {
    const matchById = typeof entityOrId === "string";
    const entity = this.entities.find((item) =>
      matchById ? item.id === entityOrId : item === entityOrId,
    );

    if (!entity) {
      return false;
    }

    if (typeof entity.onRemoved === "function") {
      entity.onRemoved(this);
    }

    this.entities = this.entities.filter((item) => item !== entity);
    return true;
  }

  // Este update recorre todas las entidades activas y les pasa el tiempo del frame actual
  update(deltaTime) {
    for (const entity of this.entities) {
      if (!entity.active) {
        continue;
      }

      entity.update(deltaTime, this);
    }
  }

  // Este render llama al renderer general y luego deja que cada entidad pinte su parte
  render(renderer = this.rendererInstance) {
    if (!renderer) {
      return;
    }

    if (typeof renderer.beginFrame === "function") {
      renderer.beginFrame(this);
    }

    for (const entity of this.entities) {
      if (!entity.active) {
        continue;
      }

      if (typeof renderer.renderEntity === "function") {
        renderer.renderEntity(entity, this);
        continue;
      }

      entity.render(renderer, this);
    }

    if (typeof renderer.endFrame === "function") {
      renderer.endFrame(this);
    }
  }

  // Este es el loop real que usa requestAnimationFrame para mantener todo fluido
  loop(currentTime) {
    if (!this.isRunning) {
      return;
    }

    const elapsedTime = (currentTime - this.lastTime) / 1000;
    const scaledDeltaTime = Math.min(
      elapsedTime * this.speed,
      this.maxDeltaTime,
    );

    this.lastTime = currentTime;
    this.deltaTime = scaledDeltaTime;

    this.update(scaledDeltaTime);

    if (this.autoRender) {
      this.render();
    }

    this.frameId = requestAnimationFrame(this.boundLoop);
  }
}
