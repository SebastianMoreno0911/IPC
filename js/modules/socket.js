import { Process } from "../process.js";

// Esta tarjeta compacta deja ver mejor cuando va y viene el mensaje del socket
export class SocketLink extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.label ?? "Canal socket",
      type: "Mensaje",
      moduleName: "Sockets",
      state: "waiting",
      x: config.x ?? 335,
      y: config.y ?? 24,
      width: config.width ?? 180,
      height: config.height ?? 74,
      visualVariant: "link",
    });

    this.targetAirplaneId = config.targetAirplaneId;
    this.detailLines = ["Sin trafico todavia"];
    this.tags = ["Idle"];
  }

  onAdded(engine) {
    this.unsubscribeRequest = engine.on(
      "socket:request-landing",
      ({ airplaneId, airplaneName }) => {
        if (airplaneId !== this.targetAirplaneId) {
          return;
        }

        this.state = "running";
        this.detailLines = [`${airplaneName} -> torre`, "Solicitud de aterrizaje"];
        this.tags = ["Socket OUT"];
      },
    );

    this.unsubscribeApproval = engine.on(
      "socket:landing-approved",
      ({ airplaneId, airplaneName, runway }) => {
        if (airplaneId !== this.targetAirplaneId) {
          return;
        }

        this.state = "blocked";
        this.detailLines = [`Torre -> ${airplaneName}`, `Autorizado en ${runway}`];
        this.tags = ["Socket IN"];
      },
    );
  }

  onRemoved() {
    this.unsubscribeRequest?.();
    this.unsubscribeApproval?.();
    this.unsubscribeRequest = null;
    this.unsubscribeApproval = null;
  }
}

// Esta torre escucha solicitudes y responde como si fuera un socket bidireccional
export class ControlTower extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Torre de control",
      type: "Socket",
      moduleName: "Sockets",
      state: "running",
      x: config.x ?? 650,
      y: config.y ?? 120,
      width: 220,
      height: 116,
      visualVariant: "tower",
    });

    this.detailLines = ["Escuchando solicitudes"];
    this.tags = ["Canal abierto"];
  }

  onAdded(engine) {
    super.onAdded(engine);

    this.listen("socket:request-landing", ({ airplaneId, airplaneName }) => {
      this.detailLines = [`Solicitud de ${airplaneName}`];
      engine.emit("log", {
        message: `Torre recibe solicitud de aterrizaje de ${airplaneName}`,
      });

      engine.emit("socket:landing-approved", {
        airplaneId,
        airplaneName,
        runway: "Pista A1",
      });
    });
  }
}

// Este avion se mueve y usa eventos para pedir permiso de aterrizaje
export class Airplane extends Process {
  constructor(config = {}) {
    super({
      id: config.id,
      name: config.name ?? "Avion",
      type: "Socket",
      moduleName: "Sockets",
      state: "running",
      x: config.x ?? 40,
      y: config.y ?? 110,
      width: 170,
      height: 92,
      visualVariant: "airplane",
    });

    this.speed = config.speed ?? 90;
    this.requestPointX = config.requestPointX ?? 360;
    this.landingPointX = config.landingPointX ?? 760;
    this.requestedLanding = false;
    this.authorizedLanding = false;
    this.finishedLanding = false;
    this.detailLines = ["Aproximacion a pista"];
    this.tags = ["Vuelo", "Socket OUT"];
  }

  onAdded(engine) {
    super.onAdded(engine);

    this.listen("socket:landing-approved", ({ airplaneId, runway }) => {
      if (airplaneId !== this.id) {
        return;
      }

      this.authorizedLanding = true;
      this.setState(
        "running",
        engine,
        `${this.name} recibe permiso para aterrizar en ${runway}`,
      );
      this.detailLines = [`Autorizado en ${runway}`];
      this.tags = ["Socket IN", "Autorizado"];
    });
  }

  update(deltaTime, engine) {
    if (this.state === "stopped" || this.finishedLanding) {
      return;
    }

    if (!this.requestedLanding) {
      this.x += this.speed * deltaTime;

      if (this.x >= this.requestPointX) {
        this.requestedLanding = true;
        this.setState(
          "waiting",
          engine,
          `${this.name} solicita aterrizaje a la torre`,
        );
        this.detailLines = ["Solicitud enviada"];
        this.tags = ["Socket OUT"];
        engine.emit("socket:request-landing", {
          airplaneId: this.id,
          airplaneName: this.name,
        });
      }

      return;
    }

    if (this.authorizedLanding) {
      this.x += this.speed * 0.45 * deltaTime;

      if (this.x >= this.landingPointX) {
        this.x = this.landingPointX;
        this.finishedLanding = true;
        this.setState("stopped", engine, `${this.name} termina su aterrizaje`);
        this.detailLines = ["Aterrizaje completado"];
        this.tags = ["Finalizado"];
        return;
      }

      this.detailLines = ["Aterrizaje en curso"];
    }
  }
}

// Esto crea el escenario de sockets con torre y aviones
export function createSocketsScenario({ prefix = "sockets", offsetX = 0, offsetY = 0 } = {}) {
  const planeOneId = `${prefix}-plane-1`;
  const planeTwoId = `${prefix}-plane-2`;

  return [
    new SocketLink({
      id: `${prefix}-link-1`,
      label: "Canal AR101",
      x: 310 + offsetX,
      y: 24 + offsetY,
      targetAirplaneId: planeOneId,
    }),
    new SocketLink({
      id: `${prefix}-link-2`,
      label: "Canal AR245",
      x: 310 + offsetX,
      y: 250 + offsetY,
      targetAirplaneId: planeTwoId,
    }),
    new ControlTower({
      id: `${prefix}-tower`,
      x: 660 + offsetX,
      y: 150 + offsetY,
    }),
    new Airplane({
      id: planeOneId,
      name: "Vuelo AR101",
      x: 40 + offsetX,
      y: 95 + offsetY,
      requestPointX: 420 + offsetX,
      landingPointX: 930 + offsetX,
    }),
    new Airplane({
      id: planeTwoId,
      name: "Vuelo AR245",
      x: 60 + offsetX,
      y: 320 + offsetY,
      requestPointX: 390 + offsetX,
      landingPointX: 900 + offsetX,
      speed: 72,
    }),
  ];
}
