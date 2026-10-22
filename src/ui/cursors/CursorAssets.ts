/**
 * ============================================================================
 * CAPA 3: CURSORES ARTESANALES VECTORIALES (BESPOKE CURSOR ASSETS)
 * ============================================================================
 * Define los cursores vectoriales SVG artesanales para resolver la ambigüedad de escala:
 * 1. Mano Cósmica (Macro / Lienzo): Trazo etéreo minimalista para mover el cosmos.
 * 2. Mano Táctil (Micro / Tarjetas): Silueta compacta de pinza/agarre para levantar ideas.
 * Incluye halos de contraste para visibilidad sobre sustratos oscuros y puntos de anclaje (hotspots).
 */

function encodeSvg(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

// 1. MANO CÓSMICA ABIERTA (Navegación del Lienzo en Reposo)
const SVG_COSMIC_OPEN = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <filter id="shadow" x="-2" y="-2" width="32" height="32" filterUnits="userSpaceOnUse">
    <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.8"/>
  </filter>
  <g filter="url(#shadow)">
    <!-- Silueta etérea de la mano abierta con trazo mineral -->
    <path d="M12 4C12 3.44772 12.4477 3 13 3C13.5523 3 14 3.44772 14 4V10.5M14 6C14 5.44772 14.4477 5 15 5C15.5523 5 16 5.44772 16 6V11M16 8C16 7.44772 16.4477 7 17 7C17.5523 7 18 7.44772 18 8V12M10 7C10 6.44772 10.4477 6 11 6C11.5523 6 12 6.44772 12 7V12M7.5 11C7.5 10.4477 7.94772 10 8.5 10C9.05228 10 9.5 10.4477 9.5 11V15C9.5 17.5 11.5 21 14.5 21C18 21 20 18.5 20 15V11C20 9.5 19 8.5 18 8.5" 
          stroke="#0d0e12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 4C12 3.44772 12.4477 3 13 3C13.5523 3 14 3.44772 14 4V10.5M14 6C14 5.44772 14.4477 5 15 5C15.5523 5 16 5.44772 16 6V11M16 8C16 7.44772 16.4477 7 17 7C17.5523 7 18 7.44772 18 8V12M10 7C10 6.44772 10.4477 6 11 6C11.5523 6 12 6.44772 12 7V12M7.5 11C7.5 10.4477 7.94772 10 8.5 10C9.05228 10 9.5 10.4477 9.5 11V15C9.5 17.5 11.5 21 14.5 21C18 21 20 18.5 20 15V11C20 9.5 19 8.5 18 8.5" 
          stroke="#d2cec4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Micro-orbe cósmico en la palma -->
    <circle cx="14" cy="15.5" r="1.5" fill="#a0c0b5" opacity="0.9"/>
  </g>
</svg>
`;

// 2. MANO CÓSMICA CERRADA (Arrastre del Lienzo)
const SVG_COSMIC_CLOSED = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <filter id="shadow" x="-2" y="-2" width="32" height="32" filterUnits="userSpaceOnUse">
    <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.8"/>
  </filter>
  <g filter="url(#shadow)">
    <!-- Silueta de la mano cerrada con agarre cósmico -->
    <path d="M10 11C9.44772 11 9 11.4477 9 12V14C9 17 11 19.5 14 19.5C17 19.5 19 17 19 14V12C19 11.4477 18.5523 11 18 11M10 11H18M10 11V9C10 8.44772 10.4477 8 11 8H17C17.5523 8 18 8.44772 18 9V11" 
          stroke="#0d0e12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 11C9.44772 11 9 11.4477 9 12V14C9 17 11 19.5 14 19.5C17 19.5 19 17 19 14V12C19 11.4477 18.5523 11 18 11M10 11H18M10 11V9C10 8.44772 10.4477 8 11 8H17C17.5523 8 18 8.44772 18 9V11" 
          stroke="#b8b2a5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Orbe activado de energía en el puño -->
    <circle cx="14" cy="14" r="2.2" fill="#7ea895"/>
  </g>
</svg>
`;

// 3. MANO TÁCTIL (PINZA / MANIPULACIÓN DE TARJETAS EN REPOSO)
const SVG_TACTILE_PINCH = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <filter id="shadow" x="-2" y="-2" width="32" height="32" filterUnits="userSpaceOnUse">
    <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" flood-color="#000000" flood-opacity="0.9"/>
  </filter>
  <g filter="url(#shadow)">
    <!-- Silueta de pinza precisa: índice y pulgar listos para levantar la tarjeta -->
    <path d="M5 5L10 10M10 10L14 7L18 11L14 15L10 10M10 10L6 14L9 17L13 14" 
          stroke="#0d0e12" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 5L10 10M10 10L14 7L18 11L14 15L10 10M10 10L6 14L9 17L13 14" 
          stroke="#f0ece1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Joya mineral en la punta del dedo que toca el bloque -->
    <circle cx="5" cy="5" r="2" fill="#e2d7c3" stroke="#0d0e12" stroke-width="0.8"/>
  </g>
</svg>
`;

// 4. MANO TÁCTIL (AGARRE FIRME DURANTE EL ARRASTRE DE TARJETA)
const SVG_TACTILE_GRIP = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
  <filter id="shadow" x="-2" y="-2" width="32" height="32" filterUnits="userSpaceOnUse">
    <feDropShadow dx="0" dy="1.2" stdDeviation="1.8" flood-color="#000000" flood-opacity="0.95"/>
  </filter>
  <g filter="url(#shadow)">
    <!-- Silueta cerrada de sujeción gravitatoria -->
    <path d="M6 6L11 11M11 11L15 8L17 12L13 15L11 11M11 11L7 14L10 17L13 14" 
          stroke="#0d0e12" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 6L11 11M11 11L15 8L17 12L13 15L11 11M11 11L7 14L10 17L13 14" 
          stroke="#dfcfb8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Pulso dorado al sostener la masa del pensamiento -->
    <circle cx="6" cy="6" r="2.4" fill="#d4af37" stroke="#0d0e12" stroke-width="0.8"/>
  </g>
</svg>
`;

export const CURSORS = {
  // Cursor cósmico para mover el espacio (Hotspot en el centro de la palma: 14, 14)
  COSMIC_OPEN: `url('${encodeSvg(SVG_COSMIC_OPEN)}') 14 14, grab`,
  COSMIC_CLOSED: `url('${encodeSvg(SVG_COSMIC_CLOSED)}') 14 14, grabbing`,

  // Cursor táctil para interactuar con las tarjetas (Hotspot en la yema superior: 5, 5)
  TACTILE_PINCH: `url('${encodeSvg(SVG_TACTILE_PINCH)}') 5 5, pointer`,
  TACTILE_GRIP: `url('${encodeSvg(SVG_TACTILE_GRIP)}') 6 6, grabbing`
};
