# 🛫 Simulador de Comunicación Entre Procesos (IPC)

Simulador visual e interactivo de los principales mecanismos de IPC (Inter-Process Communication), ambientado en un aeropuerto. Cada módulo representa un escenario distinto que ilustra cómo los procesos se comunican y sincronizan dentro de un sistema operativo.

[![Ver simulador](https://img.shields.io/badge/🚀%20Ver%20Simulador-GitHub%20Pages-blue?style=for-the-badge)](https://sebastianmoreno0911.github.io/IPC/)
[![Repositorio](https://img.shields.io/badge/📁%20Repositorio-GitHub-black?style=for-the-badge)](https://github.com/SebastianMoreno0911/AlgoritmoSincronizacion)

---

## 📋 Descripción

Este simulador fue desarrollado como parte del **Taller Unidad 2 - Laboratorio 3** de la asignatura de Sistemas Operativos. El objetivo es representar visualmente el comportamiento de cinco mecanismos de IPC a través de escenarios con temática de aeropuerto, permitiendo observar paso a paso cómo interactúan los procesos.

---

## ✈️ Módulos del simulador

| Módulo | Escenario | Descripción |
|---|---|---|
| **Signals** | 🚨 Alerta de emergencia | Una señal global se emite una sola vez y todos los procesos reaccionan al mismo tiempo |
| **Pipes** | 🏭 Banda transportadora | Un proceso escribe en un buffer limitado y otro proceso lee en orden FIFO |
| **Memoria compartida** | 🖥️ Panel de vuelos | Varios procesos acceden y actualizan una misma zona de memoria sin copiar datos |
| **Sockets** | 🗼 Torre de control y aviones | Comunicación bidireccional directa entre dos extremos conectados |
| **Queue** | 🎫 Check-In del aeropuerto | Solicitudes organizadas en cola, el consumidor las atiende en orden de llegada |
| **Full** | 🌐 Vista completa | Todos los módulos activos simultáneamente en un solo escenario |

---

## 🎮 Controles del simulador

| Control | Función |
|---|---|
| **Start** | Inicia la simulación del módulo activo |
| **Pause** | Pausa la ejecución en el estado actual |
| **Step** | Avanza la simulación un paso a la vez (útil para analizar el comportamiento) |
| **Módulo** | Cambia entre los diferentes mecanismos IPC |
| **Velocidad** | Ajusta la velocidad de simulación (por defecto 1.0x) |
| **Activar emergencia** | Dispara una señal global a todos los procesos activos |
| **Panel de eventos** | Muestra en tiempo real los logs y cambios de estado del motor |

---

## 🚀 Cómo ejecutar localmente

### Requisitos
- Navegador moderno (Chrome, Firefox, Edge)
- Extensión **Live Server** para VS Code, o cualquier servidor HTTP local

### Pasos

1. Clona el repositorio:
```bash
git clone https://github.com/SebastianMoreno0911/AlgoritmoSincronizacion.git
```

2. Abre la carpeta en **Visual Studio Code**

3. Haz clic derecho sobre `index.html` y selecciona **"Open with Live Server"**

4. El simulador se abrirá automáticamente en tu navegador en `http://127.0.0.1:5500`

> ⚠️ No abras `index.html` directamente con doble clic. Necesita un servidor local para cargar correctamente los módulos JavaScript.

---

## 🌐 Demo en línea

Puedes ver el simulador sin instalar nada en el siguiente enlace:

🔗 **https://sebastianmoreno0911.github.io/IPC/**

---

## 🗂️ Estructura del proyecto

```
AlgoritmoSincronizacion/
│
├── index.html          # Página principal del simulador
├── js/                 # Lógica de cada módulo IPC
│   ├── ...             # Archivos JavaScript por módulo
└── .gitignore
```

---

## 📚 Conceptos representados

### 🔔 Señales (Signals)
Mecanismo de notificación asíncrona. Un proceso emisor envía un aviso global y múltiples procesos receptores reaccionan al mismo tiempo. No transportan datos complejos, solo el evento en sí.

### 🔧 Tuberías (Pipes)
Canal unidireccional con comportamiento FIFO. El proceso escritor deposita datos y el proceso lector los consume en el mismo orden. Si el buffer se llena, el escritor se bloquea; si está vacío, el lector espera.

### 🧠 Memoria compartida (Shared Memory)
El mecanismo más rápido de IPC. Varios procesos acceden directamente a una misma zona de memoria sin copiar datos. Requiere sincronización para evitar condiciones de carrera.

### 🔌 Sockets
Comunicación bidireccional entre dos extremos. Permite intercambio de mensajes de ida y vuelta, simulando el modelo cliente-servidor entre la torre de control y los aviones.

### 📬 Colas de mensajes (Message Queue)
Los procesos depositan mensajes en una cola común y otros los consumen en orden. Desacopla al emisor del receptor, permitiendo que trabajen a ritmos distintos.

---

## 🛠️ Tecnologías

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)

---

## 👤 Autor

**JSMM**
- Universidad Santiago de Cali
- Ingeniería de Sistemas
