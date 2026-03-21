const DEFAULT_ENTITY_SIZE = {
  width: 140,
  height: 84,
};

const UNIFIED_CARD_SIZE = {
  width: 320,
  height: 240,
};

// Este renderer solo se encarga de lo visual y de reflejar lo que el engine ya calculo
export class Renderer {
  constructor({
    stageSelector = "#simulation-stage",
    statusSelector = "#engine-status",
    activeModuleSelector = "#active-module-label",
    speedSelector = "#engine-speed-label",
    moduleDescriptionSelector = "#module-description",
    entityCountSelector = "#entity-count",
  } = {}) {
    this.stage = document.querySelector(stageSelector);
    this.statusElement = document.querySelector(statusSelector);
    this.activeModuleElement = document.querySelector(activeModuleSelector);
    this.speedElement = document.querySelector(speedSelector);
    this.moduleDescriptionElement = document.querySelector(
      moduleDescriptionSelector,
    );
    this.entityCountElement = document.querySelector(entityCountSelector);

    if (!this.stage) {
      throw new Error("Renderer needs a valid stage element");
    }

    this.entityElements = new Map();
    this.renderedIds = new Set();
    this.engine = null;

    this.viewport = this.createViewport();
  }

  // Esta base es como la mesa de trabajo donde luego se acomodan todas las entidades
  createViewport() {
    const viewport = document.createElement("div");
    viewport.className =
      "simulation-world relative min-h-[620px] min-w-full overflow-hidden rounded-xl";
    viewport.dataset.role = "simulation-viewport";

    this.stage.innerHTML = "";
    this.stage.appendChild(viewport);

    return viewport;
  }

  // Aqui se prepara un frame nuevo y se limpian marcas de lo que se renderizo en esta vuelta
  beginFrame(engine) {
    this.engine = engine;
    this.renderedIds.clear();
    this.stage.classList.toggle(
      "is-emergency",
      Boolean(engine?.emergencyActive),
    );
    this.syncWorldSize(engine?.entities ?? []);
    this.updateHud(engine);
  }

  // Esto crea o actualiza el nodo visual de una entidad segun el estado que traiga
  renderEntity(entity, engine) {
    const element = this.getOrCreateEntityElement(entity);
    const { x, y, width, height } = this.getEntityLayout(entity);
    const state = this.getVisualState(entity, engine);
    const renderData = this.getRenderData(entity);
    const label = renderData.label;
    const type = renderData.type;

    element.style.width = `${width}px`;
    element.style.height = "auto";
    element.style.transform = `translate(${x}px, ${y}px)`;
    element.style.zIndex = `${this.getLayerIndex(renderData.visualVariant)}`;
    element.dataset.entityId = entity.id;
    element.dataset.state = state;
    element.dataset.variant = renderData.visualVariant;

    const figureElement = element.querySelector("[data-role='entity-figure']");
    const iconElement = element.querySelector("[data-role='entity-icon']");
    const cardElement = element.querySelector("[data-role='entity-card']");
    const titleElement = element.querySelector("[data-role='entity-title']");
    const typeElement = element.querySelector("[data-role='entity-type']");
    const stateElement = element.querySelector("[data-role='entity-state']");
    const detailsElement = element.querySelector(
      "[data-role='entity-details']",
    );
    const itemsElement = element.querySelector("[data-role='entity-items']");
    const tagsElement = element.querySelector("[data-role='entity-tags']");

    if (cardElement) {
      cardElement.style.width = `${width}px`;
      cardElement.style.minHeight = "0";
      cardElement.classList.toggle(
        "entity-card-compact",
        this.isCompactVariant(renderData.visualVariant),
      );
      cardElement.classList.toggle(
        "entity-card-plain",
        this.isPlainVariant(renderData.visualVariant),
      );
    }

    if (figureElement) {
      figureElement.classList.toggle(
        "hidden",
        this.isStaticVariant(renderData.visualVariant),
      );
    }

    if (titleElement) {
      titleElement.textContent = label;
    }

    if (typeElement) {
      typeElement.textContent = type;
    }

    if (stateElement) {
      stateElement.textContent = this.formatStateLabel(state);
    }

    if (iconElement) {
      iconElement.innerHTML = renderData.iconSvg;
      iconElement.setAttribute("aria-label", renderData.iconLabel);
      iconElement.setAttribute("title", renderData.iconLabel);
    }

    if (detailsElement) {
      detailsElement.innerHTML = "";

      const detailLimit = Number.isFinite(renderData.detailLimit)
        ? renderData.detailLimit
        : this.getDetailLimit(renderData.visualVariant);

      for (const line of renderData.detailLines.slice(0, detailLimit)) {
        const item = document.createElement("li");
        item.textContent = line;
        detailsElement.appendChild(item);
      }
    }

    if (itemsElement) {
      itemsElement.innerHTML = "";
      itemsElement.classList.toggle("hidden", !renderData.itemList.length);

      for (const itemData of renderData.itemList) {
        const item = document.createElement("div");
        item.className =
          "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200";
        item.innerHTML =
          '<svg viewBox="0 0 64 64" class="h-4 w-4 shrink-0" aria-hidden="true"><rect x="16" y="20" width="32" height="28" rx="6" fill="currentColor"/><path d="M25 20v-4c0-4 3-6 7-6s7 2 7 6v4" stroke="currentColor" stroke-width="4" fill="none"/></svg>';

        const labelElement = document.createElement("span");
        labelElement.textContent = itemData.name;
        item.appendChild(labelElement);
        itemsElement.appendChild(item);
      }
    }

    if (tagsElement) {
      tagsElement.innerHTML = "";

      for (const tag of renderData.tags.slice(
        0,
        this.getTagLimit(renderData.visualVariant),
      )) {
        const item = document.createElement("span");
        item.className =
          "rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300";
        item.textContent = tag;
        tagsElement.appendChild(item);
      }
    }

    this.applyVariantClasses(element, renderData.visualVariant);
    this.applyStateClasses(element, state);
    this.renderedIds.add(entity.id);
    this.updateHud(engine, entity);
  }

  // Al final del frame se barren nodos que ya no existan para que la vista no se ensucie
  endFrame() {
    for (const [entityId, element] of this.entityElements.entries()) {
      if (this.renderedIds.has(entityId)) {
        continue;
      }

      element.remove();
      this.entityElements.delete(entityId);
    }
  }

  // Esto arma el html base de cada entidad para no repetir estructura cada vez
  getOrCreateEntityElement(entity) {
    if (this.entityElements.has(entity.id)) {
      return this.entityElements.get(entity.id);
    }

    const element = document.createElement("article");
    element.className =
      "entity-frame animate-fade-in absolute left-0 top-0 flex items-start gap-3 text-slate-100 transition-transform duration-150";

    const figureElement = document.createElement("div");
    figureElement.dataset.role = "entity-figure";
    figureElement.className =
      "entity-figure flex h-20 w-20 items-center justify-center";

    const iconElement = document.createElement("div");
    iconElement.dataset.role = "entity-icon";
    iconElement.className =
      "entity-icon flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5";
    figureElement.appendChild(iconElement);

    const cardElement = document.createElement("section");
    cardElement.dataset.role = "entity-card";
    cardElement.className =
      "process-node entity-card flex flex-1 flex-col justify-between rounded-2xl p-4 text-slate-100";

    const typeElement = document.createElement("p");
    typeElement.dataset.role = "entity-type";
    typeElement.className =
      "text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400";

    const titleElement = document.createElement("h3");
    titleElement.dataset.role = "entity-title";
    titleElement.className = "mt-2 text-base font-semibold text-white";

    const stateElement = document.createElement("span");
    stateElement.dataset.role = "entity-state";
    stateElement.className =
      "inline-flex w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-200";

    const detailsElement = document.createElement("ul");
    detailsElement.dataset.role = "entity-details";
    detailsElement.className = "mt-3 space-y-1 text-xs text-slate-300";

    const itemsElement = document.createElement("div");
    itemsElement.dataset.role = "entity-items";
    itemsElement.className = "mt-3 flex flex-wrap gap-2";

    const tagsElement = document.createElement("div");
    tagsElement.dataset.role = "entity-tags";
    tagsElement.className = "flex flex-wrap gap-2";

    const footerElement = document.createElement("div");
    footerElement.dataset.role = "entity-footer";
    footerElement.className =
      "mt-3 flex flex-wrap items-center justify-between gap-3";

    cardElement.appendChild(typeElement);
    cardElement.appendChild(titleElement);
    cardElement.appendChild(detailsElement);
    cardElement.appendChild(itemsElement);
    footerElement.appendChild(tagsElement);
    footerElement.appendChild(stateElement);
    cardElement.appendChild(footerElement);

    element.appendChild(figureElement);
    element.appendChild(cardElement);

    this.viewport.appendChild(element);
    this.entityElements.set(entity.id, element);

    return element;
  }

  // Aqui solo se leen props visuales por si cada modulo quiere verse distinto sin meter logica en el renderer
  getEntityLayout(entity) {
    const visualVariant = entity.visualVariant ?? "process";
    const useUnifiedCard = this.useUnifiedCardSize(visualVariant);

    return {
      x: Number.isFinite(entity.x) ? entity.x : 24,
      y: Number.isFinite(entity.y) ? entity.y : 24,
      width: useUnifiedCard
        ? UNIFIED_CARD_SIZE.width
        : Number.isFinite(entity.width)
          ? entity.width
          : DEFAULT_ENTITY_SIZE.width,
      height: useUnifiedCard
        ? UNIFIED_CARD_SIZE.height
        : Number.isFinite(entity.height)
          ? entity.height
          : DEFAULT_ENTITY_SIZE.height,
    };
  }

  // Esto ajusta el tamano del mundo para que los escenarios grandes no queden montados o cortados
  syncWorldSize(entities) {
    const padding = 120;
    let maxRight = 960;
    let maxBottom = 620;

    for (const entity of entities) {
      const layout = this.getEntityLayout(entity);
      maxRight = Math.max(maxRight, layout.x + layout.width + padding);
      maxBottom = Math.max(maxBottom, layout.y + layout.height + padding);
    }

    this.viewport.style.width = `${maxRight}px`;
    this.viewport.style.height = `${maxBottom}px`;
  }

  // Esto cambia clases segun el estado para que el css haga el resto del trabajo visual
  applyStateClasses(element, state) {
    const cardElement = element.querySelector("[data-role='entity-card']");
    const target = cardElement ?? element;

    target.classList.remove(
      "is-running",
      "is-blocked",
      "is-waiting",
      "is-stopped",
      "animate-process-pulse",
    );

    if (state === "running") {
      target.classList.add("is-running", "animate-process-pulse");
      return;
    }

    if (state === "blocked") {
      target.classList.add("is-blocked");
      return;
    }

    if (state === "stopped") {
      target.classList.add("is-stopped");
      return;
    }

    target.classList.add("is-waiting");
  }

  // Esto cambia la pinta general segun el tipo de elemento que se este mostrando
  applyVariantClasses(element, visualVariant) {
    const figureElement = element.querySelector("[data-role='entity-figure']");
    const iconElement = element.querySelector("[data-role='entity-icon']");
    const cardElement = element.querySelector("[data-role='entity-card']");
    const targets = [element, figureElement, iconElement, cardElement].filter(
      Boolean,
    );

    for (const target of targets) {
      target.classList.remove(
        "variant-process",
        "variant-airplane",
        "variant-tower",
        "variant-panel",
        "variant-pipe",
        "variant-queue",
        "variant-link",
        "variant-agent",
        "variant-passenger",
        "variant-baggage",
        "variant-signal",
      );
    }

    for (const target of targets) {
      target.classList.add(`variant-${visualVariant ?? "process"}`);
    }
  }

  // Aqui se decide el estado que se muestra para que la vista vaya acorde con el engine
  getVisualState(entity, engine) {
    if (entity.state === "stopped") {
      return "stopped";
    }

    if (entity.state === "blocked") {
      return "blocked";
    }

    if (!engine?.isRunning) {
      return "waiting";
    }

    return entity.state ?? "waiting";
  }

  // Esto actualiza el panel lateral con datos generales para que la interfaz se sienta viva
  updateHud(engine, entity = null) {
    if (this.statusElement) {
      this.statusElement.textContent = engine?.isRunning
        ? "Corriendo"
        : "Pausado";
    }

    if (this.speedElement && engine) {
      this.speedElement.textContent = `${engine.speed.toFixed(1)}x`;
    }

    if (this.activeModuleElement && entity?.moduleName) {
      this.activeModuleElement.textContent = entity.moduleName;
    }

    if (this.moduleDescriptionElement && engine?.moduleMeta?.description) {
      this.moduleDescriptionElement.textContent = engine.moduleMeta.description;
    }

    if (this.entityCountElement && engine) {
      this.entityCountElement.textContent = `${engine.entities.length}`;
    }
  }

  // Esto solo pone el texto un poco mas amigable para mostrarlo en pantalla
  formatStateLabel(state) {
    const labels = {
      running: "Running",
      blocked: "Blocked",
      waiting: "Waiting",
      stopped: "Stopped",
    };

    return labels[state] ?? state;
  }

  // Esto normaliza lo que se pinta sin obligar a que las entidades sepan del DOM
  getRenderData(entity) {
    return {
      label: entity.label ?? entity.name ?? entity.id,
      type: entity.type ?? "Proceso",
      detailLines: entity.detailLines ?? [],
      itemList: entity.itemList ?? [],
      detailLimit: entity.detailLimit,
      tags: entity.tags ?? [],
      visualVariant: entity.visualVariant ?? "process",
      ...this.getIconData(entity.visualVariant ?? "process"),
    };
  }

  getDetailLimit(visualVariant) {
    return this.isCompactVariant(visualVariant) ? 1 : 2;
  }

  getTagLimit(visualVariant) {
    return this.isCompactVariant(visualVariant) ? 1 : 2;
  }

  isStaticVariant(visualVariant) {
    return ["link", "pipe", "queue", "panel", "signal"].includes(visualVariant);
  }

  useUnifiedCardSize(visualVariant) {
    return ["airplane", "passenger", "agent", "baggage"].includes(
      visualVariant,
    );
  }

  isCompactVariant(visualVariant) {
    return ["link", "signal", "pipe", "queue", "panel"].includes(visualVariant);
  }

  isPlainVariant(visualVariant) {
    return visualVariant === "link";
  }

  // Esto ordena capas para que fondos y mensajes no tapen procesos principales
  getLayerIndex(visualVariant) {
    const layers = {
      link: 2,
      panel: 3,
      queue: 3,
      pipe: 3,
      tower: 5,
      airplane: 6,
      baggage: 6,
      passenger: 6,
      agent: 6,
      signal: 7,
      process: 4,
    };

    return layers[visualVariant] ?? 4;
  }

  // Esto mete una pista rapida de que representa cada tarjeta
  getIconData(visualVariant) {
    const icons = {
      airplane: { iconLabel: "Avion" },
      tower: { iconLabel: "Torre de control" },
      panel: { iconLabel: "Panel de vuelos" },
      pipe: { iconLabel: "Scanner o pipe" },
      queue: { iconLabel: "Cola de mensajes" },
      passenger: { iconLabel: "Pasajero" },
      agent: { iconLabel: "Agente" },
      baggage: { iconLabel: "Equipaje" },
      signal: { iconLabel: "Senal o alerta" },
      link: { iconLabel: "Canal de mensaje" },
      process: { iconLabel: "Proceso" },
    };

    return {
      ...(icons[visualVariant] ?? icons.process),
      iconSvg: this.getIconSvg(visualVariant),
    };
  }

  // Estos svg simples ayudan a que cada entidad se entienda mas rapido que con texto suelto
  getIconSvg(visualVariant) {
    const svgs = {
      airplane:
        '<svg viewBox="0 0 24 24" class="h-14 w-14" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11L2 15L5.40833 16.3633C6.42474 16.7699 7.2301 17.5753 7.63667 18.5917L9 22L13 20L11.7896 17.5792C11.3385 16.677 11.6298 15.5802 12.469 15.0207L14 14L18 21L21 17L18.7106 9.53101L19.4247 8.81689C20.8365 7.40523 22.135 5.13486 20.5 3.5C18.865 1.86514 16.5903 3.15941 15.1841 4.5766L14.4644 5.28519L7 3.00001L3 6L10 10L8.97936 11.531C8.41986 12.3702 7.32299 12.6615 6.42083 12.2104L4 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      tower:
        '<svg viewBox="0 0 15 15" class="h-14 w-14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 12.5H11.5L10 9V7C10.9951 7 10.9951 6.25 10.9951 6.25L11.5 3C11.5 3 11.5 2.5 11 2.5H10C10 2.5 10 2 9.5 2H8.5V1.5C8.5 1.5 8.5 0.5 7.5 0.5C6.5 0.5 6.5 1.5 6.5 1.5V2H5.5C5 2 5 2.5 5 2.5H4C3.5 2.5 3.5 3 3.5 3L4.0049 6.25C4.0049 6.25 4.0049 7 5 7V9L3.5 12.5H3C3 12.5 2 12.5 2 13.25C2 14 3 14 3 14H12C12 14 13 14 13 13.25C13 12.5 12 12.5 12 12.5ZM10.25 3.5L10 5H5L4.75 3.4971L10.25 3.5ZM8.5 7V8H6.5V7H8.5ZM6.5006 9.4971H8.4994L9.5 12.5H5.5L6.5006 9.4971Z" fill="currentColor"/></svg>',
      passenger:
        '<svg viewBox="0 0 16 16" class="h-14 w-14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><circle cx="8" cy="6" r="3.25"/><path d="m2.75 14.25c0-2.5 2-5 5.25-5s5.25 2.5 5.25 5"/></svg>',
      agent:
        '<svg viewBox="-2 0 24 24" class="h-14 w-14" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="m18.845 17.295c-1.008-1.345-2.437-2.327-4.089-2.754l-.051-.011-1.179 1.99c-.002.552-.448.998-1 1-.55 0-1-.45-1.525-1.774 0-.009 0-.021 0-.032 0-.691-.56-1.25-1.25-1.25s-1.25.56-1.25 1.25v.033-.002c-.56 1.325-1.014 1.774-1.563 1.774-.552-.002-.998-.448-1-1l-1.142-1.994c-1.702.44-3.13 1.421-4.126 2.746l-.014.019c-.388.629-.628 1.386-.655 2.197v.007c.005.15 0 .325 0 .5v2c0 1.105.895 2 2 2h15.5c1.105 0 2-.895 2-2v-2c0-.174-.005-.35 0-.5-.028-.817-.268-1.573-.666-2.221l.011.02zm-14.345-12.005c0 2.92 1.82 7.21 5.25 7.21 3.37 0 5.25-4.29 5.25-7.21 0-.019 0-.042 0-.065 0-2.9-2.351-5.25-5.25-5.25s-5.25 2.351-5.25 5.25v.068z" fill="currentColor"/></svg>',
      baggage:
        '<svg viewBox="0 0 64 64" class="h-14 w-14" aria-hidden="true"><rect x="16" y="20" width="32" height="28" rx="6" fill="currentColor"/><path d="M25 20v-4c0-4 3-6 7-6s7 2 7 6v4" stroke="currentColor" stroke-width="4" fill="none"/></svg>',
      panel:
        '<svg viewBox="0 0 64 64" class="h-14 w-14" aria-hidden="true"><rect x="12" y="12" width="40" height="40" rx="6" fill="currentColor"/><path d="M20 24h24M20 32h24M20 40h16" stroke="rgba(15,23,42,.85)" stroke-width="4"/></svg>',
      pipe: '<svg viewBox="0 0 64 64" class="h-14 w-14" aria-hidden="true"><rect x="10" y="24" width="44" height="16" rx="8" fill="currentColor"/><circle cx="16" cy="32" r="4" fill="rgba(15,23,42,.85)"/><circle cx="32" cy="32" r="4" fill="rgba(15,23,42,.65)"/><circle cx="48" cy="32" r="4" fill="rgba(15,23,42,.45)"/></svg>',
      queue:
        '<svg viewBox="0 0 64 64" class="h-14 w-14" aria-hidden="true"><circle cx="18" cy="24" r="6" fill="currentColor"/><circle cx="32" cy="24" r="6" fill="currentColor"/><circle cx="46" cy="24" r="6" fill="currentColor"/><path d="M14 44h36" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>',
      signal:
        '<svg viewBox="0 0 64 64" class="h-14 w-14" aria-hidden="true"><path d="M32 12 50 48H14L32 12Z" fill="currentColor"/><path d="M32 24v10M32 40h.1" stroke="rgba(15,23,42,.9)" stroke-width="4" stroke-linecap="round"/></svg>',
      link: '<svg viewBox="0 0 64 64" class="h-12 w-12" aria-hidden="true"><path d="M14 24h20l-5-5m5 5-5 5M50 40H30l5-5m-5 5 5 5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
      process:
        '<svg viewBox="0 0 64 64" class="h-14 w-14" aria-hidden="true"><rect x="16" y="16" width="32" height="32" rx="8" fill="currentColor"/></svg>',
    };

    return svgs[visualVariant] ?? svgs.process;
  }
}
