/**
 * @module csv
 * @description Lectura de CSV y exportación para Excel.
 */
/* =====================================================================
   Lector de CSV (RFC 4180): comillas, comas y saltos de línea dentro de
   celdas, BOM inicial y finales de línea de Windows.
   ===================================================================== */

/**
 * Lee un CSV (RFC 4180): comillas, comas y saltos de línea dentro de celdas, BOM inicial y finales de línea de Windows.
 * @param {string} texto contenido del CSV.
 * @returns {string[][]} filas no vacías, cada una con sus celdas.
 */
export function parsearCSV(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  const filas = [];
  let fila = [];
  let celda = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++; } else entreComillas = false;
      } else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/** Convierte un CSV con cabecera en objetos { columna: valor } (columnas normalizadas). */
export function csvAObjetos(texto) {
  const filas = parsearCSV(texto);
  if (!filas.length) return [];
  const cab = filas[0].map(normalizarClave);
  return filas.slice(1).map((f, idx) => {
    const o = { _fila: idx + 2 }; // número de fila tal como se ve en la hoja
    cab.forEach((k, i) => { if (k) o[k] = (f[i] ?? '').trim(); });
    return o;
  });
}

/** "Fotos extra" → "fotos_extra"; "Ubicación" → "ubicacion". */
export function normalizarClave(s) {
  return quitarAcentos(String(s).trim().toLowerCase()).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Quita tildes y diéresis.
 * @param {string} s texto.
 * @returns {string} texto sin acentos.
 */
export function quitarAcentos(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Genera CSV para Excel en español: separador ';' y BOM para que respete los acentos. */
export function aCSVExcel(filas) {
  const esc = (v) => {
    let s = v == null ? '' : String(v);
    // Evita inyección de fórmulas al abrir el archivo en Excel
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + filas.map((f) => f.map(esc).join(';')).join('\r\n');
}
