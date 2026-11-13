/**
 * @module qr
 * @description Generador de códigos QR propio (nivel de corrección M), sin librerías externas, para las etiquetas de las estanterías.
 */
/* =====================================================================
   Generador de códigos QR sin dependencias externas.
   Codifica texto (UTF-8) en modo byte con corrección de errores nivel M,
   que tolera ~15 % de daño: suficiente para etiquetas pegadas en estanterías.
   Basado en la especificación ISO/IEC 18004 (mismo esquema que el
   generador de referencia de Project Nayuki).
   ===================================================================== */

const ECC_POR_BLOQUE_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
  26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOQUES_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

/**
 * @param {number} ver versión del QR.
 * @returns {number} módulos disponibles para datos en esa versión.
 */
function modulosDatosBrutos(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

/**
 * @param {number} ver versión del QR.
 * @returns {number} bytes de datos que caben con el nivel M.
 */
function codewordsDatos(ver) {
  return Math.floor(modulosDatosBrutos(ver) / 8) - ECC_POR_BLOQUE_M[ver] * BLOQUES_M[ver];
}

/**
 * Multiplicación en el cuerpo de Galois GF(256), la base de la corrección de errores Reed-Solomon.
 * @param {number} x primer factor.
 * @param {number} y segundo factor.
 * @returns {number} producto.
 */
function multGF(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/**
 * @param {number} grado número de bytes de corrección.
 * @returns {number[]} polinomio divisor de Reed-Solomon.
 */
function divisorRS(grado) {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < grado; j++) {
      r[j] = multGF(r[j], raiz);
      if (j + 1 < grado) r[j] ^= r[j + 1];
    }
    raiz = multGF(raiz, 0x02);
  }
  return r;
}

/**
 * Calcula los bytes de corrección de un bloque de datos.
 * @param {number[]} datos bytes del bloque.
 * @param {number[]} divisor polinomio de Reed-Solomon.
 * @returns {number[]} bytes de corrección.
 */
function restoRS(datos, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of datos) {
    const factor = b ^ r.shift();
    r.push(0);
    divisor.forEach((coef, i) => { r[i] ^= multGF(coef, factor); });
  }
  return r;
}

/**
 * @param {number} x número.
 * @param {number} i posición del bit.
 * @returns {boolean} si ese bit vale 1.
 */
function bit(x, i) { return ((x >>> i) & 1) !== 0; }

/** Devuelve una matriz booleana (true = módulo oscuro) para el texto dado. */
export function generarQR(texto) {
  const bytes = Array.from(new TextEncoder().encode(texto));

  let ver = 0;
  for (let v = 1; v <= 40; v++) {
    const bitsCuenta = v < 10 ? 8 : 16;
    if (4 + bitsCuenta + bytes.length * 8 <= codewordsDatos(v) * 8) { ver = v; break; }
  }
  if (!ver) throw new Error('Texto demasiado largo para un código QR');

  // --- Flujo de bits: modo byte + longitud + datos + terminador + relleno
  const bits = [];
  const anadir = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  anadir(0b0100, 4);
  anadir(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => anadir(b, 8));
  const capacidad = codewordsDatos(ver) * 8;
  anadir(0, Math.min(4, capacidad - bits.length));
  anadir(0, (8 - (bits.length % 8)) % 8);
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) anadir(relleno, 8);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // --- Corrección de errores e intercalado de bloques
  const numBloques = BLOQUES_M[ver];
  const eccLen = ECC_POR_BLOQUE_M[ver];
  const brutos = Math.floor(modulosDatosBrutos(ver) / 8);
  const cortos = numBloques - (brutos % numBloques);
  const largoCorto = Math.floor(brutos / numBloques);
  const div = divisorRS(eccLen);
  const bloques = [];
  for (let i = 0, k = 0; i < numBloques; i++) {
    const dat = datos.slice(k, k + largoCorto - eccLen + (i < cortos ? 0 : 1));
    k += dat.length;
    const ecc = restoRS(dat, div);
    if (i < cortos) dat.push(0);
    bloques.push(dat.concat(ecc));
  }
  const final = [];
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((b, j) => {
      if (i !== largoCorto - eccLen || j >= cortos) final.push(b[i]);
    });
  }

  // --- Matriz y patrones de función
  const tam = ver * 4 + 17;
  const mod = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fun = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijar = (x, y, oscuro) => { mod[y][x] = oscuro; fun[y][x] = true; };

  for (let i = 0; i < tam; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }

  const buscador = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx; const yy = y + dy;
        if (xx >= 0 && xx < tam && yy >= 0 && yy < tam) fijar(xx, yy, d !== 2 && d !== 4);
      }
    }
  };
  buscador(3, 3); buscador(tam - 4, 3); buscador(3, tam - 4);

  const alin = [];
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const paso = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    alin.push(6);
    for (let i = 0, p = tam - 7; i < n - 1; i++, p -= paso) alin.splice(1, 0, p);
  }
  const ult = alin.length - 1;
  alin.forEach((px, i) => alin.forEach((py, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ult) || (i === ult && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) fijar(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));

  const dibujarFormato = (mascara) => {
    const dato = (0 << 3) | mascara; // nivel M = 00
    let rem = dato;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((dato << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(f, i));
    fijar(8, 7, bit(f, 6)); fijar(8, 8, bit(f, 7)); fijar(7, 8, bit(f, 8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(f, i));
    for (let i = 0; i < 8; i++) fijar(tam - 1 - i, 8, bit(f, i));
    for (let i = 8; i < 15; i++) fijar(8, tam - 15 + i, bit(f, i));
    fijar(8, tam - 8, true);
  };
  dibujarFormato(0);

  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = tam - 11 + (i % 3); const b = Math.floor(i / 3);
      fijar(a, b, bit(v, i)); fijar(b, a, bit(v, i));
    }
  }

  // --- Colocar los datos en zigzag
  let i = 0;
  for (let der = tam - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let vert = 0; vert < tam; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = der - j;
        const subiendo = ((der + 1) & 2) === 0;
        const y = subiendo ? tam - 1 - vert : vert;
        if (!fun[y][x] && i < final.length * 8) {
          mod[y][x] = bit(final[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }

  // --- Elegir la máscara con menor penalización
  const aplicarMascara = (m) => {
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        if (fun[y][x]) continue;
        let inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (inv) mod[y][x] = !mod[y][x];
      }
    }
  };

  const penalizacion = () => {
    let p = 0;
    const lineas = (get) => {
      for (let a = 0; a < tam; a++) {
        let racha = 1;
        for (let b = 1; b <= tam; b++) {
          if (b < tam && get(a, b) === get(a, b - 1)) racha++;
          else { if (racha >= 5) p += racha - 2; racha = 1; }
        }
        // Patrón tipo buscador 1:1:3:1:1 con margen claro
        for (let b = 0; b + 10 < tam; b++) {
          const s = [];
          for (let k = 0; k < 11; k++) s.push(get(a, b + k) ? 1 : 0);
          const t = s.join('');
          if (t === '10111010000' || t === '00001011101') p += 40;
        }
      }
    };
    lineas((y, x) => mod[y][x]);
    lineas((x, y) => mod[y][x]);
    let oscuros = 0;
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        if (mod[y][x]) oscuros++;
        if (x < tam - 1 && y < tam - 1) {
          const c = mod[y][x];
          if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
        }
      }
    }
    const total = tam * tam;
    p += Math.ceil(Math.abs(oscuros * 20 - total * 10) / total - 1) * 10;
    return p;
  };

  let mejor = 0; let mejorP = Infinity;
  for (let m = 0; m < 8; m++) {
    aplicarMascara(m); dibujarFormato(m);
    const p = penalizacion();
    if (p < mejorP) { mejorP = p; mejor = m; }
    aplicarMascara(m); // deshace (XOR)
  }
  aplicarMascara(mejor); dibujarFormato(mejor);
  return mod;
}

/** Crea un elemento <svg> con el QR (con margen blanco de 4 módulos). */
export function qrSVG(texto, { margen = 4, titulo = '' } = {}) {
  const m = generarQR(texto);
  const tam = m.length + margen * 2;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${tam} ${tam}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  if (titulo) {
    const t = document.createElementNS(NS, 'title');
    t.textContent = titulo;
    svg.appendChild(t);
  }
  const fondo = document.createElementNS(NS, 'rect');
  fondo.setAttribute('width', tam); fondo.setAttribute('height', tam); fondo.setAttribute('fill', '#fff');
  svg.appendChild(fondo);
  let d = '';
  m.forEach((fila, y) => fila.forEach((osc, x) => { if (osc) d += `M${x + margen} ${y + margen}h1v1h-1z`; }));
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', '#000');
  svg.appendChild(path);
  return svg;
}
