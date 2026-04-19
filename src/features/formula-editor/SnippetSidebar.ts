import { LitElement, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '@preact/signals-core'
import { activeNodePos, insertNewFormulaAndActivate } from '@core/editor/EditorStore'

/* ─────────────────────────────────────────────────────────────────
   SnippetSidebar — Phase 2
   Collapsed: favorites as quick buttons with slot badges 0–9.
   Expanded: favorites section + search + category tabs + full list.
   ───────────────────────────────────────────────────────────────── */

const SB_KEY  = 'formalia:sidebar:collapsed'
const FAV_KEY = 'formalia:snippet-favorites'
const MAX_FAVS = 16

// ── Snippet data ─────────────────────────────────────────────────

interface Snippet { icon: string; cat: string; label: string; t: string }

const SNIPPETS: Snippet[] = [
  // ── Fracciones / básicos ──────────────────────────────────────────
  { icon: 'a/b',  cat: 'frac',  label: 'Fracción',        t: '\\frac{#@}{#?}'                          },
  { icon: '√',    cat: 'frac',  label: 'Raíz cuad.',      t: '\\sqrt{#@}'                              },
  { icon: 'ⁿ√',   cat: 'frac',  label: 'Raíz n-ésima',    t: '\\sqrt[#?]{#@}'                          },
  { icon: 'xⁿ',   cat: 'frac',  label: 'Potencia',        t: '{#@}^{#?}'                               },
  { icon: 'xₙ',   cat: 'frac',  label: 'Subíndice',       t: '{#@}_{#?}'                               },
  { icon: '()',    cat: 'frac',  label: 'Paréntesis',      t: '\\left( #@ \\right)'                     },
  { icon: '[]',   cat: 'frac',  label: 'Corchetes',       t: '\\left[ #@ \\right]'                     },
  { icon: '{}',   cat: 'frac',  label: 'Llaves',          t: '\\left\\{ #@ \\right\\}'                 },
  { icon: '|x|',  cat: 'frac',  label: 'Valor absoluto',  t: '\\left| #@ \\right|'                     },
  { icon: '⌊x⌋',  cat: 'frac',  label: 'Piso',            t: '\\lfloor #@ \\rfloor'                    },
  { icon: '⌈x⌉',  cat: 'frac',  label: 'Techo',           t: '\\lceil #@ \\rceil'                      },
  { icon: 'x²/y', cat: 'frac',  label: 'Frac. anidada',   t: '\\dfrac{#?^{#?}}{#?}'                    },

  // ── Cálculo ───────────────────────────────────────────────────────
  { icon: '∫',    cat: 'calc',  label: 'Integral def.',      t: '\\int_{#?}^{#?} #? \\,d#?'              },
  { icon: '∫˙',   cat: 'calc',  label: 'Integral indef.',    t: '\\int #? \\,d#?'                         },
  { icon: '∬',    cat: 'calc',  label: 'Integral doble',     t: '\\iint_{#?} #? \\,d#?\\,d#?'            },
  { icon: '∭',    cat: 'calc',  label: 'Integral triple',    t: '\\iiint_{#?} #? \\,d#?\\,d#?\\,d#?'    },
  { icon: '∮',    cat: 'calc',  label: 'Integral de línea',  t: '\\oint_{#?} #? \\,d#?'                  },
  { icon: 'Σ',    cat: 'calc',  label: 'Sumatorio',          t: '\\sum_{#?}^{#?} #?'                      },
  { icon: 'Π',    cat: 'calc',  label: 'Productorio',        t: '\\prod_{#?}^{#?} #?'                     },
  { icon: 'lim',  cat: 'calc',  label: 'Límite',             t: '\\lim_{#? \\to #?} #?'                   },
  { icon: 'lim±', cat: 'calc',  label: 'Límite lateral',     t: '\\lim_{#? \\to #?^{#?}} #?'              },
  { icon: 'd/dx', cat: 'calc',  label: 'Derivada',           t: '\\frac{d}{d#?}\\left(#?\\right)'         },
  { icon: 'dⁿ',   cat: 'calc',  label: 'Derivada n-ésima',   t: '\\frac{d^{#?}}{d#?^{#?}}\\left(#?\\right)' },
  { icon: '∂',    cat: 'calc',  label: 'Parcial',            t: '\\frac{\\partial #?}{\\partial #?}'      },
  { icon: '∂²',   cat: 'calc',  label: 'Parcial 2.º orden',  t: '\\frac{\\partial^2 #?}{\\partial #?^2}' },
  { icon: '∇',    cat: 'calc',  label: 'Gradiente',          t: '\\nabla #?'                              },
  { icon: '∇·',   cat: 'calc',  label: 'Divergencia',        t: '\\nabla \\cdot #?'                       },
  { icon: '∇×',   cat: 'calc',  label: 'Rotacional',         t: '\\nabla \\times #?'                      },
  { icon: '△',    cat: 'calc',  label: 'Laplaciano',         t: '\\nabla^2 #?'                            },
  { icon: '∞',    cat: 'calc',  label: 'Infinito',           t: '\\infty'                                 },

  // ── Álgebra lineal ────────────────────────────────────────────────
  { icon: 'M 2×2',  cat: 'alg', label: 'Matriz 2×2',     t: '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}'                           },
  { icon: 'M 3×3',  cat: 'alg', label: 'Matriz 3×3',     t: '\\begin{pmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}' },
  { icon: 'M n×m',  cat: 'alg', label: 'Matriz general', t: '\\begin{pmatrix} #? & \\cdots & #? \\\\ \\vdots & \\ddots & \\vdots \\\\ #? & \\cdots & #? \\end{pmatrix}' },
  { icon: 'det',    cat: 'alg', label: 'Determinante',   t: '\\det\\left(#?\\right)'                     },
  { icon: 'tr',     cat: 'alg', label: 'Traza',           t: '\\operatorname{tr}\\left(#?\\right)'        },
  { icon: 'rk',     cat: 'alg', label: 'Rango',           t: '\\operatorname{rank}\\left(#?\\right)'      },
  { icon: 'tᵀ',     cat: 'alg', label: 'Transpuesta',    t: '{#@}^{\\top}'                               },
  { icon: 'A⁻¹',    cat: 'alg', label: 'Inversa',        t: '{#@}^{-1}'                                  },
  { icon: 'A†',     cat: 'alg', label: 'Adjunta/conjugada', t: '{#@}^{\\dagger}'                         },
  { icon: '‖v‖',    cat: 'alg', label: 'Norma',          t: '\\left\\| #@ \\right\\|'                    },
  { icon: '⟨,⟩',    cat: 'alg', label: 'Prod. interno',  t: '\\langle #? , #? \\rangle'                  },
  { icon: '×',      cat: 'alg', label: 'Prod. vectorial', t: '#? \\times #?'                             },
  { icon: '⊗',      cat: 'alg', label: 'Prod. tensorial', t: '#? \\otimes #?'                            },
  { icon: '⊕',      cat: 'alg', label: 'Suma directa',   t: '#? \\oplus #?'                             },
  { icon: 'ker',    cat: 'alg', label: 'Núcleo',          t: '\\ker\\left(#?\\right)'                    },
  { icon: 'Im',     cat: 'alg', label: 'Imagen',          t: '\\operatorname{Im}\\left(#?\\right)'       },

  // ── Lógica / conjuntos ────────────────────────────────────────────
  { icon: '∈',   cat: 'logic', label: 'pertenece',        t: '\\in'                                      },
  { icon: '∉',   cat: 'logic', label: 'no pertenece',     t: '\\notin'                                   },
  { icon: '⊆',   cat: 'logic', label: 'subconjunto',      t: '\\subseteq'                                },
  { icon: '⊊',   cat: 'logic', label: 'subconj. propio',  t: '\\subsetneq'                               },
  { icon: '⊇',   cat: 'logic', label: 'superconjunto',    t: '\\supseteq'                                },
  { icon: '∪',   cat: 'logic', label: 'unión',            t: '\\cup'                                     },
  { icon: '∩',   cat: 'logic', label: 'intersección',     t: '\\cap'                                     },
  { icon: '∖',   cat: 'logic', label: 'diferencia',       t: '#? \\setminus #?'                          },
  { icon: 'Aᶜ',  cat: 'logic', label: 'complemento',      t: '#?^{\\complement}'                         },
  { icon: '𝒫',   cat: 'logic', label: 'Partes de',        t: '\\mathcal{P}\\left(#?\\right)'             },
  { icon: '|A|', cat: 'logic', label: 'Cardinalidad',     t: '\\left| #? \\right|'                       },
  { icon: '∅',   cat: 'logic', label: 'vacío',            t: '\\emptyset'                                },
  { icon: '∀',   cat: 'logic', label: 'para todo',        t: '\\forall #? \\in #?:'                      },
  { icon: '∃',   cat: 'logic', label: 'existe',           t: '\\exists #? \\in #?:'                      },
  { icon: '∄',   cat: 'logic', label: 'no existe',        t: '\\nexists'                                 },
  { icon: '⟹',  cat: 'logic', label: 'implica',          t: '\\implies'                                 },
  { icon: '⟺',  cat: 'logic', label: 'iff',              t: '\\iff'                                     },
  { icon: '¬',   cat: 'logic', label: 'negación',         t: '\\neg #?'                                  },
  { icon: '∧',   cat: 'logic', label: 'conjunción',       t: '#? \\land #?'                              },
  { icon: '∨',   cat: 'logic', label: 'disyunción',       t: '#? \\lor #?'                               },
  { icon: 'ℝ',   cat: 'logic', label: 'Reales',           t: '\\mathbb{R}'                               },
  { icon: 'ℝⁿ',  cat: 'logic', label: 'Reales n-dim.',    t: '\\mathbb{R}^{#?}'                          },
  { icon: 'ℕ',   cat: 'logic', label: 'Naturales',        t: '\\mathbb{N}'                               },
  { icon: 'ℤ',   cat: 'logic', label: 'Enteros',          t: '\\mathbb{Z}'                               },
  { icon: 'ℚ',   cat: 'logic', label: 'Racionales',       t: '\\mathbb{Q}'                               },
  { icon: 'ℂ',   cat: 'logic', label: 'Complejos',        t: '\\mathbb{C}'                               },
  { icon: '𝔽',   cat: 'logic', label: 'Cuerpo',           t: '\\mathbb{F}'                               },

  // ── Griegas ───────────────────────────────────────────────────────
  { icon: 'α',  cat: 'greek', label: 'alpha',        t: '\\alpha'      },
  { icon: 'β',  cat: 'greek', label: 'beta',         t: '\\beta'       },
  { icon: 'γ',  cat: 'greek', label: 'gamma',        t: '\\gamma'      },
  { icon: 'δ',  cat: 'greek', label: 'delta',        t: '\\delta'      },
  { icon: 'ε',  cat: 'greek', label: 'epsilon',      t: '\\varepsilon' },
  { icon: 'ζ',  cat: 'greek', label: 'zeta',         t: '\\zeta'       },
  { icon: 'η',  cat: 'greek', label: 'eta',          t: '\\eta'        },
  { icon: 'θ',  cat: 'greek', label: 'theta',        t: '\\theta'      },
  { icon: 'ι',  cat: 'greek', label: 'iota',         t: '\\iota'       },
  { icon: 'κ',  cat: 'greek', label: 'kappa',        t: '\\kappa'      },
  { icon: 'λ',  cat: 'greek', label: 'lambda',       t: '\\lambda'     },
  { icon: 'μ',  cat: 'greek', label: 'mu',           t: '\\mu'         },
  { icon: 'ν',  cat: 'greek', label: 'nu',           t: '\\nu'         },
  { icon: 'ξ',  cat: 'greek', label: 'xi',           t: '\\xi'         },
  { icon: 'π',  cat: 'greek', label: 'pi',           t: '\\pi'         },
  { icon: 'ρ',  cat: 'greek', label: 'rho',          t: '\\rho'        },
  { icon: 'σ',  cat: 'greek', label: 'sigma',        t: '\\sigma'      },
  { icon: 'τ',  cat: 'greek', label: 'tau',          t: '\\tau'        },
  { icon: 'υ',  cat: 'greek', label: 'upsilon',      t: '\\upsilon'    },
  { icon: 'φ',  cat: 'greek', label: 'phi',          t: '\\varphi'     },
  { icon: 'χ',  cat: 'greek', label: 'chi',          t: '\\chi'        },
  { icon: 'ψ',  cat: 'greek', label: 'psi',          t: '\\psi'        },
  { icon: 'ω',  cat: 'greek', label: 'omega',        t: '\\omega'      },
  { icon: 'Γ',  cat: 'greek', label: 'Gamma may.',   t: '\\Gamma'      },
  { icon: 'Δ',  cat: 'greek', label: 'Delta may.',   t: '\\Delta'      },
  { icon: 'Θ',  cat: 'greek', label: 'Theta may.',   t: '\\Theta'      },
  { icon: 'Λ',  cat: 'greek', label: 'Lambda may.',  t: '\\Lambda'     },
  { icon: 'Ξ',  cat: 'greek', label: 'Xi may.',      t: '\\Xi'         },
  { icon: 'Π',  cat: 'greek', label: 'Pi may.',      t: '\\Pi'         },
  { icon: 'Σ',  cat: 'greek', label: 'Sigma may.',   t: '\\Sigma'      },
  { icon: 'Φ',  cat: 'greek', label: 'Phi may.',     t: '\\Phi'        },
  { icon: 'Ψ',  cat: 'greek', label: 'Psi may.',     t: '\\Psi'        },
  { icon: 'Ω',  cat: 'greek', label: 'Omega may.',   t: '\\Omega'      },

  // ── Relaciones ────────────────────────────────────────────────────
  { icon: '≤',  cat: 'rel',  label: 'leq',              t: '\\leq'              },
  { icon: '≥',  cat: 'rel',  label: 'geq',              t: '\\geq'              },
  { icon: '≠',  cat: 'rel',  label: 'neq',              t: '\\neq'              },
  { icon: '≪',  cat: 'rel',  label: 'mucho menor',      t: '\\ll'               },
  { icon: '≫',  cat: 'rel',  label: 'mucho mayor',      t: '\\gg'               },
  { icon: '≈',  cat: 'rel',  label: 'approx',           t: '\\approx'           },
  { icon: '≃',  cat: 'rel',  label: 'asintóticamente',  t: '\\simeq'            },
  { icon: '≅',  cat: 'rel',  label: 'isomorfo',         t: '\\cong'             },
  { icon: '≡',  cat: 'rel',  label: 'equiv',            t: '\\equiv'            },
  { icon: '∝',  cat: 'rel',  label: 'proporcional',     t: '\\propto'           },
  { icon: '±',  cat: 'rel',  label: 'pm',               t: '\\pm'               },
  { icon: '∓',  cat: 'rel',  label: 'mp',               t: '\\mp'               },
  { icon: '·',  cat: 'rel',  label: 'cdot',             t: '\\cdot'             },
  { icon: '×',  cat: 'rel',  label: 'times',            t: '\\times'            },
  { icon: '÷',  cat: 'rel',  label: 'div',              t: '\\div'              },
  { icon: '→',  cat: 'rel',  label: 'to',               t: '\\to'               },
  { icon: '←',  cat: 'rel',  label: 'leftarrow',        t: '\\leftarrow'        },
  { icon: '↔',  cat: 'rel',  label: 'leftrightarrow',   t: '\\leftrightarrow'   },
  { icon: '↦',  cat: 'rel',  label: 'mapsto',           t: '\\mapsto'           },
  { icon: '⊥',  cat: 'rel',  label: 'perp',             t: '\\perp'             },
  { icon: '∥',  cat: 'rel',  label: 'paralelo',         t: '\\parallel'         },
  { icon: '∣',  cat: 'rel',  label: 'divide a',         t: '#? \\mid #?'        },
  { icon: '∤',  cat: 'rel',  label: 'no divide',        t: '#? \\nmid #?'       },

  // ── Trigonometría ─────────────────────────────────────────────────
  { icon: 'sin',    cat: 'trig', label: 'seno',              t: '\\sin #?'                                },
  { icon: 'cos',    cat: 'trig', label: 'coseno',            t: '\\cos #?'                                },
  { icon: 'tan',    cat: 'trig', label: 'tangente',          t: '\\tan #?'                                },
  { icon: 'cot',    cat: 'trig', label: 'cotangente',        t: '\\cot #?'                                },
  { icon: 'sec',    cat: 'trig', label: 'secante',           t: '\\sec #?'                                },
  { icon: 'csc',    cat: 'trig', label: 'cosecante',         t: '\\csc #?'                                },
  { icon: 'sin²',   cat: 'trig', label: 'sin²',              t: '\\sin^2 #?'                              },
  { icon: 'cos²',   cat: 'trig', label: 'cos²',              t: '\\cos^2 #?'                              },
  { icon: 'arcsin', cat: 'trig', label: 'arcoseno',          t: '\\arcsin #?'                             },
  { icon: 'arccos', cat: 'trig', label: 'arcocoseno',        t: '\\arccos #?'                             },
  { icon: 'arctan', cat: 'trig', label: 'arcotangente',      t: '\\arctan #?'                             },
  { icon: 'atan2',  cat: 'trig', label: 'atan2',             t: '\\operatorname{atan2}\\left(#?,#?\\right)' },
  { icon: 'sinh',   cat: 'trig', label: 'seno hip.',         t: '\\sinh #?'                               },
  { icon: 'cosh',   cat: 'trig', label: 'coseno hip.',       t: '\\cosh #?'                               },
  { icon: 'tanh',   cat: 'trig', label: 'tangente hip.',     t: '\\tanh #?'                               },
  { icon: 's²+c²',  cat: 'trig', label: 'Pitágoras',        t: '\\sin^2 #? + \\cos^2 #? = 1'             },
  { icon: '2θ',     cat: 'trig', label: 'Ángulo doble sin',  t: '\\sin(2#?) = 2\\sin #?\\cos #?'          },
  { icon: 'e^iθ',   cat: 'trig', label: 'Euler',             t: 'e^{i#?} = \\cos #? + i\\sin #?'         },

  // ── Análisis ──────────────────────────────────────────────────────
  { icon: 'sup',   cat: 'anal', label: 'supremo',         t: '\\sup_{#?} #?'                              },
  { icon: 'inf',   cat: 'anal', label: 'ínfimo',          t: '\\inf_{#?} #?'                              },
  { icon: 'max',   cat: 'anal', label: 'máximo',          t: '\\max_{#?} #?'                              },
  { icon: 'min',   cat: 'anal', label: 'mínimo',          t: '\\min_{#?} #?'                              },
  { icon: 'aₙ→L', cat: 'anal', label: 'Convergencia',    t: '#?_n \\to #? \\quad (n \\to \\infty)'       },
  { icon: 'O()',   cat: 'anal', label: 'Big-O',           t: '\\mathcal{O}\\left(#?\\right)'              },
  { icon: 'o()',   cat: 'anal', label: 'little-o',        t: 'o\\left(#?\\right)'                         },
  { icon: 'B(x,r)',cat: 'anal', label: 'Bola abierta',    t: 'B\\left(#?, #?\\right)'                     },
  { icon: 'Ā',     cat: 'anal', label: 'Clausura',        t: '\\overline{#@}'                             },
  { icon: 'Å',     cat: 'anal', label: 'Interior',        t: '#?^{\\circ}'                                },
  { icon: '∂A',    cat: 'anal', label: 'Frontera',        t: '\\partial #?'                               },
  { icon: 'f∘g',   cat: 'anal', label: 'Composición',    t: '#? \\circ #?'                               },
  { icon: 'f⁻¹',   cat: 'anal', label: 'Inversa f.',     t: '#?^{-1}'                                    },
  { icon: 'Re',    cat: 'anal', label: 'Parte real',      t: '\\operatorname{Re}\\left(#?\\right)'        },
  { icon: 'Im',    cat: 'anal', label: 'Parte imag.',     t: '\\operatorname{Im}\\left(#?\\right)'        },
  { icon: 'z̄',    cat: 'anal', label: 'Conjugado',       t: '\\overline{#@}'                             },
  { icon: 'log',   cat: 'anal', label: 'Logaritmo',       t: '\\log_{#?} #?'                              },
  { icon: 'ln',    cat: 'anal', label: 'Logaritmo nat.',  t: '\\ln #?'                                    },
  { icon: 'exp',   cat: 'anal', label: 'Exponencial',     t: '\\exp\\left(#?\\right)'                     },

  // ── Estadística ───────────────────────────────────────────────────
  { icon: 'P()',    cat: 'stats', label: 'Probabilidad',   t: 'P\\left(#?\\right)'                        },
  { icon: 'P(|)',   cat: 'stats', label: 'Prob. cond.',    t: 'P\\left(#? \\mid #?\\right)'               },
  { icon: 'E[]',    cat: 'stats', label: 'Esperanza',      t: '\\mathbb{E}\\left[#?\\right]'              },
  { icon: 'E[|]',   cat: 'stats', label: 'Esp. cond.',     t: '\\mathbb{E}\\left[#? \\mid #?\\right]'    },
  { icon: 'Var',    cat: 'stats', label: 'Varianza',       t: '\\operatorname{Var}\\left(#?\\right)'      },
  { icon: 'Cov',    cat: 'stats', label: 'Covarianza',     t: '\\operatorname{Cov}\\left(#?,#?\\right)'   },
  { icon: 'Corr',   cat: 'stats', label: 'Correlación',    t: '\\operatorname{Corr}\\left(#?,#?\\right)'  },
  { icon: 'x̄',     cat: 'stats', label: 'Media',          t: '\\bar{#@}'                                 },
  { icon: 'x̂',     cat: 'stats', label: 'Estimador',      t: '\\hat{#@}'                                 },
  { icon: 'σ²',     cat: 'stats', label: 'Varianza σ²',   t: '\\sigma^2'                                  },
  { icon: 'N(μ,σ)', cat: 'stats', label: 'Normal',         t: '\\mathcal{N}\\!\\left(#?,#?\\right)'       },
  { icon: 'U(a,b)', cat: 'stats', label: 'Uniforme',       t: '\\mathcal{U}\\left(#?,#?\\right)'          },
  { icon: 'Bin',    cat: 'stats', label: 'Binomial',       t: '\\binom{#?}{#?}'                           },
  { icon: 'Poi',    cat: 'stats', label: 'Poisson',        t: '\\operatorname{Poi}\\left(#?\\right)'      },
  { icon: '~',      cat: 'stats', label: 'distribuido como', t: '#? \\sim #?'                             },
  { icon: 'iid',    cat: 'stats', label: 'iid',            t: '\\overset{\\text{iid}}{\\sim}'             },
]

// Default favorite IDs (indices into SNIPPETS) — the classic quick picks
const DEFAULT_FAV_TEMPLATES = [
  '\\frac{#@}{#?}',                          // a/b
  '\\sqrt{#@}',                              // √
  '{#@}^{#?}',                               // xⁿ
  '\\int_{#?}^{#?} #? \\,d#?',              // ∫
  '\\sum_{#?}^{#?} #?',                      // Σ
  '\\lim_{#? \\to #?} #?',                   // lim
  '\\frac{\\partial #?}{\\partial #?}',      // ∂
  '\\left( #@ \\right)',                     // ()
  '\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}', // M 2×2
  '\\sin #?',                                // sin
  '\\alpha',                                 // α
  '\\pi',                                    // π
  '\\in',                                    // ∈
  '\\leq',                                   // ≤
  '\\sup_{#?} #?',                           // sup
  '\\mathbb{E}\\left[#?\\right]',            // E[]
]

function getDefaultFavorites(): string[] {
  return DEFAULT_FAV_TEMPLATES
    .map(t => SNIPPETS.findIndex(s => s.t === t))
    .filter(i => i >= 0)
    .map(String)
}

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return getDefaultFavorites()
}

function saveFavorites(favs: string[]): void {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs))
}

const CATS = [
  { id: 'all',   label: 'Todos'          },
  { id: 'frac',  label: 'Fracciones'     },
  { id: 'calc',  label: 'Cálculo'        },
  { id: 'alg',   label: 'Álgebra'        },
  { id: 'trig',  label: 'Trigonometría'  },
  { id: 'anal',  label: 'Análisis'       },
  { id: 'logic', label: 'Lógica'         },
  { id: 'greek', label: 'Griegas'        },
  { id: 'rel',   label: 'Relaciones'     },
  { id: 'stats', label: 'Estadística'    },
]

// ── Insert helper ─────────────────────────────────────────────────

function insertSnippet(latex: string): void {
  const mf = document.querySelector<any>('fp-floating-formula math-field:not(.ff-hidden)')
  if (mf) {
    mf.insert(latex)
    mf.focus()
    return
  }
  const ta = document.querySelector<HTMLTextAreaElement>(
    'fp-floating-formula .ff-textarea:not(.ff-hidden)'
  )
  if (ta) {
    const clean = latex.replace(/#[@?]/g, '')
    const s = ta.selectionStart
    const e = ta.selectionEnd
    ta.value = ta.value.substring(0, s) + clean + ta.value.substring(e)
    ta.selectionStart = ta.selectionEnd = s + clean.length
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ta.focus()
  }
}

// ── Component ─────────────────────────────────────────────────────

@customElement('fp-snippet-sidebar')
export class SnippetSidebar extends LitElement {

  @state() private _collapsed = localStorage.getItem(SB_KEY) === '1'
  @state() private _search = ''
  @state() private _activeCat = 'all'
  @state() private _formulaActive = false
  @state() private _favorites: string[] = loadFavorites()

  private _disposes: (() => void)[] = []

  override createRenderRoot() { return this }

  override connectedCallback() {
    super.connectedCallback()
    this.parentElement?.classList.toggle('collapsed', this._collapsed)

    this._disposes.push(
      effect(() => { this._formulaActive = activeNodePos.value !== null })
    )

    const onKeydown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return
      const m = e.code.match(/^Digit(\d)$/)
      if (!m) return
      const idx = parseInt(m[1], 10)
      const favId = this._favorites[idx]
      if (favId === undefined) return
      e.preventDefault()
      const snip = SNIPPETS[parseInt(favId, 10)]
      if (snip) this._onSnipClick(snip.t)
    }
    document.addEventListener('keydown', onKeydown)
    this._disposes.push(() => document.removeEventListener('keydown', onKeydown))
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._disposes.forEach(d => d())
    this._disposes = []
  }

  private _toggle() {
    this._collapsed = !this._collapsed
    localStorage.setItem(SB_KEY, this._collapsed ? '1' : '0')
    this.parentElement?.classList.toggle('collapsed', this._collapsed)
  }

  private _onSnipClick(t: string) {
    if (this._formulaActive) {
      insertSnippet(t)
    } else {
      const clean = t.replace(/#[@?]/g, '')
      insertNewFormulaAndActivate(clean, false)
    }
  }

  private _toggleFav(id: string) {
    const idx = this._favorites.indexOf(id)
    if (idx >= 0) {
      this._favorites = this._favorites.filter(f => f !== id)
    } else if (this._favorites.length < MAX_FAVS) {
      this._favorites = [...this._favorites, id]
    }
    saveFavorites(this._favorites)
  }

  // ── Render ────────────────────────────────────────────────────

  override render() {
    return this._collapsed ? this._renderCollapsed() : this._renderExpanded()
  }

  private _renderCollapsed() {
    const favSnips = this._favorites
      .map((id, slot) => ({ snip: SNIPPETS[parseInt(id, 10)], slot }))
      .filter(x => x.snip != null)

    return html`
      <div class="sb-header">
        <button class="sb-toggle" title="Expandir panel" @click="${this._toggle}">›</button>
      </div>
      <div class="sb-quick">
        ${favSnips.map(({ snip, slot }) => html`
          <button
            class="sb-quick-btn"
            title="${slot < 10 ? `Ctrl+Shift+${slot} · ` : ''}${snip.label}"
            @mousedown="${(e: Event) => e.preventDefault()}"
            @click="${() => this._onSnipClick(snip.t)}"
          >
            ${slot < 10 ? html`<span class="sb-quick-badge">${slot}</span>` : ''}
            ${snip.icon}
          </button>
        `)}
      </div>
    `
  }

  private _renderExpanded() {
    const q = this._search.toLowerCase()
    const filtered = SNIPPETS.filter(s => {
      const catOk = this._activeCat === 'all' || s.cat === this._activeCat
      const searchOk = !q || s.label.toLowerCase().includes(q) || s.t.toLowerCase().includes(q)
      return catOk && searchOk
    })

    const favSnips = this._favorites
      .map((id, slot) => ({ id, snip: SNIPPETS[parseInt(id, 10)], slot }))
      .filter(x => x.snip != null)

    return html`
      <div class="sb-header">
        <button class="sb-toggle" title="Colapsar panel" @click="${this._toggle}">‹</button>
        <input
          class="sb-search"
          type="text"
          placeholder="Buscar…"
          .value="${this._search}"
          @input="${(e: Event) => { this._search = (e.target as HTMLInputElement).value }}"
        />
      </div>

      ${favSnips.length > 0 ? html`
        <div class="sb-fav-section">
          <div class="sb-fav-header">★ Favoritos</div>
          <div class="sb-fav-grid">
            ${favSnips.map(({ id, snip, slot }) => html`
              <div class="sb-fav-pill-wrap">
                <button
                  class="sb-fav-pill"
                  title="${slot < 10 ? `Ctrl+Shift+${slot} · ` : ''}${snip.label}"
                  @mousedown="${(e: Event) => e.preventDefault()}"
                  @click="${() => this._onSnipClick(snip.t)}"
                >
                  ${slot < 10 ? html`<span class="sb-fav-slot">${slot}</span>` : ''}
                  <span class="sb-fav-icon">${snip.icon}</span>
                </button>
                <button
                  class="sb-fav-remove"
                  title="Quitar de favoritos"
                  @mousedown="${(e: Event) => e.preventDefault()}"
                  @click="${() => this._toggleFav(id)}"
                >×</button>
              </div>
            `)}
          </div>
        </div>
      ` : ''}

      <div class="sb-cats">
        ${CATS.map(c => html`
          <button
            class="sb-cat${this._activeCat === c.id ? ' active' : ''}"
            @click="${() => { this._activeCat = c.id; this._search = '' }}"
          >${c.label}</button>
        `)}
      </div>
      <div class="sb-list">
        ${filtered.length === 0
          ? html`<p class="sb-empty">Sin resultados</p>`
          : filtered.map(s => {
              const globalIdx = SNIPPETS.indexOf(s)
              const id = String(globalIdx)
              const isFav = this._favorites.includes(id)
              return html`
                <div class="sb-snip-row">
                  <button
                    class="sb-snip"
                    title="${s.t}"
                    @mousedown="${(e: Event) => e.preventDefault()}"
                    @click="${() => this._onSnipClick(s.t)}"
                  >
                    <span class="sb-snip-icon">${s.icon}</span>
                    <span class="sb-snip-label">${s.label}</span>
                  </button>
                  <button
                    class="sb-snip-star${isFav ? ' is-fav' : ''}"
                    title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}"
                    @mousedown="${(e: Event) => e.preventDefault()}"
                    @click="${() => this._toggleFav(id)}"
                  >${isFav ? '★' : '☆'}</button>
                </div>
              `
            })
        }
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap { 'fp-snippet-sidebar': SnippetSidebar }
}
