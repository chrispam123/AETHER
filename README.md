# AETHER
### *El primer editor de pensamiento basado en termodinámica cognitiva*

> *«Escribir no es registrar palabras que ya estaban completas en la mente; escribir es el proceso mediante el cual el caos se condensa en materia legible.»*

---

## 🌌 Visión y Filosofía

La mayoría de los editores modernos tratan el texto como una superficie estática y plana. **Aether** nace de una premisa ontológica diferente: **el pensamiento se comporta como la materia**, transitando por estados continuos de densidad termodinámica según el grado de energía y enfoque del autor:

```
    [ NIEBLA ]          ⇌          [ FLUIDO ]          ⇌         [ CRISTAL ]
   (Vapor difuso)                (Corriente viva)               (Materia sólida)
 Chispas, caos libre           Estructura, puentes            Prosa pulida, ritmo
y notas estocásticas               y narrativa                y foco monástico
```

- ☁️ **Fase Niebla (Vapor):** Espacio infinito donde las ideas nacen como chispas sin orden aparente. Repulsión física suave, dispersión y captura rápida sin la tiranía de la estructura.
- 💧 **Fase Fluido (Líquido):** Las ideas se agrupan en corrientes. Se trazan puentes gravitatorios, relaciones causales y un río continuo de bloques que prepara el flujo argumental.
- 💎 **Fase Cristal (Sólido):** La materia se fija. Un santuario editorial monástico de basalto oscuro y tipografía clásica donde la palabra se talla con silencio, ritmo y métricas de lectura.

---

## 🏛️ Principios de Arquitectura

1. **Local-First Soberano:**
   Tus pensamientos pertenecen únicamente a tu máquina. Todo se persiste localmente en **IndexedDB** a través de un catálogo multiobra atómico. Sin dependencias externas invasivas, sin telemetría y con capacidad 100% *offline*.

2. **Rendimiento a 120 FPS:**
   Renderizado híbrido que combina la aceleración gráfica de **HTML5 Canvas 2D** con la accesibilidad y selección nativa de un **DOM Projection Bridge**.

3. **Acústica Procedural Sagrada:**
   Un sintetizador armónico nativo construido sobre la **Web Audio API** genera paisajes sonoros orgánicos en tiempo real (ruido marrón fractal, lluvia tenue y resonancias de cuenco tibetano a 432 Hz / 528 Hz).

4. **El Archivo de la Memoria (`Alt + O`):**
   Cajón de invocación rápida que recupera obras completas con física de condensación: entra como niebla difusa (`blur: 28px`) y se solidifica en cristal nítido (`blur: 0px`) al fijarse en la pantalla.

5. **Interoperabilidad Universal:**
   - **Formato `.aether`:** Respaldo topológico íntegro en JSON (nodos, conexiones, coordenadas, descartes y cámara).
   - **Transpilador Markdown `.md` nativo:** Motor semántico de cero dependencias que extrae la prosa en Markdown puro con frontmatter YAML.

---

## ⌨️ Atajos de Teclado Litúrgicos

| Atajo | Contexto | Acción |
| :--- | :--- | :--- |
| **`Alt + O`** | Santuario de Bienvenida | Invoca / Cierra **El Archivo de la Memoria** con condensación de niebla |
| **`Ctrl + P`** | Modo Cristal | Abre la **Prensa Editorial** (Imprimir / Guardar PDF / Markdown / .aether) |
| **`Ctrl + S`** | Universal | Guardado atómico inmediato con confirmación armónica |
| **`Alt + Z`** | Modo Cristal | Alterna el **Enfoque Monástico** (oculta métricas y croma circundante) |
| **`Ctrl + Shift + E`** | Universal | Exporta descarga directa de respaldo topológico `.aether` |
| **`Ctrl + Shift + M`** | Universal | Exporta transpilación limpia a Markdown `.md` con YAML |
| **`Ctrl + Shift + O`** | Universal | Abre el diálogo de importación de archivo `.aether` |
| **`Esc`** | Modales / Archivo | Cierra el cajón o ventana activa y devuelve el foco |

---

## 🚀 Inicio Rápido para Desarrolladores

### Requisitos previos
- **Node.js** v18.0 o superior
- **npm**, **pnpm** o **yarn**

### Instalación y arranque local

```bash
# 1. Clonar el repositorio
git clone https://github.com/chrispam123/AETHER.git
cd AETHER

# 2. Instalar dependencias
npm install

# 3. Iniciar entorno de desarrollo
npm run dev
```

Abre tu navegador en `http://localhost:3000` para entrar al Santuario.

### Compilación para producción

```bash
# Valida TypeScript y genera el bundle optimizado en /dist
npm run build
```

---

## 📂 Estructura del Proyecto

```
AETHER/
├── index.html                  # Lienzo de las 3 capas: Canvas, DOM y Santuario
├── src/
│   ├── main.ts                 # Orquestador del ciclo de vida y eventos globales
│   ├── core/                   # Modelo ontológico puro y máquina de estados
│   │   ├── StateMachine.ts     # Transiciones termodinámicas (portal ⇌ niebla ⇌ fluido ⇌ cristal)
│   │   ├── types.ts            # Definiciones de tipo soberanas
│   │   └── graph/              # Grafo de pensamiento (nodos y puentes)
│   ├── engine/                 # Renderizador Canvas 2D y zoom semántico
│   ├── ui/                     # Capa de interfaz de usuario
│   │   ├── portal/             # Santuario de Bienvenida y tríptico de orbes
│   │   ├── archive/            # El Archivo de la Memoria (Alt + O)
│   │   ├── sanctuary/          # Editor editorial, prensa y transpilador Markdown
│   │   └── margin/             # Canal de descartes (virutas de pensamiento)
│   ├── storage/                # Motor Local-First (IndexedDB y exportadores)
│   ├── audio/                  # Sintetizador procedural orgánico (Web Audio API)
│   └── styles/                 # Sistema de diseño de basalto, croma y tipografía
└── package.json
```

---

## 📜 Licencia

MIT © 2026 Aether Authors. Diseñado para el libre pensamiento y la concentración monástica.
