# ADR-0001 — Google Cloud Build sustituye a GitHub Actions como CI/CD

- Estado: aceptada
- Fecha: 2026-09-09
- Decide: devops-infra (proyecto The Rehab Studio, gobernanza `completo`)
- Afecta a: `cloudbuild.yaml`, `cloudbuild-ci.yaml`, `.github/workflows/deploy-cloudrun.yml`

## Contexto y planteamiento del problema

El despliegue a Cloud Run (`rehab-studio`, `europe-west1`, proyecto
`rehab-studio-web`) lo hacía un workflow de GitHub Actions que se autenticaba
contra Google con Workload Identity Federation. Funcionaba, pero:

- **La configuración no secreta vivía invisible** en los `vars` del repositorio
  de GitHub (17 variables). No estaba versionada, ni revisada, ni auditable: un
  cambio en la web de GitHub cambiaba producción sin dejar rastro en el repo.
  Dos de esos valores (`OWNER_EMAIL`, `CLINIC_ADDRESS`) contenían el marcador
  literal `PENDIENTE` y nadie lo sabía sin abrir la interfaz.
- **No había ninguna puerta de calidad**: los 12 ficheros de test con vitest no
  se ejecutaban nunca en CI. El pipeline era "docker build + push + deploy".
- **El build salía verde sin comprobar nada**: bastaba con que `gcloud run
  deploy` devolviera 0, aunque la revisión nueva sirviera errores en todas las
  rutas.
- El proyecto ya está entero en Google Cloud (Cloud Run, Cloud SQL, Artifact
  Registry, Secret Manager, Vertex AI). Mantener un ejecutor externo con
  federación de identidad es una superficie extra que no aporta nada.

## Opciones consideradas

### A. Seguir en GitHub Actions

Coste cero en minutos (repositorio público), buena experiencia de PR y el
`concurrency:` nativo serializa despliegues. En contra: un tercero ejecuta el
pipeline y hay que mantener WIF; la configuración sigue fuera del repo; e igual
había que escribir de cero el CI y la verificación post-despliegue. No resuelve
el problema real (la configuración invisible y la falta de verificación), solo
cambia de sitio el trabajo.

### B. Google Cloud Build (elegida)

Todo el CI/CD dentro de Google: ninguna credencial sale del proyecto, no hace
falta WIF, el acceso a Artifact Registry, Cloud Run y Secret Manager es IAM
nativo, y el pipeline queda versionado en `cloudbuild.yaml` con las
substituciones no secretas a la vista. GitHub solo notifica el push. En contra:
no existe `concurrency:` y la experiencia de PR es peor que la de Actions.

### C. Mixto (CI en Actions, despliegue en Cloud Build)

Lo mejor de cada uno sobre el papel, pero duplica el sitio donde mirar cuando
algo falla y mantiene el mantenimiento de las dos plataformas. Para un proyecto
de una sola persona, el coste de contexto no compensa.

## Decisión

Se adopta **la opción B**: Cloud Build ejecuta el despliegue (`cloudbuild.yaml`)
y una nueva puerta de calidad para pull requests (`cloudbuild-ci.yaml`).

Decisiones concretas que van con ella:

1. **Dos cuentas de servicio, no una.** El despliegue corre con
   `cloudbuild-deployer@` (run.admin, artifactregistry.writer,
   secretmanager.secretAccessor…). El CI corre con `cloudbuild-ci@`, que solo
   tiene `logging.logWriter` y `storage.objectViewer`: no puede desplegar ni
   leer secretos. **Este repositorio es PÚBLICO y el CI ejecuta código de pull
   requests de terceros** (`npm ci` corre scripts de instalación arbitrarios);
   con una sola cuenta, cualquiera podía abrir una PR y exfiltrar las
   credenciales de producción. Por el mismo motivo, **el disparador de CI debe
   exigir aprobación manual para las PR de personas ajenas al repositorio**
   (`--comment-control=COMMENTS_ENABLED_FOR_EXTERNAL_CONTRIBUTORS_ONLY`, o
   `--require-approval`): sin eso, un desconocido decide qué código corre en
   nuestro proyecto de Google Cloud, aunque sea con permisos mínimos (minado de
   criptomonedas, exfiltración por red, abuso de cuota).
2. **Corte con red de seguridad.** El workflow de GitHub Actions NO se borra ni
   se archiva: se queda activo con un interruptor,
   `if: vars.DEPLOY_VIA_CLOUD_BUILD != 'true'`. Mientras la variable no exista,
   despliega Actions; cuando el primer build de Cloud Build pase en verde se
   pone a `true` y Actions se apaga en el acto. Así la fusión es segura en
   cualquier orden: nunca hay ventana sin despliegue ni dos despliegues a la vez.
3. **Verificación post-despliegue obligatoria.** El build hace una petición HTTP
   real a `/` y `/en` y falla si no responden 200 (con reintentos por el
   arranque en frío, `min-instances 0`).
4. **Imágenes solo de registros de Google.** `gcr.io/cloud-builders/*`,
   `gcr.io/google.com/cloudsdktool/*` y, para Node, el espejo
   `mirror.gcr.io/library/node:22-slim` **fijado por digest**. Docker Hub
   anónimo tiene límite de descargas por IP y produce fallos intermitentes sin
   causa aparente; el digest, además, hace el CI reproducible.
5. **Máquina por defecto** (`e2-standard-2`, dentro de la cuota gratuita) en vez
   de `E2_HIGHCPU_8`. El pipeline dura ~2m20s y su cuello de botella es I/O de
   red, no CPU. Si algún día se mide lo contrario, se sube y se justifica aquí.

## Consecuencias

**A favor**

- Ninguna credencial de producción sale de Google; se puede retirar WIF cuando
  el workflow desaparezca.
- La configuración no secreta del servicio queda versionada y revisable en
  `cloudbuild.yaml`; los secretos siguen siendo referencias a Secret Manager que
  resuelve Cloud Run en arranque.
- Los tests, el lint, el `tsc --noEmit` y el `next build` por fin corren en cada
  PR.
- Un despliegue que no sirva tráfico ya no sale verde.

**En contra y mitigaciones**

- **Se pierde `concurrency:` de GitHub Actions.** Dos pushes seguidos a `master`
  lanzan dos builds en paralelo y el que termine el último deja su revisión
  sirviendo, que puede ser la del commit más viejo. *Mitigación implementada:* un
  paso posterior al despliegue comprueba qué revisión sirve tráfico y falla si
  su imagen no es la de este `$COMMIT_SHA`. Se verifica el resultado en lugar de
  consultar antes con `gcloud builds list` porque preguntar "¿hay otro build en
  curso?" es una carrera en sí misma —el otro puede arrancar justo después de la
  consulta— y exigiría permisos extra de lectura de builds. El estado final del
  servicio sigue siendo el correcto (sirve el commit más nuevo); el build rojo es
  la señal de que este despliegue fue pisado.
- **Peor experiencia de PR**: no hay "checks" nativos tan integrados como los de
  Actions; el resultado se ve como estado de commit y en la consola de Cloud
  Build.
- **Coste**: Cloud Build incluye 2.500 min/mes gratis en `e2-standard-2`. Con un
  pipeline de ~2-3 min y unos pocos despliegues y PR al día, el uso real se
  queda en decenas de minutos al mes: 0 €. GitHub Actions era gratis por ser
  repositorio público, así que el cambio no ahorra dinero — se hace por
  seguridad y trazabilidad, no por coste. Salirse de la cuota gratuita solo
  ocurriría volviendo a máquinas grandes, que es justo lo que se ha quitado.
- **Dependencia de la conexión `gh-rubenbros`** (Cloud Build 2ª generación,
  `europe-west1`): si se borra o caduca la instalación de la GitHub App, dejan de
  dispararse los builds. Los parámetros para recrearla y recrear los
  disparadores están documentados en `README.md` → Deployment.

## Pendiente

- Crear los disparadores (los crea el orquestador; comandos en `README.md`).
- Poner `DEPLOY_VIA_CLOUD_BUILD=true` cuando el primer build salga verde y, acto
  seguido, borrar `.github/workflows/deploy-cloudrun.yml` y las `vars` de GitHub.
- Sustituir los tres valores `PENDIENTE` (`TWILIO_ACCOUNT_SID`,
  `TWILIO_WHATSAPP_FROM`, `OWNER_PHONE`) por los reales cuando existan.
