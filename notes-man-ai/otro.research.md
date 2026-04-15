
El documento propone cuatro capas:

Taxonomía documental de LaTeX
Clases: article, report, book, beamer, memoir, amsart, exam.
Entornos y estructuras: theorem, lemma, definition, remark, proof, align, equation, cases, gather.
Modularidad: \input, \include, xr, archivos .aux, bibliografía y preámbulo.
Objetivo: reconocer estructura documental y dependencias internas.
Taxonomía semántica
Tipos de texto por propósito: guía de ejercicios, apuntes, trabajo práctico, examen, tesis/ensayo, paper de investigación.
Objetivo: inferir qué objetos semánticos son esperables en cada tipo de documento.
Ejemplo:
en exámenes: preguntas, puntajes, opciones, calificación;
en papers: teoremas, lemas, definiciones, demostraciones, citas;
en tesis o apuntes: capítulos, jerarquía conceptual, ejemplos, observaciones.
Capa técnica y de interoperabilidad
Metadatos editoriales: título, autores, afiliaciones, resumen, MSC, DOI, ORCID.
Ontologías: OntoMathPro / OntoMathEdu como posible base de clasificación.
Estándares: JATS XML, CrossRef, OAI-PMH.
Extracción: grafo de dependencias, desambiguación contextual, análisis de estructura espacial, linting semántico.
Capa de productividad de autoría
Extraer y proponer templates tipo ejemplo para que el usuario empiece rápido a redactar.
No solo detectar qué clase de documento es, sino sugerir esqueletos reutilizables según la intención del usuario.
Ejemplos de templates:
guía de ejercicios con encabezado, lista numerada y sección de soluciones;
paper con abstract, introducción, teoremas, pruebas y bibliografía;
tesis con capítulos, secciones, modularidad y referencias cruzadas;
examen con preguntas, puntajes, espacio para respuestas y criterios;
apunte con definición, ejemplo, observación y ejercicio.
Objetivo: convertir la taxonomía en una herramienta concreta de arranque, no solo de análisis.
