# Temario: el universo de temas de LaTeX

Mapa de **conciencia y priorización**. No es para cubrir todo, sino para *saber
qué existe*, **dónde estamos parados**, qué priorizar y **en qué documento** de
la [suite](README.md) va cada tema (o si amerita un documento propio).

Cada categoría trae un **Panorama** (la variedad de enfoques/decisiones que
existen dentro del tema) y una **tabla de estado**.

## Cómo leer este documento

- **Estado:** ✅ cubierto · 🟡 parcial · ⬜ no contemplado todavía.
- **Destino:** documento de la suite donde debería vivir
  (1 Quickstart · 2 Cheat sheet · 3 Matemática · 4 Beamer · 5 Estándares ·
  6 Plantillas) o **★** = candidato a **documento propio**.
- **Prioridad** (para un estudiante de matemática): 🔴 alta · 🟡 media · ⚪ baja.

> Tabla viva: al escribir cada documento, sus temas pasan a ✅. Lo ⬜ no implica
> "hay que hacerlo", sino "tenerlo en el radar".

---

## Estado de un vistazo

- **Bien cubierto hoy:** matemática (símbolos, entornos, teoremas, cálculo),
  base de preámbulo/estándares, fundamentos de Beamer.
- **Grandes huecos (mayor retorno):** **graficar funciones**, **numeración y
  contadores**, **tablas avanzadas**, **bibliografía**, **documentos largos**,
  **flujo/herramientas**.
- **Candidatos a documento propio (★):** Gráficos y figuras · Bibliografía ·
  Documentos largos · Tablas avanzadas · (avanzado) Programación y automatización ·
  Flujo de trabajo · Ejercicios/exámenes.

---

## 1. Estructura y clases de documento

**Panorama.** Lo primero de todo es *qué tipo de documento* es, porque define
todo lo demás:
- **Clase según propósito:** `article` (TPs, papers), `report` (con capítulos),
  `book` (libros), `letter`/`scrlttr2` (cartas), `beamer` (presentaciones),
  `standalone` (una figura suelta).
- **Alternativas "premium":** **KOMA-Script** (`scrartcl`/`scrreprt`/`scrbook`,
  mejor diseño por defecto) y `memoir` (todo-en-uno); clases de revista
  (`IEEEtran`, `acmart`), CV (`moderncv`), póster (`tikzposter`), examen (`exam`).
- **Jerarquía de seccionado:** `\part` › `\chapter` (solo report/book) ›
  `\section` › `\subsection` › `\subsubsection` › `\paragraph`; `\appendix`.
- **Partes de un libro:** `\frontmatter` / `\mainmatter` / `\backmatter`.
- **Modularización** (docs grandes): `\input` (pega texto), `\include` (capítulos
  + `\includeonly`), paquete `subfiles` (compilar cada parte sola).
- **Opciones de clase:** tamaño de letra, `a4paper`, `twoside`, `twocolumn`,
  `fleqn`/`leqno`, `draft`.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Clases básicas (`article`, `report`, `book`, `letter`) | 🟡 | 5 | 🔴 |
| `beamer` (presentaciones) | 🟡 | 4 | 🔴 |
| `standalone` (figuras sueltas) | ⬜ | ★Gráficos | 🟡 |
| KOMA-Script, `memoir` | ⬜ | ★Docs largos | 🟡 |
| Clases especiales (`exam`, CV, póster, revistas) | ⬜ | ★ varios | ⚪ |
| Jerarquía de seccionado y `\appendix` | ⬜ | ★Docs largos | 🟡 |
| front/main/back matter | ⬜ | ★Docs largos | ⚪ |
| Modularización (`\input`/`\include`/`subfiles`) | ⬜ | ★Docs largos | 🟡 |
| Opciones de clase | 🟡 | 5 | 🟡 |

## 2. Numeración y contadores

**Panorama.** El "cómo se numera" son varias decisiones **independientes**:
- **Reinicio vs continuo:** `\newtheorem{teo}{Teorema}[section]` reinicia el
  contador en cada sección (2.1, 2.2, 3.1…); sin `[section]` es continuo (1, 2,
  3…); con `[chapter]` reinicia por capítulo.
- **Contador compartido:** `\newtheorem{lema}[teo]{Lema}` → Teorema 2.1, **Lema
  2.2**, Teorema 2.3 (una sola secuencia). *(Cubierto en doc 3.)*
- **Contadores independientes:** numeraciones paralelas (Teorema 1… / Definición
  1… / Ejemplo 1…).
- **Sin numerar:** `\newtheorem*{obs}{Observación}` (típico en observaciones y a
  veces ejercicios).
- **Ecuaciones:** `\numberwithin{equation}{section}` → (2.1); `subequations` →
  (2.1a), (2.1b); `\tag` para etiqueta a medida.
- **Profundidad:** `secnumdepth` (hasta qué nivel se numeran las secciones),
  `tocdepth` (hasta qué nivel aparecen en el índice).
- **Páginas:** `\pagenumbering{roman/arabic}` (prólogo en romano, cuerpo en
  arábigo).
- **Contadores propios:** `\newcounter`, `\stepcounter`, `\the…`, formatos
  (`\arabic`/`\roman`/`\alph`/`\Roman`/`\Alph`).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `secnumdepth` / `tocdepth` | ⬜ | 5 / ★Docs largos | 🟡 |
| Contadores propios (`\newcounter`, formatos) | ⬜ | 3 / 5 | 🟡 |
| Teoremas: compartido vs independiente | ✅ | 3 | 🔴 |
| Teoremas: reinicio por sección/capítulo | 🟡 | 3 | 🔴 |
| Ecuaciones: `\numberwithin`, `subequations`, `\tag` | 🟡 | 3 | 🟡 |
| Figuras/tablas/notas: reinicio por capítulo | ⬜ | ★Docs largos | 🟡 |
| Numeración de páginas | ⬜ | ★Docs largos | 🟡 |
| Listas: continuar/reiniciar, etiquetas (`enumitem`) | ⬜ | 5 | 🟡 |

## 3. Matemática

**Panorama.** El núcleo está cubierto en el documento 3. La variedad restante es
sobre todo de **dominios específicos**:
- **Núcleo (cubierto):** modos, símbolos, alfabetos, operadores, delimitadores,
  matrices, alineación, cálculo, teoremas, `siunitx`.
- **Notación avanzada:** `physics` (derivadas/brackets cómodos), `braket`,
  tensores, `mathtools` avanzado (`\prescript`, multi-line).
- **Diagramas:** conmutativos (`tikz-cd`, cubierto), árboles de demostración
  (`bussproofs`/`ebproof`), Young tableaux (`ytableau`).
- **Química/física:** `mhchem`, diagramas de Feynman (`tikz-feynman`).
- **Matrices/tablas matemáticas modernas:** `nicematrix`.
- **Fuentes matemáticas:** `unicode-math` (solo Xe/Lua).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Núcleo (símbolos, entornos, cálculo, teoremas) | ✅ | 3 | 🔴 |
| `physics`, `braket`, tensores | ⬜ | 3 | ⚪ |
| `nicematrix` | ⬜ | 3 / ★Tablas | 🟡 |
| Árboles de demostración | ⬜ | ⚪ | ⚪ |
| `unicode-math` (Xe/Lua) | ⬜ | 5 | ⚪ |

## 4. Gráficos y figuras

**Panorama — graficar funciones 2D (de menos a más potente):**
1. **`pgfplots` con expresión:** `\addplot[domain=-3:3,samples=100]{x^2};` en un
   `axis`. Lo estándar: ejes, rangos, **leyendas**, varias curvas, marcar puntos,
   rellenar áreas (integrales), asíntotas, ejes log, anotaciones.
2. **`pgfplots` desde datos:** `\addplot table {datos.dat};` / `pgfplotstable`
   (graficar mediciones).
3. **TikZ a mano:** `\draw plot (\x,{f(\x)})` — más control, menos comodidad.
4. **Backend gnuplot:** `\addplot gnuplot {sin(x)};` (gnuplot + shell-escape).
5. **Calculado por fuera:** `pythontex`/`sagetex` (Python/Sage) → pgfplots.
6. **Otros sistemas:** Asymptote, MetaPost.

**Panorama — resto de gráficos/figuras:**
- **Imágenes:** `graphicx` + `\includegraphics` (escala, recorte, formatos).
- **Dibujo vectorial:** TikZ (nodos, paths, estilos, decenas de librerías).
- **Diagramas:** flujos, **árboles** (`forest`), autómatas, mapas mentales;
  dominio (`circuitikz`, `chemfig`).
- **Geometría:** `tkz-euclide` (construcciones euclidianas).
- **3D:** `pgfplots` (superficies `surf`/`mesh`).
- **Posicionamiento:** entorno `figure`, `[H]` (`float`), `caption`/`subcaption`
  (subfiguras), `wrapfig` (texto alrededor), `rotating` (apaisada).
- **Velocidad:** externalización de TikZ (cachear cada figura como PDF).

> **Dónde:** grande y transversal → fuerte candidato a **documento propio
> "Gráficos y figuras" (★)**. Lo usamos en las Actividades 4 y 6 pero nunca lo
> documentamos como tema.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Insertar imágenes (`graphicx`) | 🟡 | 4 / ★Gráficos | 🔴 |
| **Graficar funciones 2D** (`pgfplots`) | ⬜ | ★Gráficos | 🔴 |
| Datos desde archivo (`pgfplotstable`) | ⬜ | ★Gráficos | 🟡 |
| 3D / superficies | ⬜ | ★Gráficos | ⚪ |
| TikZ (nodos, paths, librerías) | 🟡 | ★Gráficos | 🟡 |
| Diagramas (`forest`, autómatas, flujos) | ⬜ | ★Gráficos | 🟡 |
| Posicionamiento (`float`, `caption`, `subcaption`, `wrapfig`) | ⬜ | ★Gráficos | 🟡 |
| Externalización | ⬜ | 5 | ⚪ |

## 5. Tablas

**Panorama.** La regla de oro es **`booktabs`** (solo `\toprule/\midrule/
\bottomrule`, sin líneas verticales). A partir de ahí:
- **Ancho automático:** `tabularx` (columnas `X`), `tabulary`.
- **Combinar celdas:** `\multicolumn`, `multirow`, `makecell` (saltos en celda).
- **Números alineados por el decimal:** columna `S` de `siunitx`.
- **Tablas largas** (cruzan páginas): `longtable`, `xtab`.
- **Color de filas:** `colortbl` / `\rowcolors`.
- **Desde datos:** `csvsimple`, `pgfplotstable` (tabla desde `.csv`).
- **Moderno todo-en-uno:** `nicematrix` (tablas y matrices, reglas finas, color).
- **Notas dentro de la tabla:** `threeparttable`.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `tabular` + `booktabs` | 🟡 | 5 / ★Tablas | 🔴 |
| Ancho automático (`tabularx`) | ⬜ | ★Tablas | 🟡 |
| Multifila/columna (`multirow`, `makecell`) | ⬜ | ★Tablas | 🟡 |
| Alinear por decimal (`siunitx` `S`) | ⬜ | ★Tablas | 🟡 |
| Tablas largas (`longtable`) | ⬜ | ★Tablas | 🟡 |
| Color (`colortbl`) | 🟡 | ★Tablas | ⚪ |
| Desde datos (`csvsimple`/`pgfplotstable`) | ⬜ | ★Tablas | ⚪ |
| `nicematrix` | ⬜ | ★Tablas | 🟡 |

## 6. Tipografía y diseño de página

**Panorama.**
- **Fuentes:** familias de texto (`lmodern`, `newtx`, `libertinus`) y de
  matemática; en Xe/Lua, `fontspec` + `unicode-math` (fuentes del sistema).
- **Calidad:** `microtype` (protrusión/expansión).
- **Márgenes:** `geometry` (no tocar `\textwidth` a mano).
- **Encabezados/pies:** `fancyhdr` (o `scrlayer-scrpage` en KOMA).
- **Estilo de títulos e índice:** `titlesec`, `titletoc`, `tocloft`.
- **Párrafos/interlineado:** `parskip` (espacio en vez de sangría), `setspace`
  (1.5/doble), `multicol` (varias columnas), `lettrine` (capitular).
- **Listas a medida:** `enumitem`.
- **Saltos y huérfanas/viudas:** `\clearpage`, `\needspace`, penalties.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Fuentes y encoding | ✅ | 5 | 🔴 |
| `microtype` | ✅ | 5 | 🔴 |
| Márgenes (`geometry`) | 🟡 | 5 | 🟡 |
| Encabezados/pies | ⬜ | ★Docs largos | 🟡 |
| Títulos/índice (`titlesec`/`tocloft`) | ⬜ | ★Docs largos | ⚪ |
| Interlineado/párrafos | ⬜ | 5 / ★Docs largos | 🟡 |
| Multicolumna (`multicol`) | 🟡 | 2 | 🟡 |
| Listas (`enumitem`) | ⬜ | 5 | 🟡 |

## 7. Referencias, enlaces y navegación

**Panorama.**
- **Referencias internas:** `\label`/`\ref`; **`cleveref`** (`\cref` agrega el
  tipo); `varioref` ("en la página siguiente"); `nameref` (nombre de la sección).
- **Enlaces y PDF:** `hyperref` (clicables, **marcadores**, metadatos,
  formularios).
- **Índices de contenido:** `\tableofcontents`, `\listoffigures`,
  `\listoftables`; personalizar con `tocloft`/`etoc`; `minitoc` (índice por
  capítulo).
- **Índice alfabético:** `makeidx`/`imakeidx` + `\index`.
- **Glosarios y acrónimos:** `glossaries`, `acronym`.
- **Nomenclatura:** `nomencl` (lista de símbolos).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `\label`/`\ref`, `cleveref`, `varioref` | ✅ | 3 / 5 | 🔴 |
| `hyperref` (enlaces, marcadores, metadatos) | ✅ | 5 | 🔴 |
| ToC/LoF/LoT, `tocloft`/`minitoc` | 🟡 | ★Docs largos | 🟡 |
| Índice alfabético (`imakeidx`) | ⬜ | ★Docs largos | ⚪ |
| Glosarios/acrónimos/nomenclatura | ⬜ | ★Docs largos | ⚪ |

## 8. Bibliografía y citas

**Panorama.** Hay **dos mundos**:
- **Moderno:** `biblatex` + **biber** — flexible, internacionalizado,
  `\addbibresource`, `\printbibliography`, comandos `\textcite`/`\parencite`.
- **Clásico:** `natbib` + **bibtex** — todavía exigido por algunas revistas.
- **Estilos de cita:** numérico, autor-año, alfabético, `ieee`, `apa`,
  `chicago`.
- **Decisiones:** ordenar/agrupar, multi-bibliografía (por capítulo/tema),
  back-references, manejo de DOI/URL, exportar desde Zotero/Mendeley.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `biblatex` + biber | 🟡 | ★Bibliografía | 🔴 |
| `natbib` / bibtex | ⬜ | ★Bibliografía | 🟡 |
| Estilos (numeric/authoryear/IEEE/APA) | ⬜ | ★Bibliografía | 🟡 |
| Gestión `.bib`, multi-biblio, DOI | ⬜ | ★Bibliografía | ⚪ |

## 9. Código y algoritmos

**Panorama.**
- **Texto literal:** `verbatim`, `\verb`, `fancyvrb` (más control).
- **Código resaltado:** `listings` (sin dependencias; lo que usamos) vs `minted`
  (Pygments, mejor resaltado, requiere `-shell-escape`).
- **Pseudocódigo:** `algorithm2e` o `algorithmicx`/`algpseudocode`.
- **Cajas bonitas de código:** `tcolorbox` (con `listings`/`minted`).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `listings` | ✅ | 5 | 🟡 |
| `minted` | 🟡 | 5 | ⚪ |
| Pseudocódigo (`algorithm2e`) | ⬜ | ★ | 🟡 |
| Cajas de código (`tcolorbox`) | ⬜ | ⚪ | ⚪ |

## 10. Presentaciones (Beamer) — doc 4

**Panorama.**
- **Estructura:** `frame`, secciones, `\appendix`, `allowframebreaks`.
- **Contenido:** bloques (`block`/`alertblock`/`exampleblock`), columnas,
  `[fragile]` para código.
- **Aparición por pasos (overlays):** `\pause`, `<n->`, `\only`, `\uncover`,
  `\alt`, `\temporal`.
- **Aspecto:** temas (`Madrid`, `metropolis`/`moloch`), color/font/inner/outer
  themes; `beamerposter` (pósters).
- **Salida:** `handout` (sin overlays), notas del orador, `pgfpages` (varias por
  hoja), multimedia (`animate`).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `frame`, bloques, columnas, temas | ✅ | 4 | 🔴 |
| Overlays | 🟡 | 4 | 🔴 |
| `[fragile]`, `handout`, notas | 🟡 | 4 | 🟡 |
| Temas modernos, `beamerposter` | ⬜ | 4 | ⚪ |
| Animaciones/multimedia | ⬜ | ⚪ | ⚪ |

## 11. Cajas, marcos y resaltado

**Panorama.**
- **Básicas:** `\fbox`, `\framebox`, `\parbox`, `minipage`, `\boxed` (math).
- **Ricas:** **`tcolorbox`** (cajas con título, color, partes; **teoremas con
  caja**), `mdframed` (marcos que cruzan páginas), `framed`.
- **Uso típico:** destacar definiciones/resultados, "cajas de atención", code
  boxes.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `\fbox`/`minipage`/`\boxed` | 🟡 | 3 / 5 | 🟡 |
| `tcolorbox` (cajas ricas, teoremas) | ⬜ | ★ | 🟡 |
| `mdframed`/`framed` | ⬜ | ⚪ | ⚪ |

## 12. Listas

**Panorama.**
- **Tipos:** `itemize` (viñetas), `enumerate` (numeradas), `description`
  (término–definición).
- **Personalización (`enumitem`):** espaciado (`noitemsep`), etiquetas a medida
  (`label=`), **continuar** una lista (`resume`), anidado.
- **Variantes:** listas en línea (`[inline]`), `tasks` (en grilla), checklists.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `itemize`/`enumerate`/`description` | 🟡 | 1 / 5 | 🔴 |
| Personalización/anidado (`enumitem`) | ⬜ | 5 | 🟡 |
| Listas en línea, `tasks` | ⬜ | ⚪ | ⚪ |

## 13. Programación, automatización y compilación condicional

**¿LaTeX es un lenguaje de programación?** Sí: **TeX es Turing-completo** (se
puede computar cualquier cosa, aunque de forma incómoda por su modelo de
*expansión* de macros). En la práctica hay varias formas de meter lógica
algorítmica, de lo más nativo a lo más cómodo.

**A) Lógica algorítmica nativa (dentro de LaTeX/TeX)**
- Macros LaTeX2e (`\newcommand`…) y primitivas TeX (`\def`, `\expandafter`,
  **catcodes**, expansión).
- **`expl3`** (LaTeX3): variables tipadas (`\tl`/`\int`/`\seq`/`\prop`/`\clist`),
  funciones — el lenguaje de programación moderno de LaTeX.
- Comandos con args ricos: `\NewDocumentCommand` (`xparse`).
- Lógica/bucles: `etoolbox` (`\ifboolexpr`, toggles), `\foreach`, `forloop`.
- Cálculo: `calc`, `pgfmath`, `xfp` (punto flotante).

**B) Lenguaje Turing-completo embebido (lo más potente)**
- **LuaLaTeX** trae **Lua** completo vía `\directlua`/`luacode`: un lenguaje de
  scripting real con acceso a las tripas de TeX. Es *la* opción para lógica
  algorítmica seria sin sufrir el modelo de expansión.

**C) Inyectar otros lenguajes (literate programming)**
- **`pythontex`** — corre **Python** durante la compilación y captura
  resultados/figuras (genial para matemática: SymPy, NumPy, Matplotlib).
- **`sagetex`** — **Sage** (álgebra y cálculo simbólico).
- **`knitr`/Sweave** — **R** (estadística), documentos "literate".
- **gnuplot** — gráficos calculados (backend de pgfplots).
- **`\write18` / shell-escape** — ejecutar cualquier comando externo (hay que
  **habilitarlo**; cuidado por seguridad).

**D) Compilación condicional y variantes de salida**
- Banderas propias: `\newif\ifsoluciones … \soluciones true … \ifsoluciones …
  \fi` (p. ej. versión **alumno vs docente**, con/sin soluciones, desde un mismo
  fuente).
- `etoolbox` (`\newtoggle`/`\iftoggle`), `ifthen`.
- Incluir/excluir bloques: paquetes `comment`, `versions`, `optional`.
- Compilar solo partes: `\includeonly{…}`.
- Un fuente → varias salidas: beamer `presentation` vs `handout`; `exam` con/sin
  clave; pasar un flag por línea de comando o por `\jobname`.
- `draft` vs `final` (opción de clase): marca overfull y dibuja imágenes como
  recuadro (compila más rápido).

**E) Escribir tus propios paquetes/clases y depurar**
- `.sty`/`.cls` propios (`\ProvidesPackage`/`\ProvidesClass`), documentación
  literada `.dtx`/`DocStrip`.
- Depuración: `\typeout`, `\show`, `\meaning`, `\tracingmacros`, paquete `trace`.

> **Dónde:** lo básico (macros, `xparse`, **condicional simple**) en Estándares
> (5) — y la compilación condicional con/sin soluciones es muy útil para TPs; el
> resto (expl3, Lua, pythontex, paquetes propios) → **doc propio "Programación y
> automatización" (★)**.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Macros y entornos, semánticas | ✅ | 3 / 5 | 🔴 |
| `xparse`/`\NewDocumentCommand` | ⬜ | 5 | 🟡 |
| **Compilación condicional** (banderas, con/sin soluciones) | ⬜ | 5 / ★Programación | 🟡 |
| Primitivas TeX (`\def`, catcodes, expansión) | ⬜ | ★Programación | ⚪ |
| Lógica/bucles/cálculo (`etoolbox`, `pgfmath`, `xfp`) | ⬜ | ★Programación | ⚪ |
| `expl3` (variables tipadas), hooks (`\AddToHook`) | ⬜ | ★Programación | ⚪ |
| **Lua** (`\directlua`, Turing-completo) | ⬜ | ★Programación | ⚪ |
| Inyectar lenguajes (`pythontex`/`sagetex`/`knitr`) | ⬜ | ★Programación | 🟡 |
| Escribir paquetes/clases (`.dtx`/`.sty`) + debug | ⬜ | ★Programación | ⚪ |

## 14. Idioma e internacionalización

**Panorama.**
- **Idioma:** `babel` (pdf/Xe/Lua) con opciones `spanish` y `es-noshorthands`
  (evita que `"`, `~`, `.` rompan tikz/URLs); en Xe/Lua, `polyglossia`.
- **Comillas:** `csquotes` + `\enquote{}` (según idioma).
- **Fechas:** `datetime2`.
- **Multilingüe / otros alfabetos:** cambio de idioma, RTL (`bidi`), CJK, escrituras
  no latinas (vía `fontspec` en Xe/Lua).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| `babel` (spanish, `es-noshorthands`), `csquotes` | ✅ | 5 | 🔴 |
| `polyglossia` (Xe/Lua) | ⬜ | 5 | ⚪ |
| Fechas, multilingüe, RTL/CJK | ⬜ | ⚪ | ⚪ |

## 15. Flujo, herramientas, instalación y reproducibilidad

**Panorama — Distribuciones e instalación (con sus opciones y problemáticas):**
- **MiKTeX** (Windows; también Linux/Mac): liviana, **instala paquetes al vuelo**
  la primera vez que se usan. Gestor: `mpm` / MiKTeX Console.
- **TeX Live** (multiplataforma, el estándar): completa; *esquemas* de
  instalación (`scheme-full` ~varios GB vs `scheme-basic`). Gestor: **`tlmgr`**.
  En macOS viene como **MacTeX**.
- **Overleaf** (en la nube): **cero instalación**, siempre actualizado,
  colaborativo. La salida fácil si instalar localmente es un dolor.
- **Reproducible (CI/Docker):** imágenes `texlive/texlive`, **GitHub Actions**
  para compilar; fijar versiones de paquetes.

**Problemáticas típicas de instalación (qué sale mal):**
- **Paquete faltante:** MiKTeX lo ofrece instalar; en TeX Live, `tlmgr install`.
- **Versión desfasada / mezcla:** p. ej. `siunitx` nuevo con `l3kernel` viejo →
  errores `\l__…` (**nos pasó**). Solución: actualizar el kernel/`expl3`.
- **Archivos bloqueados** (Windows): un proceso (el editor compilando) traba el
  `.fndb` y el update falla → cerrar/matar el proceso TeX (**también nos pasó**).
- **Fuentes:** bitmaps borrosos si falta `lmodern`/`cm-super`.
- **Permisos, elección de mirror, proxy, espacio en disco** (TeX Live full es
  grande); `texdoc` para leer la documentación offline.

**Resto del flujo:**
- **Motor:** pdf/xe/lua. **Automatizar:** `latexmk` (pasadas, biber, índices),
  `arara`, `make`; `.latexmkrc`, carpeta de salida, `-pvc` (recompila al guardar).
- **Editores/IDE:** TeXstudio, **VS Code + LaTeX Workshop**, Overleaf, Emacs/AUCTeX.
- **Versionado:** git, `.gitignore`, **`latexdiff`** (diff de versiones).
- **Diagnóstico:** `nag`, `l2tabu`, leer el `.log`.
- **Velocidad:** externalización TikZ, `draft`, preámbulo precompilado
  (`mylatexformat`).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| **Distribuciones** (MiKTeX / TeX Live / Overleaf / MacTeX) | 🟡 | 1 / 5 | 🔴 |
| **Instalar/actualizar paquetes** (`mpm` / `tlmgr`), problemáticas | 🟡 | 1 / 5 | 🟡 |
| Compilar (motores, `latexmk`, `arara`, `-pvc`) | 🟡 | 1 / 5 | 🔴 |
| `.latexmkrc`, build dir, shell-escape | ⬜ | 5 | 🟡 |
| Editores/IDE | 🟡 | 1 | 🟡 |
| Git, `.gitignore`, `latexdiff` | 🟡 | ★Flujo | 🟡 |
| Reproducibilidad (Docker, CI/GitHub Actions, pin de versiones) | ⬜ | ★Flujo | ⚪ |
| Diagnóstico (`nag`, `l2tabu`, log) | ✅ | 5 | 🟡 |
| Velocidad (externalización, `draft`, precompilado) | ⬜ | 5 | ⚪ |

## 16. Documentos especiales

**Panorama.** Cada uno es casi un mundo con su clase/paquetes:
- **Tesina/informe largo:** `report`/KOMA, capítulos, índices, bibliografía,
  carátula institucional.
- **Exámenes y ejercicios con soluciones:** `exam` (puntajes, claves),
  `probsoln`/`answers` (banco de problemas, mostrar/ocultar soluciones).
- **CV/currículum:** `moderncv`, `altacv`.
- **Pósters:** `tikzposter`, `beamerposter`.
- **Cartas:** `scrlttr2`.
- **Apuntes/handouts:** article + tcolorbox, o beamer en `handout`.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Tesina/informe largo | ⬜ | ★Docs largos | 🟡 |
| Exámenes/ejercicios con soluciones | ⬜ | ★Ejercicios | 🟡 |
| CV, pósters, cartas | ⬜ | ⚪ | ⚪ |

## 17. Accesibilidad y PDF

**Panorama.**
- **PDF accesible:** `tagpdf` / PDF/UA (etiquetado, texto alternativo en figuras)
  — el LaTeX moderno avanza fuerte acá.
- **Archivado:** PDF/A (`pdfx`).
- **Buenas prácticas:** contraste suficiente, no codificar información **solo**
  por color, metadatos del PDF (`hyperref`).

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| PDF etiquetado (`tagpdf`/PDF-UA), alt text | ⬜ | 5 | ⚪ |
| PDF/A (`pdfx`) | ⬜ | ⚪ | ⚪ |
| Contraste / no depender solo del color | 🟡 | 5 | 🟡 |

## 18. Publicación, conversión e interoperabilidad

**Panorama.** LaTeX no vive aislado; se convierte a/desde otros formatos:
- **A otros formatos:** **`pandoc`** (LaTeX ↔ Markdown ↔ HTML ↔ **Word/`docx`** ↔
  EPUB), `make4ht`/`tex4ht` (LaTeX → HTML/MathML), **LaTeXML** (→ HTML5/MathML,
  el que usa arXiv).
- **Math en la web:** **MathJax**/**KaTeX** renderizan sintaxis LaTeX en HTML.
- **Generación masiva (mail merge):** `datatool`/`csvsimple` — cartas,
  certificados, exámenes personalizados desde un `.csv`.
- **Formularios PDF interactivos:** `hyperref` forms.
- **Presentaciones alternativas:** `powerdot`, o beamer → HTML.
- **Gestores de bibliografía:** exportar `.bib` desde Zotero/JabRef/Mendeley.

| Tema | Estado | Destino | Prio |
|------|:------:|:-------:|:----:|
| Conversión (`pandoc`, `tex4ht`, LaTeXML) | ⬜ | ★Publicación | 🟡 |
| Math en web (MathJax/KaTeX) | ⬜ | ⚪ | ⚪ |
| Mail merge (`datatool`/`csvsimple`) | ⬜ | ⚪ | ⚪ |
| Formularios PDF | ⬜ | ⚪ | ⚪ |

---

## Contexto: el ecosistema TeX (para orientarse)

Cosas transversales, útiles para no perderse:
- **CTAN** tiene ~6000 paquetes. Para encontrar el correcto: buscar en
  `ctan.org`, `texdoc <paquete>` (doc offline), o "LaTeX package for X".
- **Variantes/formatos de TeX:** *plain TeX* (bajo nivel), **LaTeX** (lo que
  usamos), **ConTeXt** (alternativa a LaTeX, muy potente en diseño), y la
  evolución **LaTeX2e → LaTeX3/`expl3`**.
- **El "LaTeX moderno"** (kernel reciente): sistema de **hooks** (`\AddToHook`),
  **PDF etiquetado** (proyecto de accesibilidad), `\DocumentMetadata`.
- **Pedir ayuda bien:** preparar un **MWE** (*minimal working example*) —
  el documento más chico que reproduce el problema. Clave en TeX.SE.
- **Seguridad:** `shell-escape` ejecuta comandos del sistema; por eso está
  restringido por defecto. No compiles fuentes no confiables con `-shell-escape`.
- **Licencia de paquetes:** la mayoría usa **LPPL** (LaTeX Project Public License).

---

## Cómo usar este temario

1. **Para priorizar:** mirá las filas 🔴 que están en ⬜/🟡 — ahí está el mayor
   retorno (hoy: graficar funciones, numeración, tablas, bibliografía).
2. **Para ubicar:** la columna *Destino* dice en qué documento va; los **★** son
   candidatos a documento propio.
3. **Para decidir documentos nuevos:** aplicá los
   [criterios del README](README.md#criterios-para-sumar-un-documento-nuevo).
4. **Mantenelo vivo:** al terminar un documento, pasá sus temas a ✅.
