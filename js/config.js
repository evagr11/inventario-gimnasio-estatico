/**
 * @module config
 * @description Configuración de la web: textos, logo, origen de los datos (demo o Google Sheets), dirección pública para los QR y materiales por página.
 */
/* =====================================================================
   CONFIGURACIÓN — es el único archivo que hay que tocar para poner la
   web en marcha. Las instrucciones paso a paso están en MANUAL.md.
   ===================================================================== */

/**
 * Opciones de la web. Es el único archivo que hay que tocar para ponerla en marcha.
 * @type {Object}
 */
export const CONFIG = {
  // Textos de la cabecera
  centro: 'IES Lacimurga',
  subtitulo: 'Constantia Iulia',
  titulo: 'Almacén del gimnasio',

  // Logo del instituto (opcional). Sube el archivo a la carpeta img/ con este nombre.
  // Si no existe, se muestra el nombre del centro en texto.
  logo: 'img/logo.png',

  // ¿De dónde salen los datos?
  //   'demo'   → archivos de ejemplo de la carpeta datos/ (para probar)
  //   'google' → tu hoja de Google Sheets publicada en la web
  fuente: 'google',

  // Solo si fuente = 'google'.
  // 1) En la hoja: Archivo → Compartir → Publicar en la web → Documento completo → CSV → Publicar.
  // 2) Pega aquí el enlace que te da Google (el que termina en /pub?output=csv).
  googleUrlPublicada: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrwFpc7wyNjKO9mZXvsygaFw6fZG1iRciCAQn3bgH8NmdmVKM2YwRgHZAUf4NNXCi5XwtUfrZ7RlpW/pub?output=csv',
  // 3) El número "gid" de cada pestaña: haz clic en la pestaña y mira el final de la
  //    dirección del navegador (…#gid=123456789). La primera pestaña suele ser 0.
  googleGids: {
    materiales: '0',
    existencias: '1',
    categorias: '2',
    estados: '3',
    ubicaciones: '4',
  },

  // Dirección pública de la web, usada en los códigos QR.
  // Déjala vacía para usar automáticamente la dirección desde la que se abre la página.
  // Rellénala (p. ej. 'https://ieslacimurga.github.io/inventario-gimnasio/') antes de imprimir
  // etiquetas si las generas desde otra dirección (por ejemplo, desde tu ordenador).
  urlPublica: 'https://ieslacimurga.github.io/inventario-gimnasio/',

  // Materiales por página en el listado
  porPagina: 15,
};
