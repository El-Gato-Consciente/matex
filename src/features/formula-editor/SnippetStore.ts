import { signal, computed } from '@preact/signals-core'

// ── Storage keys ─────────────────────────────────────────────────
const USER_KEY = 'formalia:user-snippets'
const FAV_KEY  = 'formalia:snippet-favorites-v2'

// ── Types ────────────────────────────────────────────────────────

export interface BuiltinSnippet {
  readonly kind: 'builtin'
  readonly id: string      // stable slug, e.g. 'frac/fraccion'
  readonly icon: string
  readonly cat: string
  readonly label: string
  readonly latex: string   // MathLive syntax (#@, #?)
}

export interface UserSnippet {
  kind: 'user'
  id: string               // crypto.randomUUID()
  name: string
  latex: string            // stored as-is; $1/$2 translated on insert
  tags: string[]
  forkedFrom?: string      // builtin id or user id
  createdAt: number        // Date.now()
}

export type AnySnippet = BuiltinSnippet | UserSnippet

// ── Built-in catalog (exported so sidebar can import) ────────────

export const BUILTIN_SNIPPETS: BuiltinSnippet[] = [
  // ── Fracciones / básicos ──────────────────────────────────────
  { kind:'builtin', id:'frac/fraccion',        icon:'a/b',  cat:'frac',  label:'Fracción',           latex:'\\frac{#@}{#?}'                           },
  { kind:'builtin', id:'frac/raiz-cuad',       icon:'√',    cat:'frac',  label:'Raíz cuad.',         latex:'\\sqrt{#@}'                               },
  { kind:'builtin', id:'frac/raiz-n',          icon:'ⁿ√',   cat:'frac',  label:'Raíz n-ésima',       latex:'\\sqrt[#?]{#@}'                           },
  { kind:'builtin', id:'frac/potencia',        icon:'xⁿ',   cat:'frac',  label:'Potencia',           latex:'{#@}^{#?}'                                },
  { kind:'builtin', id:'frac/subindice',       icon:'xₙ',   cat:'frac',  label:'Subíndice',          latex:'{#@}_{#?}'                                },
  { kind:'builtin', id:'frac/paren',           icon:'()',    cat:'frac',  label:'Paréntesis',         latex:'\\left( #@ \\right)'                      },
  { kind:'builtin', id:'frac/corch',           icon:'[]',   cat:'frac',  label:'Corchetes',          latex:'\\left[ #@ \\right]'                      },
  { kind:'builtin', id:'frac/llaves',          icon:'{}',   cat:'frac',  label:'Llaves',             latex:'\\left\\{ #@ \\right\\}'                  },
  { kind:'builtin', id:'frac/abs',             icon:'|x|',  cat:'frac',  label:'Valor absoluto',     latex:'\\left| #@ \\right|'                      },
  { kind:'builtin', id:'frac/piso',            icon:'⌊x⌋',  cat:'frac',  label:'Piso',               latex:'\\lfloor #@ \\rfloor'                     },
  { kind:'builtin', id:'frac/techo',           icon:'⌈x⌉',  cat:'frac',  label:'Techo',              latex:'\\lceil #@ \\rceil'                       },
  { kind:'builtin', id:'frac/anidada',         icon:'x²/y', cat:'frac',  label:'Frac. anidada',      latex:'\\dfrac{#?^{#?}}{#?}'                     },

  // ── Cálculo ───────────────────────────────────────────────────
  { kind:'builtin', id:'calc/int-def',         icon:'∫',    cat:'calc',  label:'Integral def.',      latex:'\\int_{#?}^{#?} #? \\,d#?'               },
  { kind:'builtin', id:'calc/int-indef',       icon:'∫˙',   cat:'calc',  label:'Integral indef.',    latex:'\\int #? \\,d#?'                          },
  { kind:'builtin', id:'calc/int-doble',       icon:'∬',    cat:'calc',  label:'Integral doble',     latex:'\\iint_{#?} #? \\,d#?\\,d#?'             },
  { kind:'builtin', id:'calc/int-triple',      icon:'∭',    cat:'calc',  label:'Integral triple',    latex:'\\iiint_{#?} #? \\,d#?\\,d#?\\,d#?'     },
  { kind:'builtin', id:'calc/int-linea',       icon:'∮',    cat:'calc',  label:'Integral de línea',  latex:'\\oint_{#?} #? \\,d#?'                   },
  { kind:'builtin', id:'calc/suma',            icon:'Σ',    cat:'calc',  label:'Sumatorio',          latex:'\\sum_{#?}^{#?} #?'                       },
  { kind:'builtin', id:'calc/prod',            icon:'Π',    cat:'calc',  label:'Productorio',        latex:'\\prod_{#?}^{#?} #?'                      },
  { kind:'builtin', id:'calc/limite',          icon:'lim',  cat:'calc',  label:'Límite',             latex:'\\lim_{#? \\to #?} #?'                    },
  { kind:'builtin', id:'calc/limite-lat',      icon:'lim±', cat:'calc',  label:'Límite lateral',     latex:'\\lim_{#? \\to #?^{#?}} #?'               },
  { kind:'builtin', id:'calc/derivada',        icon:'d/dx', cat:'calc',  label:'Derivada',           latex:'\\frac{d}{d#?}\\left(#?\\right)'          },
  { kind:'builtin', id:'calc/derivada-n',      icon:'dⁿ',   cat:'calc',  label:'Derivada n-ésima',   latex:'\\frac{d^{#?}}{d#?^{#?}}\\left(#?\\right)' },
  { kind:'builtin', id:'calc/parcial',         icon:'∂',    cat:'calc',  label:'Parcial',            latex:'\\frac{\\partial #?}{\\partial #?}'       },
  { kind:'builtin', id:'calc/parcial-2',       icon:'∂²',   cat:'calc',  label:'Parcial 2.º orden',  latex:'\\frac{\\partial^2 #?}{\\partial #?^2}'  },
  { kind:'builtin', id:'calc/gradiente',       icon:'∇',    cat:'calc',  label:'Gradiente',          latex:'\\nabla #?'                               },
  { kind:'builtin', id:'calc/div',             icon:'∇·',   cat:'calc',  label:'Divergencia',        latex:'\\nabla \\cdot #?'                        },
  { kind:'builtin', id:'calc/rot',             icon:'∇×',   cat:'calc',  label:'Rotacional',         latex:'\\nabla \\times #?'                       },
  { kind:'builtin', id:'calc/lapl',            icon:'△',    cat:'calc',  label:'Laplaciano',         latex:'\\nabla^2 #?'                             },
  { kind:'builtin', id:'calc/infty',           icon:'∞',    cat:'calc',  label:'Infinito',           latex:'\\infty'                                  },
  { kind:'builtin', id:'calc/binom',           icon:'C(n,k)',cat:'calc', label:'Combinatorio',        latex:'\\binom{#?}{#?}'                          },
  { kind:'builtin', id:'calc/fact',            icon:'n!',   cat:'calc',  label:'Factorial',           latex:'#?!'                                      },
  { kind:'builtin', id:'calc/limsup',          icon:'lim̄',   cat:'calc', label:'lim sup',            latex:'\\limsup_{#?} #?'                         },
  { kind:'builtin', id:'calc/liminf',          icon:'lim̲',   cat:'calc', label:'lim inf',            latex:'\\liminf_{#?} #?'                         },

  // ── Álgebra lineal ────────────────────────────────────────────
  { kind:'builtin', id:'alg/mat2',             icon:'M 2×2',  cat:'alg', label:'Matriz 2×2',         latex:'\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}'                           },
  { kind:'builtin', id:'alg/mat3',             icon:'M 3×3',  cat:'alg', label:'Matriz 3×3',         latex:'\\begin{pmatrix} #? & #? & #? \\\\ #? & #? & #? \\\\ #? & #? & #? \\end{pmatrix}' },
  { kind:'builtin', id:'alg/matn',             icon:'M n×m',  cat:'alg', label:'Matriz general',     latex:'\\begin{pmatrix} #? & \\cdots & #? \\\\ \\vdots & \\ddots & \\vdots \\\\ #? & \\cdots & #? \\end{pmatrix}' },
  { kind:'builtin', id:'alg/det',              icon:'det',    cat:'alg', label:'Determinante',       latex:'\\det\\left(#?\\right)'                   },
  { kind:'builtin', id:'alg/traza',            icon:'tr',     cat:'alg', label:'Traza',              latex:'\\operatorname{tr}\\left(#?\\right)'       },
  { kind:'builtin', id:'alg/rango',            icon:'rk',     cat:'alg', label:'Rango',              latex:'\\operatorname{rank}\\left(#?\\right)'     },
  { kind:'builtin', id:'alg/transp',           icon:'tᵀ',     cat:'alg', label:'Transpuesta',        latex:'{#@}^{\\top}'                             },
  { kind:'builtin', id:'alg/inv',              icon:'A⁻¹',    cat:'alg', label:'Inversa',            latex:'{#@}^{-1}'                                },
  { kind:'builtin', id:'alg/adj',              icon:'A†',     cat:'alg', label:'Adjunta/conjugada',  latex:'{#@}^{\\dagger}'                          },
  { kind:'builtin', id:'alg/norma',            icon:'‖v‖',    cat:'alg', label:'Norma',              latex:'\\left\\| #@ \\right\\|'                  },
  { kind:'builtin', id:'alg/prod-int',         icon:'⟨,⟩',    cat:'alg', label:'Prod. interno',      latex:'\\langle #? , #? \\rangle'                },
  { kind:'builtin', id:'alg/prod-vect',        icon:'×',      cat:'alg', label:'Prod. vectorial',    latex:'#? \\times #?'                            },
  { kind:'builtin', id:'alg/prod-tens',        icon:'⊗',      cat:'alg', label:'Prod. tensorial',    latex:'#? \\otimes #?'                           },
  { kind:'builtin', id:'alg/suma-dir',         icon:'⊕',      cat:'alg', label:'Suma directa',       latex:'#? \\oplus #?'                            },
  { kind:'builtin', id:'alg/ker',              icon:'ker',    cat:'alg', label:'Núcleo',             latex:'\\ker\\left(#?\\right)'                   },
  { kind:'builtin', id:'alg/im',               icon:'Im',     cat:'alg', label:'Imagen',             latex:'\\operatorname{Im}\\left(#?\\right)'      },
  { kind:'builtin', id:'alg/span',             icon:'span',   cat:'alg', label:'Generado por',       latex:'\\operatorname{span}\\left\\{#?\\right\\}' },
  { kind:'builtin', id:'alg/diag',             icon:'diag',   cat:'alg', label:'Diagonal (diag)',    latex:'\\operatorname{diag}\\left(#?\\right)'     },
  { kind:'builtin', id:'alg/null',             icon:'null',   cat:'alg', label:'Espacio nulo',       latex:'\\operatorname{null}\\left(#?\\right)'     },
  { kind:'builtin', id:'alg/col',              icon:'col',    cat:'alg', label:'Espacio columna',    latex:'\\operatorname{col}\\left(#?\\right)'      },
  { kind:'builtin', id:'alg/eigenval',         icon:'Av=λv',  cat:'alg', label:'Autovalor',          latex:'A\\mathbf{v} = \\lambda \\mathbf{v}'      },
  { kind:'builtin', id:'alg/wedge',            icon:'∧',      cat:'alg', label:'Prod. exterior (∧)', latex:'#? \\wedge #?'                            },
  { kind:'builtin', id:'alg/dual',             icon:'V*',     cat:'alg', label:'Espacio dual',       latex:'{#@}^{*}'                                 },
  { kind:'builtin', id:'alg/hom',              icon:'Hom',    cat:'alg', label:'Hom',                latex:'\\operatorname{Hom}\\left(#?,#?\\right)'   },
  { kind:'builtin', id:'alg/end',              icon:'End',    cat:'alg', label:'End',                latex:'\\operatorname{End}\\left(#?\\right)'      },

  // ── Lógica / conjuntos ────────────────────────────────────────
  { kind:'builtin', id:'logic/in',             icon:'∈',   cat:'logic', label:'pertenece',           latex:'\\in'                                     },
  { kind:'builtin', id:'logic/notin',          icon:'∉',   cat:'logic', label:'no pertenece',        latex:'\\notin'                                  },
  { kind:'builtin', id:'logic/subs',           icon:'⊆',   cat:'logic', label:'subconjunto',         latex:'\\subseteq'                               },
  { kind:'builtin', id:'logic/subs-prop',      icon:'⊊',   cat:'logic', label:'subconj. propio',     latex:'\\subsetneq'                              },
  { kind:'builtin', id:'logic/sups',           icon:'⊇',   cat:'logic', label:'superconjunto',       latex:'\\supseteq'                               },
  { kind:'builtin', id:'logic/union',          icon:'∪',   cat:'logic', label:'unión',               latex:'\\cup'                                    },
  { kind:'builtin', id:'logic/inter',          icon:'∩',   cat:'logic', label:'intersección',        latex:'\\cap'                                    },
  { kind:'builtin', id:'logic/dif',            icon:'∖',   cat:'logic', label:'diferencia',          latex:'#? \\setminus #?'                         },
  { kind:'builtin', id:'logic/comp',           icon:'Aᶜ',  cat:'logic', label:'complemento',         latex:'#?^{\\complement}'                        },
  { kind:'builtin', id:'logic/partes',         icon:'𝒫',   cat:'logic', label:'Partes de',           latex:'\\mathcal{P}\\left(#?\\right)'            },
  { kind:'builtin', id:'logic/card',           icon:'|A|', cat:'logic', label:'Cardinalidad',        latex:'\\left| #? \\right|'                      },
  { kind:'builtin', id:'logic/vacio',          icon:'∅',   cat:'logic', label:'vacío',               latex:'\\emptyset'                               },
  { kind:'builtin', id:'logic/forall',         icon:'∀',   cat:'logic', label:'para todo',           latex:'\\forall #? \\in #?:'                     },
  { kind:'builtin', id:'logic/exists',         icon:'∃',   cat:'logic', label:'existe',              latex:'\\exists #? \\in #?:'                     },
  { kind:'builtin', id:'logic/nexists',        icon:'∄',   cat:'logic', label:'no existe',           latex:'\\nexists'                                },
  { kind:'builtin', id:'logic/implies',        icon:'⟹',  cat:'logic', label:'implica',             latex:'\\implies'                                },
  { kind:'builtin', id:'logic/iff',            icon:'⟺',  cat:'logic', label:'iff',                 latex:'\\iff'                                    },
  { kind:'builtin', id:'logic/neg',            icon:'¬',   cat:'logic', label:'negación',            latex:'\\neg #?'                                 },
  { kind:'builtin', id:'logic/land',           icon:'∧',   cat:'logic', label:'conjunción',          latex:'#? \\land #?'                             },
  { kind:'builtin', id:'logic/lor',            icon:'∨',   cat:'logic', label:'disyunción',          latex:'#? \\lor #?'                              },
  { kind:'builtin', id:'logic/RR',             icon:'ℝ',   cat:'logic', label:'Reales',              latex:'\\mathbb{R}'                              },
  { kind:'builtin', id:'logic/RRn',            icon:'ℝⁿ',  cat:'logic', label:'Reales n-dim.',       latex:'\\mathbb{R}^{#?}'                         },
  { kind:'builtin', id:'logic/NN',             icon:'ℕ',   cat:'logic', label:'Naturales',           latex:'\\mathbb{N}'                              },
  { kind:'builtin', id:'logic/ZZ',             icon:'ℤ',   cat:'logic', label:'Enteros',             latex:'\\mathbb{Z}'                              },
  { kind:'builtin', id:'logic/QQ',             icon:'ℚ',   cat:'logic', label:'Racionales',          latex:'\\mathbb{Q}'                              },
  { kind:'builtin', id:'logic/CC',             icon:'ℂ',   cat:'logic', label:'Complejos',           latex:'\\mathbb{C}'                              },
  { kind:'builtin', id:'logic/FF',             icon:'𝔽',   cat:'logic', label:'Cuerpo',              latex:'\\mathbb{F}'                              },
  { kind:'builtin', id:'logic/HH',             icon:'ℍ',   cat:'logic', label:'Cuaterniones',        latex:'\\mathbb{H}'                              },
  { kind:'builtin', id:'logic/PP',             icon:'ℙ',   cat:'logic', label:'Primos / Prob.',      latex:'\\mathbb{P}'                              },
  { kind:'builtin', id:'logic/aleph',          icon:'ℵ',   cat:'logic', label:'ℵ (aleph)',           latex:'\\aleph'                                  },
  { kind:'builtin', id:'logic/aleph0',         icon:'ℵ₀',  cat:'logic', label:'ℵ₀ (aleph-nulo)',     latex:'\\aleph_0'                                },
  { kind:'builtin', id:'logic/aleph1',         icon:'ℵ₁',  cat:'logic', label:'ℵ₁ (aleph-uno)',      latex:'\\aleph_1'                                },
  { kind:'builtin', id:'logic/beth',           icon:'ℶ',   cat:'logic', label:'ℶ (beth)',            latex:'\\beth'                                   },
  { kind:'builtin', id:'logic/bigcup',         icon:'⋃',   cat:'logic', label:'Unión grande',        latex:'\\bigcup_{#?}^{#?} #?'                    },
  { kind:'builtin', id:'logic/bigcap',         icon:'⋂',   cat:'logic', label:'Intersección grande', latex:'\\bigcap_{#?}^{#?} #?'                    },
  { kind:'builtin', id:'logic/sqsubseteq',     icon:'⊑',   cat:'logic', label:'sqsubseteq',          latex:'\\sqsubseteq'                             },
  { kind:'builtin', id:'logic/sqsupseteq',     icon:'⊒',   cat:'logic', label:'sqsupseteq',          latex:'\\sqsupseteq'                             },
  { kind:'builtin', id:'logic/sqcap',          icon:'⊓',   cat:'logic', label:'meet (⊓)',            latex:'\\sqcap'                                  },
  { kind:'builtin', id:'logic/sqcup',          icon:'⊔',   cat:'logic', label:'join (⊔)',            latex:'\\sqcup'                                  },

  // ── Griegas ───────────────────────────────────────────────────
  { kind:'builtin', id:'greek/alpha',          icon:'α',  cat:'greek', label:'alpha',         latex:'\\alpha'      },
  { kind:'builtin', id:'greek/beta',           icon:'β',  cat:'greek', label:'beta',          latex:'\\beta'       },
  { kind:'builtin', id:'greek/gamma',          icon:'γ',  cat:'greek', label:'gamma',         latex:'\\gamma'      },
  { kind:'builtin', id:'greek/delta',          icon:'δ',  cat:'greek', label:'delta',         latex:'\\delta'      },
  { kind:'builtin', id:'greek/epsilon',        icon:'ε',  cat:'greek', label:'epsilon',       latex:'\\varepsilon' },
  { kind:'builtin', id:'greek/zeta',           icon:'ζ',  cat:'greek', label:'zeta',          latex:'\\zeta'       },
  { kind:'builtin', id:'greek/eta',            icon:'η',  cat:'greek', label:'eta',           latex:'\\eta'        },
  { kind:'builtin', id:'greek/theta',          icon:'θ',  cat:'greek', label:'theta',         latex:'\\theta'      },
  { kind:'builtin', id:'greek/iota',           icon:'ι',  cat:'greek', label:'iota',          latex:'\\iota'       },
  { kind:'builtin', id:'greek/kappa',          icon:'κ',  cat:'greek', label:'kappa',         latex:'\\kappa'      },
  { kind:'builtin', id:'greek/lambda',         icon:'λ',  cat:'greek', label:'lambda',        latex:'\\lambda'     },
  { kind:'builtin', id:'greek/mu',             icon:'μ',  cat:'greek', label:'mu',            latex:'\\mu'         },
  { kind:'builtin', id:'greek/nu',             icon:'ν',  cat:'greek', label:'nu',            latex:'\\nu'         },
  { kind:'builtin', id:'greek/xi',             icon:'ξ',  cat:'greek', label:'xi',            latex:'\\xi'         },
  { kind:'builtin', id:'greek/pi',             icon:'π',  cat:'greek', label:'pi',            latex:'\\pi'         },
  { kind:'builtin', id:'greek/rho',            icon:'ρ',  cat:'greek', label:'rho',           latex:'\\rho'        },
  { kind:'builtin', id:'greek/sigma',          icon:'σ',  cat:'greek', label:'sigma',         latex:'\\sigma'      },
  { kind:'builtin', id:'greek/tau',            icon:'τ',  cat:'greek', label:'tau',           latex:'\\tau'        },
  { kind:'builtin', id:'greek/upsilon',        icon:'υ',  cat:'greek', label:'upsilon',       latex:'\\upsilon'    },
  { kind:'builtin', id:'greek/phi',            icon:'φ',  cat:'greek', label:'phi',           latex:'\\varphi'     },
  { kind:'builtin', id:'greek/chi',            icon:'χ',  cat:'greek', label:'chi',           latex:'\\chi'        },
  { kind:'builtin', id:'greek/psi',            icon:'ψ',  cat:'greek', label:'psi',           latex:'\\psi'        },
  { kind:'builtin', id:'greek/omega',          icon:'ω',  cat:'greek', label:'omega',         latex:'\\omega'      },
  { kind:'builtin', id:'greek/Gamma',          icon:'Γ',  cat:'greek', label:'Gamma may.',    latex:'\\Gamma'      },
  { kind:'builtin', id:'greek/Delta',          icon:'Δ',  cat:'greek', label:'Delta may.',    latex:'\\Delta'      },
  { kind:'builtin', id:'greek/Theta',          icon:'Θ',  cat:'greek', label:'Theta may.',    latex:'\\Theta'      },
  { kind:'builtin', id:'greek/Lambda',         icon:'Λ',  cat:'greek', label:'Lambda may.',   latex:'\\Lambda'     },
  { kind:'builtin', id:'greek/Xi',             icon:'Ξ',  cat:'greek', label:'Xi may.',       latex:'\\Xi'         },
  { kind:'builtin', id:'greek/Pi',             icon:'Π',  cat:'greek', label:'Pi may.',       latex:'\\Pi'         },
  { kind:'builtin', id:'greek/Sigma',          icon:'Σ',  cat:'greek', label:'Sigma may.',    latex:'\\Sigma'      },
  { kind:'builtin', id:'greek/Phi',            icon:'Φ',  cat:'greek', label:'Phi may.',      latex:'\\Phi'        },
  { kind:'builtin', id:'greek/Psi',            icon:'Ψ',  cat:'greek', label:'Psi may.',      latex:'\\Psi'        },
  { kind:'builtin', id:'greek/Omega',          icon:'Ω',  cat:'greek', label:'Omega may.',    latex:'\\Omega'      },
  { kind:'builtin', id:'greek/Upsilon',        icon:'Υ',  cat:'greek', label:'Upsilon may.',  latex:'\\Upsilon'    },
  { kind:'builtin', id:'greek/vartheta',       icon:'ϑ',  cat:'greek', label:'vartheta (ϑ)',  latex:'\\vartheta'   },
  { kind:'builtin', id:'greek/varpi',          icon:'ϖ',  cat:'greek', label:'varpi (ϖ)',     latex:'\\varpi'      },
  { kind:'builtin', id:'greek/varrho',         icon:'ϱ',  cat:'greek', label:'varrho (ϱ)',    latex:'\\varrho'     },
  { kind:'builtin', id:'greek/varsigma',       icon:'ς',  cat:'greek', label:'varsigma (ς)',  latex:'\\varsigma'   },
  { kind:'builtin', id:'greek/varkappa',       icon:'ϰ',  cat:'greek', label:'varkappa (ϰ)', latex:'\\varkappa'   },
  { kind:'builtin', id:'greek/epsilon-var',    icon:'ϵ',  cat:'greek', label:'epsilon (ϵ)',   latex:'\\epsilon'    },
  { kind:'builtin', id:'greek/phi-var',        icon:'φ',  cat:'greek', label:'phi (φ)',       latex:'\\phi'        },

  // ── Relaciones ────────────────────────────────────────────────
  { kind:'builtin', id:'rel/leq',              icon:'≤',  cat:'rel',  label:'leq',              latex:'\\leq'            },
  { kind:'builtin', id:'rel/geq',              icon:'≥',  cat:'rel',  label:'geq',              latex:'\\geq'            },
  { kind:'builtin', id:'rel/neq',              icon:'≠',  cat:'rel',  label:'neq',              latex:'\\neq'            },
  { kind:'builtin', id:'rel/ll',               icon:'≪',  cat:'rel',  label:'mucho menor',      latex:'\\ll'             },
  { kind:'builtin', id:'rel/gg',               icon:'≫',  cat:'rel',  label:'mucho mayor',      latex:'\\gg'             },
  { kind:'builtin', id:'rel/approx',           icon:'≈',  cat:'rel',  label:'approx',           latex:'\\approx'         },
  { kind:'builtin', id:'rel/simeq',            icon:'≃',  cat:'rel',  label:'asintóticamente',  latex:'\\simeq'          },
  { kind:'builtin', id:'rel/cong',             icon:'≅',  cat:'rel',  label:'isomorfo',         latex:'\\cong'           },
  { kind:'builtin', id:'rel/equiv',            icon:'≡',  cat:'rel',  label:'equiv',            latex:'\\equiv'          },
  { kind:'builtin', id:'rel/propto',           icon:'∝',  cat:'rel',  label:'proporcional',     latex:'\\propto'         },
  { kind:'builtin', id:'rel/pm',               icon:'±',  cat:'rel',  label:'pm',               latex:'\\pm'             },
  { kind:'builtin', id:'rel/mp',               icon:'∓',  cat:'rel',  label:'mp',               latex:'\\mp'             },
  { kind:'builtin', id:'rel/cdot',             icon:'·',  cat:'rel',  label:'cdot',             latex:'\\cdot'           },
  { kind:'builtin', id:'rel/times',            icon:'×',  cat:'rel',  label:'times',            latex:'\\times'          },
  { kind:'builtin', id:'rel/div',              icon:'÷',  cat:'rel',  label:'div',              latex:'\\div'            },
  { kind:'builtin', id:'rel/to',               icon:'→',  cat:'rel',  label:'to',               latex:'\\to'             },
  { kind:'builtin', id:'rel/leftarrow',        icon:'←',  cat:'rel',  label:'leftarrow',        latex:'\\leftarrow'      },
  { kind:'builtin', id:'rel/leftrightarrow',   icon:'↔',  cat:'rel',  label:'leftrightarrow',   latex:'\\leftrightarrow' },
  { kind:'builtin', id:'rel/mapsto',           icon:'↦',  cat:'rel',  label:'mapsto',           latex:'\\mapsto'         },
  { kind:'builtin', id:'rel/perp',             icon:'⊥',  cat:'rel',  label:'perp',             latex:'\\perp'           },
  { kind:'builtin', id:'rel/parallel',         icon:'∥',  cat:'rel',  label:'paralelo',         latex:'\\parallel'       },
  { kind:'builtin', id:'rel/mid',              icon:'∣',  cat:'rel',  label:'divide a',         latex:'#? \\mid #?'      },
  { kind:'builtin', id:'rel/nmid',             icon:'∤',  cat:'rel',  label:'no divide',        latex:'#? \\nmid #?'     },
  { kind:'builtin', id:'rel/Rightarrow',       icon:'⇒',  cat:'rel',  label:'Rightarrow (⇒)',   latex:'\\Rightarrow'      },
  { kind:'builtin', id:'rel/Leftarrow',        icon:'⇐',  cat:'rel',  label:'Leftarrow (⇐)',    latex:'\\Leftarrow'       },
  { kind:'builtin', id:'rel/Leftrightarrow',   icon:'⟺',  cat:'rel',  label:'Leftrightarrow',   latex:'\\Leftrightarrow'  },
  { kind:'builtin', id:'rel/Longrightarrow',   icon:'⟹',  cat:'rel',  label:'Longrightarrow',   latex:'\\Longrightarrow'  },
  { kind:'builtin', id:'rel/hookright',        icon:'↪',  cat:'rel',  label:'inyección (↪)',     latex:'\\hookrightarrow'  },
  { kind:'builtin', id:'rel/twoheadright',     icon:'↠',  cat:'rel',  label:'suprayección (↠)', latex:'\\twoheadrightarrow' },
  { kind:'builtin', id:'rel/rightharpoonup',   icon:'⇀',  cat:'rel',  label:'harpoon up (⇀)',   latex:'\\rightharpoonup'  },
  { kind:'builtin', id:'rel/uparrow',          icon:'↑',  cat:'rel',  label:'uparrow (↑)',       latex:'\\uparrow'         },
  { kind:'builtin', id:'rel/downarrow',        icon:'↓',  cat:'rel',  label:'downarrow (↓)',     latex:'\\downarrow'       },
  { kind:'builtin', id:'rel/nearrow',          icon:'↗',  cat:'rel',  label:'nearrow (↗)',       latex:'\\nearrow'         },
  { kind:'builtin', id:'rel/searrow',          icon:'↘',  cat:'rel',  label:'searrow (↘)',       latex:'\\searrow'         },
  { kind:'builtin', id:'rel/sim',              icon:'∼',  cat:'rel',  label:'sim (∼)',           latex:'\\sim'             },
  { kind:'builtin', id:'rel/prec',             icon:'≺',  cat:'rel',  label:'prec (≺)',          latex:'\\prec'            },
  { kind:'builtin', id:'rel/succ',             icon:'≻',  cat:'rel',  label:'succ (≻)',          latex:'\\succ'            },
  { kind:'builtin', id:'rel/preceq',           icon:'≼',  cat:'rel',  label:'preceq (≼)',        latex:'\\preceq'          },
  { kind:'builtin', id:'rel/succeq',           icon:'≽',  cat:'rel',  label:'succeq (≽)',        latex:'\\succeq'          },
  { kind:'builtin', id:'rel/subset',           icon:'⊂',  cat:'rel',  label:'subset estricto',   latex:'\\subset'          },
  { kind:'builtin', id:'rel/supset',           icon:'⊃',  cat:'rel',  label:'supset estricto',   latex:'\\supset'          },
  { kind:'builtin', id:'rel/therefore',        icon:'∴',  cat:'rel',  label:'por lo tanto (∴)',  latex:'\\therefore'       },
  { kind:'builtin', id:'rel/because',          icon:'∵',  cat:'rel',  label:'porque (∵)',        latex:'\\because'         },
  { kind:'builtin', id:'rel/doteq',            icon:'≐',  cat:'rel',  label:'doteq (≐)',         latex:'\\doteq'           },
  { kind:'builtin', id:'rel/asymp',            icon:'≍',  cat:'rel',  label:'asymp (≍)',         latex:'\\asymp'           },

  // ── Trigonometría ─────────────────────────────────────────────
  { kind:'builtin', id:'trig/sin',             icon:'sin',    cat:'trig', label:'seno',             latex:'\\sin #?'                                 },
  { kind:'builtin', id:'trig/cos',             icon:'cos',    cat:'trig', label:'coseno',           latex:'\\cos #?'                                 },
  { kind:'builtin', id:'trig/tan',             icon:'tan',    cat:'trig', label:'tangente',         latex:'\\tan #?'                                 },
  { kind:'builtin', id:'trig/cot',             icon:'cot',    cat:'trig', label:'cotangente',       latex:'\\cot #?'                                 },
  { kind:'builtin', id:'trig/sec',             icon:'sec',    cat:'trig', label:'secante',          latex:'\\sec #?'                                 },
  { kind:'builtin', id:'trig/csc',             icon:'csc',    cat:'trig', label:'cosecante',        latex:'\\csc #?'                                 },
  { kind:'builtin', id:'trig/sin2',            icon:'sin²',   cat:'trig', label:'sin²',             latex:'\\sin^2 #?'                               },
  { kind:'builtin', id:'trig/cos2',            icon:'cos²',   cat:'trig', label:'cos²',             latex:'\\cos^2 #?'                               },
  { kind:'builtin', id:'trig/arcsin',          icon:'arcsin', cat:'trig', label:'arcoseno',         latex:'\\arcsin #?'                              },
  { kind:'builtin', id:'trig/arccos',          icon:'arccos', cat:'trig', label:'arcocoseno',       latex:'\\arccos #?'                              },
  { kind:'builtin', id:'trig/arctan',          icon:'arctan', cat:'trig', label:'arcotangente',     latex:'\\arctan #?'                              },
  { kind:'builtin', id:'trig/atan2',           icon:'atan2',  cat:'trig', label:'atan2',            latex:'\\operatorname{atan2}\\left(#?,#?\\right)' },
  { kind:'builtin', id:'trig/sinh',            icon:'sinh',   cat:'trig', label:'seno hip.',        latex:'\\sinh #?'                                },
  { kind:'builtin', id:'trig/cosh',            icon:'cosh',   cat:'trig', label:'coseno hip.',      latex:'\\cosh #?'                                },
  { kind:'builtin', id:'trig/tanh',            icon:'tanh',   cat:'trig', label:'tangente hip.',    latex:'\\tanh #?'                                },
  { kind:'builtin', id:'trig/pitagoras',       icon:'s²+c²',  cat:'trig', label:'Pitágoras',        latex:'\\sin^2 #? + \\cos^2 #? = 1'              },
  { kind:'builtin', id:'trig/ang-doble',       icon:'2θ',     cat:'trig', label:'Ángulo doble sin', latex:'\\sin(2#?) = 2\\sin #?\\cos #?'           },
  { kind:'builtin', id:'trig/euler',           icon:'e^iθ',   cat:'trig', label:'Euler',            latex:'e^{i#?} = \\cos #? + i\\sin #?'           },

  // ── Análisis ──────────────────────────────────────────────────
  { kind:'builtin', id:'anal/sup',             icon:'sup',    cat:'anal', label:'supremo',          latex:'\\sup_{#?} #?'                            },
  { kind:'builtin', id:'anal/inf',             icon:'inf',    cat:'anal', label:'ínfimo',           latex:'\\inf_{#?} #?'                            },
  { kind:'builtin', id:'anal/max',             icon:'max',    cat:'anal', label:'máximo',           latex:'\\max_{#?} #?'                            },
  { kind:'builtin', id:'anal/min',             icon:'min',    cat:'anal', label:'mínimo',           latex:'\\min_{#?} #?'                            },
  { kind:'builtin', id:'anal/conv',            icon:'aₙ→L',   cat:'anal', label:'Convergencia',     latex:'#?_n \\to #? \\quad (n \\to \\infty)'     },
  { kind:'builtin', id:'anal/bigo',            icon:'O()',    cat:'anal', label:'Big-O',            latex:'\\mathcal{O}\\left(#?\\right)'             },
  { kind:'builtin', id:'anal/littleo',         icon:'o()',    cat:'anal', label:'little-o',         latex:'o\\left(#?\\right)'                       },
  { kind:'builtin', id:'anal/bola',            icon:'B(x,r)', cat:'anal', label:'Bola abierta',     latex:'B\\left(#?, #?\\right)'                   },
  { kind:'builtin', id:'anal/clausura',        icon:'Ā',      cat:'anal', label:'Clausura',         latex:'\\overline{#@}'                           },
  { kind:'builtin', id:'anal/interior',        icon:'Å',      cat:'anal', label:'Interior',         latex:'#?^{\\circ}'                              },
  { kind:'builtin', id:'anal/frontera',        icon:'∂A',     cat:'anal', label:'Frontera',         latex:'\\partial #?'                             },
  { kind:'builtin', id:'anal/comp',            icon:'f∘g',    cat:'anal', label:'Composición',      latex:'#? \\circ #?'                             },
  { kind:'builtin', id:'anal/inv-f',           icon:'f⁻¹',    cat:'anal', label:'Inversa f.',       latex:'#?^{-1}'                                  },
  { kind:'builtin', id:'anal/re',              icon:'Re',     cat:'anal', label:'Parte real',       latex:'\\operatorname{Re}\\left(#?\\right)'      },
  { kind:'builtin', id:'anal/im',              icon:'Im',     cat:'anal', label:'Parte imag.',      latex:'\\operatorname{Im}\\left(#?\\right)'      },
  { kind:'builtin', id:'anal/conj',            icon:'z̄',      cat:'anal', label:'Conjugado',        latex:'\\overline{#@}'                           },
  { kind:'builtin', id:'anal/log',             icon:'log',    cat:'anal', label:'Logaritmo',        latex:'\\log_{#?} #?'                            },
  { kind:'builtin', id:'anal/ln',              icon:'ln',     cat:'anal', label:'Logaritmo nat.',   latex:'\\ln #?'                                  },
  { kind:'builtin', id:'anal/exp',             icon:'exp',    cat:'anal', label:'Exponencial',      latex:'\\exp\\left(#?\\right)'                   },
  { kind:'builtin', id:'anal/argmin',          icon:'argmin', cat:'anal', label:'argmín',            latex:'\\arg\\min_{#?}\\, #?'                    },
  { kind:'builtin', id:'anal/argmax',          icon:'argmax', cat:'anal', label:'argmáx',            latex:'\\arg\\max_{#?}\\, #?'                    },
  { kind:'builtin', id:'anal/limsup',          icon:'lim̄',    cat:'anal', label:'lim sup',           latex:'\\limsup_{#? \\to #?} #?'                 },
  { kind:'builtin', id:'anal/liminf',          icon:'lim̲',    cat:'anal', label:'lim inf',           latex:'\\liminf_{#? \\to #?} #?'                 },
  { kind:'builtin', id:'anal/diam',            icon:'diam',   cat:'anal', label:'Diámetro',          latex:'\\operatorname{diam}\\left(#?\\right)'     },
  { kind:'builtin', id:'anal/dist',            icon:'d(x,y)', cat:'anal', label:'Distancia',         latex:'d\\left(#?,#?\\right)'                    },
  { kind:'builtin', id:'anal/sign',            icon:'sgn',    cat:'anal', label:'Signo',             latex:'\\operatorname{sgn}\\left(#?\\right)'      },
  { kind:'builtin', id:'anal/res',             icon:'Res',    cat:'anal', label:'Residuo',           latex:'\\operatorname{Res}\\left(#?,#?\\right)'   },

  // ── Estadística ───────────────────────────────────────────────
  { kind:'builtin', id:'stats/prob',           icon:'P()',    cat:'stats', label:'Probabilidad',    latex:'P\\left(#?\\right)'                       },
  { kind:'builtin', id:'stats/prob-cond',      icon:'P(|)',   cat:'stats', label:'Prob. cond.',     latex:'P\\left(#? \\mid #?\\right)'              },
  { kind:'builtin', id:'stats/esp',            icon:'E[]',    cat:'stats', label:'Esperanza',       latex:'\\mathbb{E}\\left[#?\\right]'             },
  { kind:'builtin', id:'stats/esp-cond',       icon:'E[|]',   cat:'stats', label:'Esp. cond.',      latex:'\\mathbb{E}\\left[#? \\mid #?\\right]'    },
  { kind:'builtin', id:'stats/var',            icon:'Var',    cat:'stats', label:'Varianza',        latex:'\\operatorname{Var}\\left(#?\\right)'     },
  { kind:'builtin', id:'stats/cov',            icon:'Cov',    cat:'stats', label:'Covarianza',      latex:'\\operatorname{Cov}\\left(#?,#?\\right)'  },
  { kind:'builtin', id:'stats/corr',           icon:'Corr',   cat:'stats', label:'Correlación',     latex:'\\operatorname{Corr}\\left(#?,#?\\right)' },
  { kind:'builtin', id:'stats/normal',         icon:'𝒩',      cat:'stats', label:'Normal',          latex:'\\mathcal{N}\\left(#?,#?\\right)'         },
  { kind:'builtin', id:'stats/uniforme',       icon:'U(a,b)', cat:'stats', label:'Uniforme',        latex:'\\mathcal{U}\\left(#?,#?\\right)'          },
  { kind:'builtin', id:'stats/binom',          icon:'Bin',    cat:'stats', label:'Binomial',        latex:'\\binom{#?}{#?}'                          },
  { kind:'builtin', id:'stats/poi',            icon:'Poi',    cat:'stats', label:'Poisson',         latex:'\\operatorname{Poi}\\left(#?\\right)'      },
  { kind:'builtin', id:'stats/sim',            icon:'~',      cat:'stats', label:'distribuido como', latex:'#? \\sim #?'                             },
  { kind:'builtin', id:'stats/iid',            icon:'~iid',   cat:'stats', label:'iid',             latex:'\\overset{\\text{iid}}{\\sim}'            },
  { kind:'builtin', id:'stats/media',          icon:'x̄',      cat:'stats', label:'Media',           latex:'\\bar{#@}'                                },
  { kind:'builtin', id:'stats/estimador',      icon:'x̂',      cat:'stats', label:'Estimador',       latex:'\\hat{#@}'                                },
  { kind:'builtin', id:'stats/var-sigma',      icon:'σ²',     cat:'stats', label:'Varianza σ²',     latex:'\\sigma^2'                                },

  // ── Fórmulas clásicas ─────────────────────────────────────────
  { kind:'builtin', id:'classic/euler-id',       icon:'eⁱᵖ',    cat:'classic', label:'Identidad de Euler',          latex:'e^{i\\pi} + 1 = 0'                                                                    },
  { kind:'builtin', id:'classic/euler-form',     icon:'eⁱᶿ',    cat:'classic', label:'Fórmula de Euler',            latex:'e^{i#?} = \\cos #? + i \\sin #?'                                                      },
  { kind:'builtin', id:'classic/pitagoras',      icon:'a²+b²',  cat:'classic', label:'Pitágoras',                   latex:'a^2 + b^2 = c^2'                                                                      },
  { kind:'builtin', id:'classic/cuadratica',     icon:'abc',    cat:'classic', label:'Fórmula cuadrática',          latex:'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'                                            },
  { kind:'builtin', id:'classic/binomio',        icon:'(a+b)ⁿ', cat:'classic', label:'Binomio de Newton',           latex:'(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k'                                  },
  { kind:'builtin', id:'classic/taylor',         icon:'Tₙ',     cat:'classic', label:'Serie de Taylor',             latex:'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n'                           },
  { kind:'builtin', id:'classic/maclaurin-e',    icon:'eˣ',     cat:'classic', label:'Serie eˣ',                    latex:'e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}'                                          },
  { kind:'builtin', id:'classic/maclaurin-sin',  icon:'sin x',  cat:'classic', label:'Serie sin x',                 latex:'\\sin x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!}'                    },
  { kind:'builtin', id:'classic/maclaurin-cos',  icon:'cos x',  cat:'classic', label:'Serie cos x',                 latex:'\\cos x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n}}{(2n)!}'                         },
  { kind:'builtin', id:'classic/gauss-integral', icon:'∫e⁻ˣ²',  cat:'classic', label:'Integral gaussiana',          latex:'\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}'                              },
  { kind:'builtin', id:'classic/teo-fund-calc',  icon:'FTC',    cat:'classic', label:'Teo. fundamental del cálculo', latex:'\\int_a^b f\'(x)\\,dx = f(b) - f(a)'                                                 },
  { kind:'builtin', id:'classic/integ-partes',   icon:'∫uv',    cat:'classic', label:'Integración por partes',      latex:'\\int u\\,dv = uv - \\int v\\,du'                                                      },
  { kind:'builtin', id:'classic/stokes',         icon:'∯',      cat:'classic', label:'Teorema de Stokes',           latex:'\\iint_S (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S} = \\oint_{\\partial S} \\mathbf{F} \\cdot d\\mathbf{r}' },
  { kind:'builtin', id:'classic/divergencia',    icon:'∭∇·',    cat:'classic', label:'Teorema de la divergencia',   latex:'\\iiint_V (\\nabla \\cdot \\mathbf{F})\\,dV = \\oiint_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{S}' },
  { kind:'builtin', id:'classic/cauchy',         icon:'∮f',     cat:'classic', label:'Integral de Cauchy',          latex:'\\oint_C f(z)\\,dz = 2\\pi i \\sum \\operatorname{Res}(f, z_k)'                        },
  { kind:'builtin', id:'classic/fourier-trans',  icon:'ℱ',      cat:'classic', label:'Transformada de Fourier',     latex:'\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\,e^{-2\\pi i x \\xi}\\,dx'           },
  { kind:'builtin', id:'classic/fourier-inv',    icon:'ℱ⁻¹',    cat:'classic', label:'Fourier inversa',             latex:'f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi)\\,e^{2\\pi i x \\xi}\\,d\\xi'         },
  { kind:'builtin', id:'classic/laplace-trans',  icon:'ℒ',      cat:'classic', label:'Transformada de Laplace',     latex:'\\mathcal{L}\\{f(t)\\}(s) = \\int_0^{\\infty} e^{-st} f(t)\\,dt'                       },
  { kind:'builtin', id:'classic/conv',           icon:'f★g',    cat:'classic', label:'Convolución',                 latex:'(f * g)(t) = \\int_{-\\infty}^{\\infty} f(\\tau)\\,g(t-\\tau)\\,d\\tau'                },
  { kind:'builtin', id:'classic/cauchy-riemann', icon:'CR',     cat:'classic', label:'Cauchy-Riemann',              latex:'\\frac{\\partial u}{\\partial x} = \\frac{\\partial v}{\\partial y},\\quad \\frac{\\partial u}{\\partial y} = -\\frac{\\partial v}{\\partial x}' },
  { kind:'builtin', id:'classic/bayes',          icon:'P(A|B)', cat:'classic', label:'Teorema de Bayes',            latex:'P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}'                                      },
  { kind:'builtin', id:'classic/ley-grandes-num',icon:'x̄→μ',   cat:'classic', label:'Ley de los grandes números',  latex:'\\bar{X}_n \\xrightarrow{n\\to\\infty} \\mu \\quad \\text{(c.s.)}'                      },
  { kind:'builtin', id:'classic/teo-central-lim',icon:'TCL',    cat:'classic', label:'Teorema central del límite',  latex:'\\frac{\\bar{X}_n - \\mu}{\\sigma/\\sqrt{n}} \\xrightarrow{d} \\mathcal{N}(0,1)'        },
  { kind:'builtin', id:'classic/maxwell',        icon:'∇·E',    cat:'classic', label:'Ec. de Maxwell (Gauss E)',    latex:'\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}'                             },
  { kind:'builtin', id:'classic/schrodinger',    icon:'Ĥψ',     cat:'classic', label:'Ec. de Schrödinger',          latex:'i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi'                             },
  { kind:'builtin', id:'classic/einstein',       icon:'E=mc²',  cat:'classic', label:'Energía relativista',         latex:'E = mc^2'                                                                              },
  { kind:'builtin', id:'classic/lorentz',        icon:'γ',      cat:'classic', label:'Factor de Lorentz',           latex:'\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}'                                             },

  // ── Comandos / decoradores ────────────────────────────────────
  { kind:'builtin', id:'cmd/vec',            icon:'v⃗',      cat:'cmd', label:'Vector',              latex:'\\vec{#@}'                               },
  { kind:'builtin', id:'cmd/hat',            icon:'â',       cat:'cmd', label:'Sombrero',            latex:'\\hat{#@}'                               },
  { kind:'builtin', id:'cmd/tilde',          icon:'ã',       cat:'cmd', label:'Tilde',               latex:'\\tilde{#@}'                             },
  { kind:'builtin', id:'cmd/bar',            icon:'ā',       cat:'cmd', label:'Barra',               latex:'\\bar{#@}'                               },
  { kind:'builtin', id:'cmd/dot',            icon:'ȧ',       cat:'cmd', label:'Punto (derivada)',     latex:'\\dot{#@}'                               },
  { kind:'builtin', id:'cmd/ddot',           icon:'ä',       cat:'cmd', label:'Dos puntos',          latex:'\\ddot{#@}'                              },
  { kind:'builtin', id:'cmd/acute',          icon:'á',       cat:'cmd', label:'Acento agudo',        latex:'\\acute{#@}'                             },
  { kind:'builtin', id:'cmd/grave',          icon:'à',       cat:'cmd', label:'Acento grave',        latex:'\\grave{#@}'                             },
  { kind:'builtin', id:'cmd/check',          icon:'ǎ',       cat:'cmd', label:'Caron / check',       latex:'\\check{#@}'                             },
  { kind:'builtin', id:'cmd/breve',          icon:'ă',       cat:'cmd', label:'Breve',               latex:'\\breve{#@}'                             },
  { kind:'builtin', id:'cmd/mathring',       icon:'å',       cat:'cmd', label:'Anillo',              latex:'\\mathring{#@}'                          },
  { kind:'builtin', id:'cmd/widehat',        icon:'â̂',      cat:'cmd', label:'Sombrero ancho',      latex:'\\widehat{#@}'                           },
  { kind:'builtin', id:'cmd/widetilde',      icon:'ã̃',      cat:'cmd', label:'Tilde ancha',         latex:'\\widetilde{#@}'                         },
  { kind:'builtin', id:'cmd/overrightarrow', icon:'→',       cat:'cmd', label:'Flecha derecha',      latex:'\\overrightarrow{#@}'                    },
  { kind:'builtin', id:'cmd/overleftarrow',  icon:'←',       cat:'cmd', label:'Flecha izquierda',    latex:'\\overleftarrow{#@}'                     },
  { kind:'builtin', id:'cmd/overbrace',      icon:'⏞',       cat:'cmd', label:'Llave encima',        latex:'\\overbrace{#@}^{#?}'                    },
  { kind:'builtin', id:'cmd/underbrace',     icon:'⏟',       cat:'cmd', label:'Llave debajo',        latex:'\\underbrace{#@}_{#?}'                   },
  { kind:'builtin', id:'cmd/overset',        icon:'A͆',       cat:'cmd', label:'Overset',             latex:'\\overset{#?}{#@}'                       },
  { kind:'builtin', id:'cmd/underset',       icon:'A̲',       cat:'cmd', label:'Underset',            latex:'\\underset{#?}{#@}'                      },
  { kind:'builtin', id:'cmd/xleftarrow',     icon:'←label',  cat:'cmd', label:'Flecha ← con texto',  latex:'\\xleftarrow{#?}'                        },
  { kind:'builtin', id:'cmd/xrightarrow',    icon:'→label',  cat:'cmd', label:'Flecha → con texto',  latex:'\\xrightarrow{#?}'                       },
  { kind:'builtin', id:'cmd/xmapsto',        icon:'↦label',  cat:'cmd', label:'Mapsto con texto',    latex:'\\xmapsto{#?}'                           },
  { kind:'builtin', id:'cmd/not',            icon:'≠',       cat:'cmd', label:'Negación (\\not)',    latex:'\\not{#@}'                               },
  { kind:'builtin', id:'cmd/cancel',         icon:'a̶',       cat:'cmd', label:'Cancelar',            latex:'\\cancel{#@}'                            },
  { kind:'builtin', id:'cmd/bcancel',        icon:'a̷',       cat:'cmd', label:'Cancelar inverso',    latex:'\\bcancel{#@}'                           },
  { kind:'builtin', id:'cmd/boxed',          icon:'☐',       cat:'cmd', label:'Recuadro',            latex:'\\boxed{#@}'                             },
  { kind:'builtin', id:'cmd/pmod',           icon:'(mod)',    cat:'cmd', label:'Módulo (pmod)',        latex:'\\pmod{#@}'                              },
  { kind:'builtin', id:'cmd/bmod',           icon:'mod',     cat:'cmd', label:'Módulo (bmod)',        latex:'#? \\bmod #?'                            },
  { kind:'builtin', id:'cmd/phantom',        icon:'░',       cat:'cmd', label:'Fantasma (espacio)',   latex:'\\phantom{#@}'                           },
  { kind:'builtin', id:'cmd/mathbf',         icon:'𝐚',       cat:'cmd', label:'Negrita (mathbf)',    latex:'\\mathbf{#@}'                            },
  { kind:'builtin', id:'cmd/mathit',         icon:'𝑎',       cat:'cmd', label:'Cursiva (mathit)',    latex:'\\mathit{#@}'                            },
  { kind:'builtin', id:'cmd/mathrm',         icon:'a',       cat:'cmd', label:'Romano (mathrm)',      latex:'\\mathrm{#@}'                            },
  { kind:'builtin', id:'cmd/mathsf',         icon:'𝖺',       cat:'cmd', label:'Sans-serif (mathsf)', latex:'\\mathsf{#@}'                            },
  { kind:'builtin', id:'cmd/mathtt',         icon:'𝚊',       cat:'cmd', label:'Mono (mathtt)',        latex:'\\mathtt{#@}'                            },
  { kind:'builtin', id:'cmd/mathcal',        icon:'𝒜',       cat:'cmd', label:'Caligráfico (mathcal)', latex:'\\mathcal{#@}'                         },
  { kind:'builtin', id:'cmd/mathfrak',       icon:'𝔞',       cat:'cmd', label:'Fraktur (mathfrak)',   latex:'\\mathfrak{#@}'                         },
  { kind:'builtin', id:'cmd/boldsymbol',     icon:'𝛂',       cat:'cmd', label:'Negrita símbolo',      latex:'\\boldsymbol{#@}'                       },
  { kind:'builtin', id:'cmd/hbar',           icon:'ℏ',       cat:'cmd', label:'ℏ (hbar)',             latex:'\\hbar'                                  },
  { kind:'builtin', id:'cmd/ell',           icon:'ℓ',       cat:'cmd', label:'ℓ (ell)',              latex:'\\ell'                                   },
  { kind:'builtin', id:'cmd/wp',            icon:'℘',       cat:'cmd', label:'℘ (Weierstrass)',       latex:'\\wp'                                    },
  { kind:'builtin', id:'cmd/angle',         icon:'∠',       cat:'cmd', label:'Ángulo (∠)',           latex:'\\angle'                                 },
  { kind:'builtin', id:'cmd/measuredangle', icon:'∡',       cat:'cmd', label:'Ángulo medido (∡)',   latex:'\\measuredangle'                         },
  { kind:'builtin', id:'cmd/triangle',      icon:'△',       cat:'cmd', label:'Triángulo',             latex:'\\triangle'                              },
  { kind:'builtin', id:'cmd/square',        icon:'□',       cat:'cmd', label:'Cuadrado (□)',         latex:'\\square'                                },
  { kind:'builtin', id:'cmd/diamond',       icon:'◇',       cat:'cmd', label:'Diamante (◇)',         latex:'\\diamond'                               },
  { kind:'builtin', id:'cmd/bullet',        icon:'•',       cat:'cmd', label:'Bullet (•)',            latex:'\\bullet'                                },
  { kind:'builtin', id:'cmd/star',          icon:'⋆',       cat:'cmd', label:'Star (⋆)',             latex:'\\star'                                  },
  { kind:'builtin', id:'cmd/dagger',        icon:'†',       cat:'cmd', label:'Dagger (†)',            latex:'\\dagger'                                },
  { kind:'builtin', id:'cmd/ddagger',       icon:'‡',       cat:'cmd', label:'Double dagger (‡)',    latex:'\\ddagger'                               },
  { kind:'builtin', id:'cmd/prime',         icon:'′',       cat:'cmd', label:'Prima (′)',             latex:"{#@}'"                                   },
  { kind:'builtin', id:'cmd/sharp',         icon:'♯',       cat:'cmd', label:'Sharp (♯)',            latex:'\\sharp'                                 },
  { kind:'builtin', id:'cmd/flat',          icon:'♭',       cat:'cmd', label:'Flat (♭)',             latex:'\\flat'                                  },
  { kind:'builtin', id:'cmd/natural',       icon:'♮',       cat:'cmd', label:'Natural (♮)',          latex:'\\natural'                               },
  { kind:'builtin', id:'cmd/infty',         icon:'∞',       cat:'cmd', label:'Infinito (∞)',          latex:'\\infty'                                 },
  { kind:'builtin', id:'cmd/partial',       icon:'∂',       cat:'cmd', label:'Parcial (∂)',           latex:'\\partial'                               },
  { kind:'builtin', id:'cmd/nabla',         icon:'∇',       cat:'cmd', label:'Nabla (∇)',             latex:'\\nabla'                                 },
  { kind:'builtin', id:'cmd/text',           icon:'abc',     cat:'cmd', label:'Texto en math',        latex:'\\text{#@}'                              },
  { kind:'builtin', id:'cmd/operatorname',   icon:'op',      cat:'cmd', label:'Operador propio',      latex:'\\operatorname{#@}'                      },
  { kind:'builtin', id:'cmd/quad',           icon:'⬚⬚',      cat:'cmd', label:'Espacio quad',         latex:'\\quad'                                 },
  { kind:'builtin', id:'cmd/qquad',          icon:'⬚⬚⬚',     cat:'cmd', label:'Espacio qquad',        latex:'\\qquad'                                },
  { kind:'builtin', id:'cmd/thinspace',      icon:'·',       cat:'cmd', label:'Espacio fino (\\,)',   latex:'\\,'                                     },
  { kind:'builtin', id:'cmd/medspace',       icon:'··',      cat:'cmd', label:'Espacio medio (\\;)',  latex:'\\;'                                     },
  { kind:'builtin', id:'cmd/negthinspace',   icon:'⁻·',      cat:'cmd', label:'Espacio negativo',     latex:'\\!'                                     },
  { kind:'builtin', id:'cmd/displaystyle',   icon:'D',       cat:'cmd', label:'Display style',        latex:'\\displaystyle #@'                       },
  { kind:'builtin', id:'cmd/textstyle',      icon:'T',       cat:'cmd', label:'Text style',           latex:'\\textstyle #@'                          },
  { kind:'builtin', id:'cmd/scriptstyle',    icon:'s',       cat:'cmd', label:'Script style',         latex:'\\scriptstyle #@'                        },

  // ── Entornos matemáticos ──────────────────────────────────────
  { kind:'builtin', id:'menv/cases',         icon:'{ }',    cat:'menv', label:'cases',               latex:'\\begin{cases} #@ & \\text{si } #? \\\\ #? & \\text{si } #? \\end{cases}'            },
  { kind:'builtin', id:'menv/aligned',       icon:'align',  cat:'menv', label:'aligned',             latex:'\\begin{aligned} #@ &= #? \\\\ #? &= #? \\end{aligned}'                              },
  { kind:'builtin', id:'menv/align-star',    icon:'align*', cat:'menv', label:'align* (bloque)',     latex:'\\begin{align*} #@ &= #? \\\\ #? &= #? \\end{align*}'                                },
  { kind:'builtin', id:'menv/gather',        icon:'gather', cat:'menv', label:'gather*',             latex:'\\begin{gather*} #@ \\\\ #? \\end{gather*}'                                          },
  { kind:'builtin', id:'menv/split',         icon:'split',  cat:'menv', label:'split',               latex:'\\begin{split} #@ &= #? \\\\ &\\quad #? \\end{split}'                                },
  { kind:'builtin', id:'menv/pmatrix',       icon:'(M)',    cat:'menv', label:'pmatrix (parén)',      latex:'\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}'                               },
  { kind:'builtin', id:'menv/bmatrix',       icon:'[M]',    cat:'menv', label:'bmatrix (corchetes)', latex:'\\begin{bmatrix} #? & #? \\\\ #? & #? \\end{bmatrix}'                               },
  { kind:'builtin', id:'menv/vmatrix',       icon:'|M|',    cat:'menv', label:'vmatrix (det)',       latex:'\\begin{vmatrix} #? & #? \\\\ #? & #? \\end{vmatrix}'                               },
  { kind:'builtin', id:'menv/Vmatrix',       icon:'‖M‖',    cat:'menv', label:'Vmatrix (norma)',     latex:'\\begin{Vmatrix} #? & #? \\\\ #? & #? \\end{Vmatrix}'                               },
  { kind:'builtin', id:'menv/matrix',        icon:'M',      cat:'menv', label:'matrix (sin delim.)', latex:'\\begin{matrix} #? & #? \\\\ #? & #? \\end{matrix}'                                 },
  { kind:'builtin', id:'menv/smallmatrix',   icon:'sM',     cat:'menv', label:'smallmatrix',         latex:'\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}'                               },
  { kind:'builtin', id:'menv/array',         icon:'arr',    cat:'menv', label:'array',               latex:'\\begin{array}{#?} #? & #? \\\\ #? & #? \\end{array}'                               },
  { kind:'builtin', id:'menv/substack',      icon:'sub',    cat:'menv', label:'substack (límites)',  latex:'\\substack{#? \\\\ #?}'                                                              },
  { kind:'builtin', id:'menv/dcases',        icon:'dcases', cat:'menv', label:'dcases (display)',    latex:'\\begin{dcases} #@ & \\text{si } #? \\\\ #? & \\text{si } #? \\end{dcases}'         },

  // ── Teoría de números / Combinatoria ──────────────────────────
  { kind:'builtin', id:'num/binom',          icon:'C(n,k)', cat:'num',  label:'Combinatorio',        latex:'\\binom{#?}{#?}'                                                      },
  { kind:'builtin', id:'num/fact',           icon:'n!',     cat:'num',  label:'Factorial',           latex:'#?!'                                                                  },
  { kind:'builtin', id:'num/perm',           icon:'P(n,k)', cat:'num',  label:'Permutaciones',       latex:'\\frac{#?!}{(#?-#?)!}'                                               },
  { kind:'builtin', id:'num/gcd',            icon:'mcd',    cat:'num',  label:'Máx. común div.',     latex:'\\gcd\\left(#?,#?\\right)'                                           },
  { kind:'builtin', id:'num/lcm',            icon:'mcm',    cat:'num',  label:'Mín. común múlt.',    latex:'\\operatorname{lcm}\\left(#?,#?\\right)'                             },
  { kind:'builtin', id:'num/cong',           icon:'≡ mod',  cat:'num',  label:'Congruencia',         latex:'#? \\equiv #? \\pmod{#?}'                                            },
  { kind:'builtin', id:'num/euler-phi',      icon:'φ(n)',   cat:'num',  label:'Totiente de Euler',   latex:'\\varphi(#?)'                                                        },
  { kind:'builtin', id:'num/moebius',        icon:'μ(n)',   cat:'num',  label:'Función de Möbius',   latex:'\\mu(#?)'                                                            },
  { kind:'builtin', id:'num/legendre',       icon:'(a/p)',  cat:'num',  label:'Símbolo de Legendre', latex:'\\left(\\frac{#?}{#?}\\right)'                                       },
  { kind:'builtin', id:'num/zeta',           icon:'ζ(s)',   cat:'num',  label:'Función Zeta',        latex:'\\zeta(#?)'                                                          },
  { kind:'builtin', id:'num/floor',          icon:'⌊n⌋',    cat:'num',  label:'Piso',                latex:'\\lfloor #? \\rfloor'                                                },
  { kind:'builtin', id:'num/ceil',           icon:'⌈n⌉',    cat:'num',  label:'Techo',               latex:'\\lceil #? \\rceil'                                                  },
  { kind:'builtin', id:'num/stirling2',      icon:'{n,k}',  cat:'num',  label:'Stirling 2ª especie', latex:'\\left\\{\\begin{matrix}#?\\\\#?\\end{matrix}\\right\\}'             },
  { kind:'builtin', id:'num/catalan',        icon:'Cₙ',     cat:'num',  label:'Números de Catalán',  latex:'C_n = \\frac{1}{n+1}\\binom{2n}{n}'                                 },
  { kind:'builtin', id:'num/sum-arith',      icon:'Σk',     cat:'num',  label:'Suma aritmética',     latex:'\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}'                              },
  { kind:'builtin', id:'num/sum-geom',       icon:'Σrᵏ',    cat:'num',  label:'Serie geométrica',    latex:'\\sum_{k=0}^{n} r^k = \\frac{1-r^{n+1}}{1-r}'                       },

  // ── Física ────────────────────────────────────────────────────
  { kind:'builtin', id:'phys/hbar',          icon:'ℏ',      cat:'phys', label:'ℏ (Planck/2π)',       latex:'\\hbar'                                                              },
  { kind:'builtin', id:'phys/ket',           icon:'|ψ⟩',    cat:'phys', label:'Ket |ψ⟩',            latex:'\\left| #? \\right\\rangle'                                          },
  { kind:'builtin', id:'phys/bra',           icon:'⟨ψ|',    cat:'phys', label:'Bra ⟨ψ|',            latex:'\\left\\langle #? \\right|'                                          },
  { kind:'builtin', id:'phys/braket',        icon:'⟨ψ|φ⟩',  cat:'phys', label:'Braket ⟨ψ|φ⟩',      latex:'\\left\\langle #? \\middle| #? \\right\\rangle'                      },
  { kind:'builtin', id:'phys/expval',        icon:'⟨A⟩',    cat:'phys', label:'Valor esperado',      latex:'\\left\\langle #? \\right\\rangle'                                  },
  { kind:'builtin', id:'phys/commut',        icon:'[A,B]',  cat:'phys', label:'Conmutador [A,B]',    latex:'\\left[#?, #?\\right]'                                              },
  { kind:'builtin', id:'phys/anticommut',    icon:'{A,B}',  cat:'phys', label:'Anticonmutador',      latex:'\\left\\{#?, #?\\right\\}'                                          },
  { kind:'builtin', id:'phys/poisson',       icon:'{f,g}',  cat:'phys', label:'Paréntesis de Poisson',latex:'\\left\\{#?, #?\\right\\}_\\mathrm{PB}'                           },
  { kind:'builtin', id:'phys/ham',           icon:'Ĥ',      cat:'phys', label:'Hamiltoniano',        latex:'\\hat{H}'                                                           },
  { kind:'builtin', id:'phys/opdagger',      icon:'Â†',     cat:'phys', label:'Operador adjunto',    latex:'\\hat{#@}^{\\dagger}'                                               },
  { kind:'builtin', id:'phys/schrodinger',   icon:'iℏ∂ψ',   cat:'phys', label:'Schrödinger (forma)', latex:'i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi'        },
  { kind:'builtin', id:'phys/heisenberg',    icon:'ΔxΔp',   cat:'phys', label:'Heisenberg',          latex:'\\Delta x\\,\\Delta p \\geq \\frac{\\hbar}{2}'                      },
  { kind:'builtin', id:'phys/dirac-delta',   icon:'δ(x)',   cat:'phys', label:'Delta de Dirac',      latex:'\\delta\\left(#?\\right)'                                           },
  { kind:'builtin', id:'phys/nabla2',        icon:'∇²',     cat:'phys', label:'Laplaciano',          latex:'\\nabla^2 #?'                                                       },
  { kind:'builtin', id:'phys/wave',          icon:'□ψ',     cat:'phys', label:'Ec. de onda',         latex:'\\frac{\\partial^2 #?}{\\partial t^2} = c^2 \\nabla^2 #?'           },
  { kind:'builtin', id:'phys/maxwell-gauss', icon:'∇·E',    cat:'phys', label:'Maxwell — Gauss E',   latex:'\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}'         },
  { kind:'builtin', id:'phys/maxwell-b',     icon:'∇·B=0',  cat:'phys', label:'Maxwell — Gauss B',   latex:'\\nabla \\cdot \\mathbf{B} = 0'                                    },
  { kind:'builtin', id:'phys/maxwell-farad', icon:'∇×E',    cat:'phys', label:'Maxwell — Faraday',   latex:'\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}' },
  { kind:'builtin', id:'phys/maxwell-amper', icon:'∇×B',    cat:'phys', label:'Maxwell — Ampère',    latex:'\\nabla \\times \\mathbf{B} = \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}' },
  { kind:'builtin', id:'phys/lorentz',       icon:'γ',      cat:'phys', label:'Factor de Lorentz',   latex:'\\gamma = \\frac{1}{\\sqrt{1-v^2/c^2}}'                             },
  { kind:'builtin', id:'phys/emc2',          icon:'E=mc²',  cat:'phys', label:'Energía relativista', latex:'E = mc^2'                                                           },
]

// ── Favorites signal ─────────────────────────────────────────────

const DEFAULT_FAV_IDS = [
  'frac/fraccion',
  'frac/raiz-cuad',
  'frac/potencia',
  'calc/int-def',
  'calc/suma',
  'calc/limite',
  'calc/parcial',
  'frac/paren',
  'alg/mat2',
  'trig/sin',
  'greek/alpha',
  'greek/pi',
  'logic/in',
  'rel/leq',
  'anal/sup',
  'stats/esp',
]

function _loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set(DEFAULT_FAV_IDS)
}

function _saveFavorites(favs: Set<string>): void {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])) } catch { /* ignore */ }
}

export const favorites = signal<Set<string>>(_loadFavorites())

export function toggleFavorite(id: string): void {
  const next = new Set(favorites.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  favorites.value = next
  _saveFavorites(next)
}

// ── User snippets signal ─────────────────────────────────────────

function _loadUserSnippets(): UserSnippet[] {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) return JSON.parse(raw) as UserSnippet[]
  } catch { /* ignore */ }
  return []
}

function _saveUserSnippets(list: UserSnippet[]): void {
  try { localStorage.setItem(USER_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const userSnippets = signal<UserSnippet[]>(_loadUserSnippets())

// ── CRUD ─────────────────────────────────────────────────────────

export function createSnippet(data: Omit<UserSnippet, 'kind' | 'id' | 'createdAt'>): UserSnippet {
  const snippet: UserSnippet = {
    kind: 'user',
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...data,
  }
  const next = [...userSnippets.value, snippet]
  userSnippets.value = next
  _saveUserSnippets(next)
  return snippet
}

export function updateSnippet(id: string, patch: Partial<Pick<UserSnippet, 'name' | 'latex' | 'tags'>>): void {
  const next = userSnippets.value.map(s => s.id === id ? { ...s, ...patch } : s)
  userSnippets.value = next
  _saveUserSnippets(next)
}

export function deleteSnippet(id: string): void {
  const next = userSnippets.value.filter(s => s.id !== id)
  userSnippets.value = next
  _saveUserSnippets(next)
  // also remove from favorites
  const favs = new Set(favorites.value)
  if (favs.has(id)) {
    favs.delete(id)
    favorites.value = favs
    _saveFavorites(favs)
  }
}

export function forkSnippet(source: AnySnippet): UserSnippet {
  const baseName = source.kind === 'builtin' ? source.label : source.name
  return createSnippet({
    name: `${baseName} (copia)`,
    latex: source.latex,
    tags: source.kind === 'builtin' ? [source.cat] : [...source.tags],
    forkedFrom: source.id,
  })
}

// ── Helpers ───────────────────────────────────────────────────────

export const CATS = [
  { id: 'frac',    label: 'Básicos'   },
  { id: 'calc',    label: 'Cálculo'   },
  { id: 'alg',     label: 'Álgebra'   },
  { id: 'logic',   label: 'Lógica'    },
  { id: 'rel',     label: 'Relac.'    },
  { id: 'trig',    label: 'Trig.'     },
  { id: 'anal',    label: 'Análisis'  },
  { id: 'greek',   label: 'Griegas'   },
  { id: 'stats',   label: 'Stats'     },
  { id: 'cmd',     label: 'Comandos'  },
  { id: 'menv',    label: 'Entornos'  },
  { id: 'classic', label: 'Clásicas'  },
  { id: 'num',     label: 'Números'   },
  { id: 'phys',    label: 'Física'    },
  { id: 'user',    label: 'Míos'      },
] as const

export type CatId = typeof CATS[number]['id']

export const allSnippets = computed<AnySnippet[]>(() => [
  ...BUILTIN_SNIPPETS,
  ...userSnippets.value,
])

export function getFavoriteSnippets(): AnySnippet[] {
  const favs = favorites.value
  if (favs.size === 0) return []
  const map = new Map<string, AnySnippet>()
  for (const s of BUILTIN_SNIPPETS) map.set(s.id, s)
  for (const s of userSnippets.value) map.set(s.id, s)
  return [...favs].map(id => map.get(id)).filter((s): s is AnySnippet => s != null)
}

// ── Recently used ─────────────────────────────────────────────────

const RECENT_KEY    = 'formalia:snippet-recent'
const MAX_RECENT    = 12

interface RecentEntry { id: string; usedAt: number }

function _loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw) return JSON.parse(raw) as RecentEntry[]
  } catch { /* ignore */ }
  return []
}

function _saveRecent(list: RecentEntry[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const recentlyUsed = signal<RecentEntry[]>(_loadRecent())

export function recordUsage(id: string): void {
  const filtered = recentlyUsed.value.filter(e => e.id !== id)
  const next = [{ id, usedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT)
  recentlyUsed.value = next
  _saveRecent(next)
}

export function getRecentSnippets(): AnySnippet[] {
  const map = new Map<string, AnySnippet>()
  for (const s of BUILTIN_SNIPPETS) map.set(s.id, s)
  for (const s of userSnippets.value) map.set(s.id, s)
  return recentlyUsed.value
    .map(e => map.get(e.id))
    .filter((s): s is AnySnippet => s != null)
}

/** Translate user-facing $1/$2 syntax to MathLive #@/#? for insertion */
export function toMathLiveLatex(latex: string): string {
  let result = latex
  result = result.replace(/\$1/g, '#@')
  result = result.replace(/\$\d+/g, '#?')
  return result
}
