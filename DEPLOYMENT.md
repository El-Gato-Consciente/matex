# Despliegue — Matex en AWS

> **Qué es este documento.** El registro de **cómo se despliega Matex y por qué así**: las
> decisiones tomadas, la evidencia que las sostiene, y lo que todavía falta. Nació como un
> *handoff* de la app hacia quien decidía la infra; ahora que la decisión está tomada, es la
> referencia de la arquitectura.
>
> Referencia técnica del servicio de compilación:
> [`lambdas/matex/compiler/README.md`](../lambdas/matex/compiler/README.md).

---

## 0 · Correr localmente en paridad con AWS

El mismo stack de dos capas que corre en AWS, sin `vite dev` (que no es representativo):

```bash
docker compose up --build
#  → frontend    http://localhost:8080   (nginx sirviendo el build estático, como S3/CloudFront)
#  → compilador  http://localhost:8787   (la MISMA imagen que va a Lambda)
```

**Por qué es paridad real:**

- El **compilador** es la imagen **idéntica** a la de producción — misma TeX Live, mismos
  paquetes. La única diferencia es el punto de entrada (`node dist/server.js` en vez del handler
  de Lambda), y los dos envuelven la misma app Fastify.
- El **frontend** se buildea y se sirve estático (nginx), igual que S3/CloudFront.
- **CORS y la URL del compilador** están cableados como en prod.

> ⚠️ **El compilador vive en el repo `lambdas`**, no en este: es una lambda
> (`lambdas/matex/compiler/`). El compose lo construye por ruta relativa, así que **los dos
> repos tienen que estar clonados como hermanos** dentro de `el-gato-consciente/`.
>
> La primera build instala TeX Live (~13 min medidos); las siguientes usan caché. Para el front
> con hot-reload (sin paridad), `cd plataforma && npm run dev`.

Archivos: [`docker-compose.yml`](docker-compose.yml) · [`plataforma/Dockerfile`](plataforma/Dockerfile)
+ [`plataforma/nginx.conf`](plataforma/nginx.conf) · `lambdas/matex/compiler/Dockerfile`.

---

## 1 · La arquitectura, y por qué

```
   Usuarios ──HTTPS──▶ CloudFront + WAF
                          ├──▶ S3  matex-static-egc-prod        (frontend estático)
                          └──▶ API Gateway ──▶ Lambda (imagen)  (POST /api/compile)
                                                  └─ TeX Live, stateless, sin DB
```

**Lambda con imagen de contenedor, no ECS/Fargate ni EC2.** La versión anterior de este
documento afirmaba *"Lambda no encaja: TeX Live es muy pesado"*. **Es incorrecto**, y la
diferencia de costo no es marginal:

| Opción | Idle/mes | Nota |
|---|---:|---|
| **Lambda (imagen)** | **~$0,50** | solo ECR; el cómputo se paga por compilación |
| ECS Fargate 1 vCPU/2 GB + ALB | ~$55 | $36 task 24/7 + $18 ALB. No escala a cero |
| App Runner | ~$7-10 | pero es una **segunda puerta pública fuera de CloudFront** |
| EC2 t4g.small | ~$12 | mete VPC + parcheo + TLS propio + SPOF |

Fargate + ALB **multiplicaba por 7 la factura total** de la plataforma (hoy ~$6-8/mes) y
reventaba el budget de $50 ya configurado en IaC, para servir un curso con pocos usuarios
concurrentes.

**Y no es solo plata.** Lambda resuelve gratis tres ítems que estaban abiertos: el aislamiento
por compilación (RB-03, una invocación = un contenedor), la concurrencia (la serialización
interna deja de importar), y el techo de gasto (`reserved_concurrent_executions` es un límite
duro, no una alarma).

### Restricciones a tener presentes

| Límite | Valor | Consecuencia |
|---|---|---|
| Tamaño de imagen | 10 GB | la nuestra: **3,26 GB** (un tercio) |
| Timeout vía API Gateway | ~29 s | `COMPILE_TIMEOUT_MS` debe quedar por debajo |
| Payload de respuesta | 6 MB | un PDF muy pesado no entra → ver §4 (caché en S3) |
| Payload de request | 6 MB | `BODY_LIMIT_BYTES` (50 MB) hay que bajarlo |
| Filesystem | solo `/tmp` escribible | resuelto con env vars en el Dockerfile |

Si el techo de 29 s molesta, la escotilla es un **Lambda Function URL con OAC detrás de
CloudFront** (60 s, ampliable a 180 por cuota) sin abrir puerta nueva.

---

## 2 · Superficie de configuración

### Compilador — variables de entorno

| Var | Default | En producción |
|-----|---------|---------------|
| `CORS_ORIGIN` | cualquier `localhost` (dev) | **fijar** a `https://matex.el-gato-consciente.com` |
| `COMPILE_TIMEOUT_MS` | `60000` | **bajar a ~25000** (techo de API Gateway) |
| `BODY_LIMIT_BYTES` | `50000000` | **bajar a ~5 MB** (límite de evento de Lambda) |
| `ORIGIN_SECRET` | — | el secreto que inyecta CloudFront (ver §3) |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | solo aplican al adaptador servidor |

### Endpoints

- `POST /api/compile` → `200 application/pdf` · `422` diagnósticos · `400` request inválido ·
  `403` no vino por CloudFront.
- `GET /health` → `{ ok: true }`. Exento del guard: smoke test del despliegue.

### Frontend

- `VITE_COMPILE_API_URL = https://el-gato-consciente.com/api` (se fija **en build time**;
  `RemoteCompiler` le concatena `/compile`).
- Build: `cd plataforma && npm run build` → `plataforma/dist/`.

---

## 3 · Lo que el código ya resuelve

Compilar LaTeX ajeno sin comprometer la máquina está mitigado en
[`LatexmkCompiler.ts`](../lambdas/matex/compiler/src/compiler/LatexmkCompiler.ts):

- ✅ **`-no-shell-escape`** — sin `\write18`.
- ✅ **`openin_any=p` / `openout_any=p`** — el documento no sale de su carpeta temporal.
- ✅ **Timeout con `SIGKILL`** — corta bucles infinitos.
- ✅ **Directorio temporal aislado por compilación** (`mkdtemp`), borrado al terminar.
- ✅ **Saneo de rutas** (`paths.ts`) — sin absolutas ni `..`; `mainFile` anidado se rechaza.
- ✅ **Usuario sin privilegios** + **un contenedor por invocación** (gratis en Lambda) = RB-03.
- ✅ **Health check** (`/health`).
- ✅ **Guard de origin** ([`originGuard.ts`](../lambdas/matex/compiler/src/originGuard.ts)):
  CloudFront inyecta `x-origin-secret` y el servicio rechaza con 403 lo que no lo traiga.
  Cierra el agujero de pegarle directo al `execute-api` salteando el WAF — que para un
  endpoint de compilación es *la* puerta del abuso. Rechazar cuesta **2 ms** contra los
  ~220 ms de una compilación.

### Paquetes de TeX Live — cómo se decidió la lista

No es a ojo: `npm run verify:content` (desde `plataforma/`) compila los 154 documentos reales
contra la imagen y reporta cada `File 'x.sty' not found`. Cuatro vueltas de
verificar→instalar (33 → 17 → 4 → 0 fallos) porque **los faltantes salen en cascada**: un
`.sty` ausente aborta la compilación y esconde los siguientes. Hoy da **154/154**.

Si se recorta la lista, hay que correr el script **completo**, no un smoke.

---

## 4 · Lo que falta

### 4.1 Anti-abuso
- [ ] **Regla rate-based del WAF scopeada a `/api/compile`.** Ya existe `RateLimitGeneral`
      (200 req/5 min por IP, en `BLOCK`) y el geo-block; lo que falta es un límite **mucho más
      bajo** solo para el path de compilación — 200 compilaciones de LaTeX por IP es una
      barbaridad. Los *managed rule groups* siguen en `COUNT` (monitoreo gratis), y está bien.
- [ ] **Acción `Challenge` del WAF** — reto JS silencioso, **sin costo por reto** (a diferencia
      de `CAPTCHA`, $0,40/1000). Requiere el SDK JS de AWS WAF en el front.
- [ ] **Cuota por identidad** en DynamoDB (`pk = sub`, contador atómico + TTL → 429). Ni el JWT
      ni el WAF cuentan compilaciones; es lo único que acota a un atacante ya autenticado.
- [ ] `reserved_concurrent_executions` como techo duro de gasto.

### 4.2 Autenticación (Cognito)
- [ ] **User pool** + authorizer JWT en `POST /api/compile`. Cierra además el agujero actual:
      el authorizer `google_jwt` valida solo `issuer` + `audience`, así que el universo de
      usuarios válidos es "todo Google" acotado únicamente por la lista de test users en la
      consola de Google — un control que vive fuera del repo y **desaparece en silencio** si la
      app se pasa a *In production*. Con user pool, existen solo los usuarios que se crean.
- [ ] Regla de producto: el **curso no requiere login** (§4.3); compilar LaTeX propio sí.

### 4.3 Costos y caché
- [ ] **Precompilar el curso en CI** → S3/CloudFront. Las 51 lecciones + ejemplares +
      plantillas son deterministas y `verify:content` **ya las compila y tira los PDFs**.
      Guardarlos saca la mayor parte de la carga del compilador en vivo y hace que el camino de
      onboarding no lo toque nunca.
- [ ] **Caché por hash del input** (RB-05) en S3: resuelve de una vez el límite de 6 MB de
      respuesta, el costo de recompilar lo mismo, y el abuso por reintento.
- [ ] Tope de gasto + alarmas: **ya existe** (unit `billing`, $50/mes). Revisar el valor cuando
      entre el compilador.

### 4.4 Frontend estático en S3 — tres comportamientos a reproducir
`plataforma/nginx.conf` los documenta; en S3/CloudFront hay que rehacerlos:
- [ ] **SPA fallback:** 404/403 → `/index.html` con 200. Sin esto, refrescar una ruta da 404.
      *(El unit `cloudfront_spa` de `cf-matex` ya lo trae.)*
- [ ] **MIME de `.mjs` = JavaScript.** El worker de PDF.js es un `.mjs`; con el content-type
      equivocado **el visor de PDF se rompe** con un error que no dice nada. `aws s3 sync`
      adivina mal → hay que forzarlo en el workflow. *(Verificado OK en el nginx local.)*
- [ ] **Cache headers:** `/assets/*` (hasheados) inmutables; `index.html` sin cache.

### 4.5 Observabilidad
- [ ] Logs de Lambda a CloudWatch (retención corta por costo).
- [ ] Alarmas: tasa de error, duración de `/compile`, throttles, 403 del guard.

---

## 5 · Cómo se despliega

| Pieza | Repo | Camino |
|---|---|---|
| Frontend | `matex` | push a `main` → workflow → `aws s3 sync plataforma/dist/` a `matex-static-egc-prod` + invalidación de `cf-matex` |
| Compilador | `lambdas` | push a `main` → dispara `iac/apply.yml` → el módulo construye la imagen, la publica en ECR y actualiza la Lambda |
| Infra | `iac` | Terragrunt/OpenTofu, `live/prod/terragrunt.stack.hcl` |

Las 154 compilaciones de `verify:content` corren en CI del repo `matex` (job `content`, solo en
`main`) contra la imagen construida desde el repo `lambdas` — no contra un TeX Live cualquiera.
