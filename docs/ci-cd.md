# Pipeline CI/CD

## 1. Objetivo

El proyecto implementa una estrategia de Integración Continua (CI) y Entrega/Despliegue Continuo (CD), utilizando GitHub Actions para automatizar la validación del código, la construcción de imágenes Docker y su publicación en un registro de contenedores.

El objetivo del pipeline es garantizar que los cambios puedan integrarse de manera segura y que las versiones preparadas de la aplicación estén disponibles para su despliegue en el entorno de Staging.

La estrategia contempla dos procesos diferenciados:

- **CI:** valida la calidad e integridad del código mediante instalación de dependencias, generación de Prisma, análisis estático, pruebas y compilación.
- **CD:** construye las imágenes Docker del backend y frontend y las publica en GitHub Container Registry (GHCR), preparándolas para su posterior despliegue en Azure.

## 2. Tecnologías utilizadas

El pipeline utiliza las siguientes tecnologías:

- GitHub para el control de versiones y gestión de Pull Requests.
- GitHub Actions para la automatización de los workflows.
- Node.js 24 para la ejecución del proyecto.
- pnpm 10.33.0 como gestor de paquetes.
- Prisma como ORM del backend.
- ESLint y Oxlint para la validación de código.
- Vitest para la ejecución de pruebas.
- Next.js para el frontend.
- NestJS para el backend.
- Docker para la contenerización de los servicios.
- Docker Buildx y BuildKit para la construcción optimizada de imágenes.
- GitHub Container Registry (GHCR) para almacenar las imágenes Docker.
- Azure como infraestructura del entorno de Staging.
- Supabase para los servicios de base de datos y autenticación.

## 3. Flujo general del pipeline

El flujo del proyecto se basa en la integración progresiva del código mediante Git Flow.

```text
feature/*
    |
    | Pull Request
    v
 develop
    |
    v
GitHub Actions CI
    |
    v
Validación de código
    |
    v
CI aprobado
    |
    v
Push a develop
    |
    v
GitHub Actions CD
    |
    v
Build y publicación Docker
    |
    +-------------------+
    |                   |
    v                   v
Backend GHCR       Frontend GHCR
    |                   |
    +---------+---------+
              |
              v
       Job de despliegue
              |
              v
       Conexión SSH Azure
              |
              v
       Docker Compose pull
              |
              v
       Docker Compose up -d
              |
              v
         Health checks
```

La rama develop representa la rama de integración y se utiliza como referencia para el entorno Staging.

La rama main representa la versión estable del proyecto. El despliegue automático hacia Producción no forma parte del alcance implementado actualmente.

La etapa de despliegue remoto ya se encuentra incorporada en el workflow local de CD, pero su ejecución y validación integral todavía están pendientes.

## 4. Integración Continua (CI)

La Integración Continua se encuentra implementada mediante GitHub Actions.

El workflow se encuentra ubicado en:

```text
.github/
└── workflows/
    └── ci.yml
```

El pipeline se ejecuta automáticamente bajo las condiciones definidas en el workflow, incluyendo Pull Requests y actualizaciones de las ramas principales configuradas.

La validación permite comprobar que los cambios puedan instalarse, analizarse, probarse y compilarse correctamente antes de integrarse al proyecto.

## 5. Configuración del entorno

El pipeline utiliza Ubuntu como sistema operativo de ejecución:

```yaml
runs-on: ubuntu-latest
```

Para mantener un entorno reproducible, se establecen versiones específicas de las herramientas principales.

**pnpm**

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 10.33.0
```

**Node.js**

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: pnpm
```

La configuración coincide con las versiones definidas para el proyecto.

## 6. Etapas del pipeline CI

El pipeline cuenta con un job denominado `validate`, compuesto por diferentes etapas de validación.

```text
Checkout
   |
   v
Install dependencies
   |
   v
Generate Prisma Client
   |
   v
Lint
   |
   v
Tests
   |
   v
Build
```

Cada etapa debe completarse correctamente para que el pipeline sea considerado exitoso.

## 7. Checkout del repositorio

La primera etapa obtiene el código fuente del repositorio mediante la acción oficial de GitHub:

```yaml
- name: Checkout
  uses: actions/checkout@v4
```

Esto permite que GitHub Actions disponga del código necesario para ejecutar las siguientes etapas del pipeline.

## 8. Instalación de dependencias

Las dependencias del monorepo se instalan mediante:

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

Se utiliza `--frozen-lockfile` para garantizar que las dependencias instaladas coincidan con las versiones registradas en el archivo `pnpm-lock.yaml`.

De esta manera, el pipeline evita modificar automáticamente el lockfile y permite detectar inconsistencias entre las dependencias declaradas y las registradas en el repositorio.

## 9. Generación del cliente de Prisma

Después de instalar las dependencias, se genera automáticamente el cliente de Prisma:

```yaml
- name: Generate Prisma Client
  run: pnpm --filter backend exec prisma generate
```

Esta etapa prepara el cliente generado que utiliza el backend para interactuar con la base de datos mediante Prisma.

La generación automática dentro del CI permite comprobar que el esquema y la configuración de Prisma puedan generar correctamente el cliente requerido por el backend.

## 10. Lint

El pipeline ejecuta las herramientas de análisis estático mediante:

```yaml
- name: Lint
  run: pnpm lint
```

El comando ejecuta el script definido en el proyecto:

```json
"lint": "pnpm --recursive lint"
```

Esto permite validar el código de los diferentes proyectos incluidos en el workspace, incluyendo:

- Backend mediante Oxlint.
- Frontend mediante ESLint.

Si se detectan errores de lint, el pipeline falla y el cambio no puede considerarse validado.

## 11. Tests

La siguiente etapa ejecuta las pruebas automatizadas:

```yaml
- name: Tests
  run: pnpm test
```

El comando utiliza el script definido en el proyecto:

```json
"test": "pnpm --recursive test"
```

Esta etapa permite comprobar que las pruebas automatizadas existentes se ejecuten correctamente antes de integrar los cambios.

A medida que se desarrollen nuevas funcionalidades, las pruebas correspondientes se incorporarán al proyecto y serán ejecutadas automáticamente por el pipeline.

## 12. Build

La última etapa del CI ejecuta la compilación de los proyectos:

```yaml
- name: Build
  run: pnpm build
```

El comando utiliza el script:

```json
"build": "pnpm --recursive build"
```

Esta etapa permite verificar que el frontend y backend puedan compilarse correctamente con el código que se pretende integrar.

Un error durante la compilación provoca que el pipeline falle.

## 13. Resultado del CI

El pipeline utiliza un único job denominado `validate`.

Dentro de este job se ejecutan las diferentes etapas de validación:

```text
validate
├── Checkout
├── Setup pnpm
├── Setup Node.js
├── Install dependencies
├── Generate Prisma Client
├── Lint
├── Tests
└── Build
```

Se utiliza un único job porque las etapas forman actualmente una secuencia de validación del proyecto.

La separación en múltiples jobs podrá evaluarse posteriormente si el proyecto requiere optimizar los tiempos de ejecución o incorporar validaciones independientes.

---

## 14. Estrategia actual de Continuous Delivery / Deployment (CD)

El CD utiliza GitHub Actions para automatizar la construcción, publicación y despliegue de las imágenes Docker correspondientes al backend y frontend.

El workflow actual se encuentra en:

```text
.github/
└── workflows/
    └── cd.yml
```

Su ejecución se activa cuando se realiza un `push` a la rama `develop`.

Actualmente, el workflow está estructurado en dos jobs:

1. build-and-publish:
- Obtiene el código del repositorio.
- Configura Docker Buildx.
- Se autentica en GHCR.
- Construye y publica la imagen del backend.
- Construye y publica la imagen del frontend.
- Utiliza cachés independientes mediante Docker BuildKit.
- Publica las etiquetas latest y el SHA del commit.

2. deploy:
- Espera a que finalice correctamente build-and-publish.
- Establece una conexión SSH con la VM de Azure.
- Accede al directorio del proyecto.
- Descarga las imágenes mediante docker compose pull.
- Actualiza los servicios mediante docker compose up -d --remove-orphans.
- Ejecuta comprobaciones HTTP para verificar la disponibilidad del backend y frontend.
- La dependencia needs: build-and-publish garantiza que el despliegue no se ejecute si falla la construcción o publicación de las imágenes.
- La configuración del job deploy ya está incorporada al workflow local. Sin embargo, todavía falta ejecutar y validar el proceso completo desde GitHub Actions.

## 15. Construcción y publicación de imágenes Docker

### 15.1. Configuración del workflow

El workflow utiliza los siguientes permisos:

```yaml
permissions:
  contents: read
  packages: write
```

- `contents: read`: permite obtener el código del repositorio.
- `packages: write`: permite publicar imágenes en GitHub Container Registry.

Para preparar la construcción se utilizan las acciones:

```yaml
- name: Obtener código
  uses: actions/checkout@v4

- name: Configurar Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Autenticarse en GHCR
  uses: docker/login-action@v3
```

La autenticación en GHCR utiliza `GITHUB_TOKEN`, evitando almacenar manualmente un token adicional para publicar las imágenes.

### 15.2. Construcción del backend

La imagen del backend se construye utilizando:

- Dockerfile: `docker/backend/Dockerfile`.
- Contexto: raíz del repositorio.
- Acción: `docker/build-push-action@v6`.
- Publicación: habilitada mediante `push: true`.

El nombre de la imagen es:

```text
ghcr.io/manuu2102/proyecto-tis-semestre-2-2026-backend
```

Se publican dos etiquetas:

- `latest`: referencia a la imagen más reciente publicada.
- `${{ github.sha }}`: identifica el commit exacto utilizado para construir la imagen.

Esto permite identificar qué versión del código corresponde a cada imagen publicada.

### 15.3. Construcción del frontend

La imagen del frontend se construye utilizando:

- Dockerfile: `docker/frontend/Dockerfile`.
- Contexto: raíz del repositorio.
- Acción: `docker/build-push-action@v6`.
- Publicación: habilitada mediante `push: true`.

El nombre de la imagen es:

```text
ghcr.io/manuu2102/proyecto-tis-semestre-2-2026-frontend
```

Al igual que el backend, se publican las etiquetas `latest` y el SHA del commit.

Durante la construcción se proporcionan los siguientes argumentos:

- `NEXT_PUBLIC_API_URL`.
- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Las variables de configuración de Supabase se obtienen de GitHub Secrets. No se deben escribir credenciales sensibles directamente en el repositorio ni en los archivos de documentación.

La clave pública `anon` de Supabase no debe confundirse con `service_role`, que nunca debe exponerse en el frontend.

### 15.4. GitHub Container Registry (GHCR)

Las imágenes se almacenan en GitHub Container Registry:

```text
Backend:
ghcr.io/manuu2102/proyecto-tis-semestre-2-2026-backend

Frontend:
ghcr.io/manuu2102/proyecto-tis-semestre-2-2026-frontend
```

GHCR permite almacenar las imágenes construidas por GitHub Actions para que posteriormente puedan ser descargadas por el servidor de Staging.

Para permitir que la VM descargue las imágenes sin autenticación, los paquetes deben tener la visibilidad pública correspondiente. Esta configuración se administra en GHCR y no se hereda automáticamente de la visibilidad del repositorio.

---

## 16. Optimización mediante Docker BuildKit

Durante las primeras ejecuciones del CD se identificó que la construcción de imágenes consumía una cantidad considerable de tiempo.

Una parte importante de ese tiempo correspondía a la instalación de dependencias, la generación de Prisma, la compilación y la exportación de las capas de Docker.

Para optimizar el proceso se incorporó la caché de GitHub Actions mediante Docker BuildKit.

### 16.1. Caché independiente por servicio

Se configuraron ámbitos independientes para evitar mezclar las capas del backend y frontend.

**Backend:**

```yaml
cache-from: type=gha,scope=backend
cache-to: type=gha,mode=max,scope=backend
```

**Frontend:**

```yaml
cache-from: type=gha,scope=frontend
cache-to: type=gha,mode=max,scope=frontend
```

La configuración permite recuperar las capas de construcciones anteriores y reutilizarlas cuando las instrucciones y entradas correspondientes no han cambiado.

Se utiliza `mode=max` para conservar también capas intermedias de las distintas etapas de construcción, incluyendo las relacionadas con las dependencias.

### 16.2. Validación de la caché

La segunda ejecución del workflow permitió comprobar que la caché estaba funcionando correctamente.

En los registros de construcción del backend se observaron:

- Importación del manifiesto de caché desde GitHub Actions.
- Instalación de dependencias marcada como `CACHED`.
- Generación del cliente de Prisma marcada como `CACHED`.
- Compilación del backend marcada como `CACHED`.
- Exportación de caché en aproximadamente 1 segundo.

En el frontend se observaron:

- Importación del manifiesto de caché.
- Instalación de dependencias marcada como `CACHED`.
- Compilación de Next.js marcada como `CACHED`.
- Exportación de caché en aproximadamente 0,9 segundos.

Estos resultados confirman que BuildKit recuperó y reutilizó las capas de construcción correspondientes.

Es importante considerar que una capa marcada como `CACHED` todavía puede requerir descarga y extracción. Por ejemplo, durante la segunda ejecución se recuperó una capa de dependencias del backend de aproximadamente 288 MB, lo que explica parte del tiempo restante de construcción.

### 16.3. Comparación de tiempos

Se compararon dos ejecuciones del workflow:

| Etapa | Primera ejecución | Segunda ejecución |
|---|---:|---:|
| Duración total | 4 min 43 s | 1 min 1 s |
| Construcción backend | 3 min 39 s | 37 s |
| Construcción frontend | 32 s | 6 s |
| Exportación de caché backend | 132,9 s aprox. | 1 s aprox. |
| Exportación de caché frontend | — | 0,9 s aprox. |

La duración total pasó de 283 segundos a 61 segundos.

Esto representa:

- Tiempo ahorrado: 222 segundos.
- Reducción aproximada: 78,4 %.
- Segunda ejecución aproximadamente 4,6 veces más rápida.

La comparación demuestra que la reutilización de caché permitió reducir considerablemente el tiempo de construcción y publicación de las imágenes.

Los tiempos corresponden a las ejecuciones observadas y pueden variar en futuras construcciones dependiendo de los cambios realizados, las capas disponibles en caché y la carga de GitHub Actions.

---

## 17. Control de concurrencia del CD

También se incorporó un mecanismo de control de concurrencia en el workflow:

```yaml
concurrency:
  group: cd-staging-${{ github.ref }}
  cancel-in-progress: true
```

Esta configuración agrupa las ejecuciones correspondientes a una misma referencia del repositorio.

Cuando llega una nueva ejecución para el mismo grupo, una ejecución anterior puede ser cancelada para evitar que varias ejecuciones obsoletas compitan simultáneamente.

Esto resulta útil para el entorno Staging, ya que permite priorizar la construcción de la versión más reciente de `develop`.

El control de concurrencia no acelera directamente la construcción de las imágenes. La reducción principal de tiempo observada se debe a la reutilización de caché de Docker BuildKit.

---

## 18. Entorno Staging en Azure

El proyecto dispone de una máquina virtual en Azure que utiliza Ubuntu como sistema operativo y Docker Compose para ejecutar los servicios de la aplicación.

La infraestructura utiliza contenedores independientes:

- `tis-backend-staging`.
- `tis-frontend-staging`.

La arquitectura de ejecución es:

```text
              Azure VM
                  |
                  v
            Docker Compose
                  |
          +-------+-------+
          |               |
          v               v
      Backend          Frontend
      NestJS             Next.js
      :3001              :3000
          |               |
          +-------+-------+
                  |
                  v
               Supabase
              PostgreSQL
```

El archivo `docker-compose.yml` utiliza imágenes publicadas en GHCR:

```yaml
services:
  backend:
    image: ghcr.io/manuu2102/proyecto-tis-semestre-2-2026-backend:latest
    container_name: tis-backend-staging
    env_file:
      - ./backend/.env
    environment:
      CORS_ORIGIN: ${CORS_ORIGIN}
    ports:
      - "3001:3001"
    restart: unless-stopped

  frontend:
    image: ghcr.io/manuu2102/proyecto-tis-semestre-2-2026-frontend:latest
    container_name: tis-frontend-staging
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped
```

La configuración permite ejecutar las imágenes previamente construidas y publicadas en GHCR, evitando que la VM tenga que reconstruirlas.

El backend obtiene sus variables de ejecución mediante el archivo `backend/.env`, que debe existir en el servidor y mantenerse fuera del repositorio.

### 18.1. Estado de la integración con Azure

La integración con Azure cuenta con los siguientes elementos:

- Construcción de imágenes automatizada mediante GitHub Actions.
- Publicación de imágenes en GHCR.
- Paquetes de backend y frontend configurados como públicos.
- VM de Staging disponible.
- Docker Compose configurado para consumir las imágenes de GHCR.
- Secrets de GitHub configurados para la conexión SSH.
- Job deploy incorporado al workflow de CD.
- Comprobaciones HTTP incorporadas al procedimiento de despliegue.

La ruta del proyecto en la VM es:

```text
/home/tisadmin/apps/Proyecto-TIS-semestre-2-2026
```
Se realizaron comprobaciones directas en Azure que confirmaron respuestas HTTP 200 en:

```text
Backend:  http://127.0.0.1:3001/
Frontend: http://127.0.0.1:3000/login
``` 
Estas comprobaciones confirman la disponibilidad actual de ambos servicios, pero todavía no constituyen una validación del despliegue automático.

### 18.2. Procedimiento automatizado de despliegue

El job deploy utiliza una conexión SSH desde GitHub Actions hacia la VM de Azure.

La autenticación utiliza los siguientes GitHub Secrets:

- AZURE_HOST.
- AZURE_USERNAME.
- AZURE_SSH_KEY.

Una vez establecida la conexión, el procedimiento configurado realiza las siguientes operaciones:

1. Accede al directorio del proyecto en Azure.
2. Descarga las imágenes actualizadas mediante:
```text
docker compose pull
```
3. Actualiza los contenedores:
```text
docker compose up -d --remove-orphans
```
4. Comprueba el estado de los servicios:
```text
docker compose ps
```
5. Ejecuta comprobaciones HTTP para verificar las respuestas del backend y frontend.

Las comprobaciones utilizan las siguientes direcciones:
```text
http://127.0.0.1:3001/
http://127.0.0.1:3000/login
```
El workflow espera hasta 30 intentos, con intervalos de cinco segundos, para permitir que los servicios se inicien.

Si las comprobaciones no son satisfactorias, el job devuelve un error y muestra el estado y los registros recientes de los contenedores.

La construcción de las imágenes permanece centralizada en GitHub Actions. Por este motivo, la VM utiliza docker compose pull y no necesita ejecutar docker compose up -d --build.

La ejecución de este procedimiento desde GitHub Actions todavía está pendiente de validación.

## 19. Variables de entorno y secretos

Las credenciales y configuraciones sensibles no deben formar parte del repositorio.

El proyecto utiliza variables de entorno para configurar la conexión con los servicios externos y los diferentes componentes de la aplicación.

Para la construcción del frontend se utilizan:

| Variable | Función |
|---|---|
| `NEXT_PUBLIC_API_URL` | Dirección de la API del backend |
| `NEXT_PUBLIC_SUPABASE_URL` | Dirección del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de acceso de Supabase |

Las variables de Supabase se proporcionan mediante GitHub Secrets.

Para el despliegue remoto hacia Azure se utilizan:

| GitHub Secret | Función |
|---|---|
| `AZURE_HOST` | Dirección de la máquina virtual |
| `AZURE_USERNAME` | Usuario SSH de conexión |
| `AZURE_SSH_KEY` | Clave privada utilizada para la autenticación SSH |

La clave privada se almacena exclusivamente en GitHub Secrets y no debe incorporarse al repositorio ni exponerse en los registros del workflow.

Para la ejecución del backend en Azure se utiliza un archivo `.env` almacenado en el servidor.

```text
backend/
├── .env
└── .env.example
```

- `.env`: contiene los valores de configuración del entorno y no debe versionarse.
- `.env.example`: documenta los nombres y la estructura de las variables requeridas, sin incluir credenciales reales.

Las claves privadas, contraseñas y tokens de acceso deben administrarse mediante mecanismos seguros, como GitHub Secrets o variables protegidas del entorno correspondiente.

---

## 20. Estado actual de implementación

La siguiente tabla resume el estado de los componentes de CI/CD:

| Componente | Estado |
|---|---|
| Git Flow | Implementado |
| GitHub Actions CI | Implementado |
| Instalación de dependencias | Implementada |
| Generación de Prisma | Implementada |
| Lint | Implementado |
| Tests | Implementados |
| Build del proyecto | Implementado |
| CI para Pull Requests y ramas configuradas | Implementado |
| Workflow CD para develop | Implementado |
| Construcción Docker del backend | Implementada y validada |
| Construcción Docker del frontend | Implementada y validada |
| Publicación de imágenes en GHCR | Implementada y validada |
| Etiquetas latest y SHA | Implementadas |
| Caché BuildKit independiente | Implementada y validada |
| Control de concurrencia | Implementado |
| VM de Staging en Azure | Disponible |
| Packages GHCR públicos | Configurados |
| Secrets SSH de Azure | Configurados |
| Job de despliegue SSH | Incorporado, pendiente de validación |
| Actualización automática de contenedores | Pendiente de validación |
| Health checks posteriores al despliegue | Incorporados, pendientes de validación |
| Rollback automatizado | Pendiente |
| Prueba integral de CD de extremo a extremo | Pendiente |
| CD automático hacia Producción | Fuera del alcance actual |

### 20.1. Porcentaje estimado de avance del reestructuramiento de CD

Considerando los hitos técnicos implementados y las tareas pendientes, se mantiene una estimación de avance aproximada del 85 %.

Avance general estimado
```text
Completado  85 %  █████████████████░░░
Pendiente   15 %  ░░░
```
El porcentaje representa una estimación del trabajo de reestructuración y no una métrica generada automáticamente por GitHub Actions.

La construcción, publicación y optimización de imágenes ya están implementadas y validadas. Además, se incorporó al workflow la conexión SSH, la actualización de contenedores y las comprobaciones HTTP. El trabajo restante se concentra en validar el despliegue completo y desarrollar un mecanismo de recuperación ante fallos.

## 21. Evolución prevista del CD

Para completar la reestructuración del proceso de CD se establecen las siguientes tareas:

1. Validación del despliegue remoto: ejecutar el nuevo job deploy desde GitHub Actions y comprobar que actualice correctamente los contenedores de Azure.
2. Verificación automática: confirmar que los health checks detecten correctamente la disponibilidad de ambos servicios.
3. Rollback: establecer un procedimiento para regresar a una versión anterior si el despliegue falla.
4. Prueba integral: comprobar el proceso completo desde un cambio en develop hasta la ejecución de la nueva versión en Azure.

La arquitectura esperada una vez completada la validación será:
```text
           Push a develop
                 |
                 v
          GitHub Actions
                 |
                 v
            Build Docker
                 |
                 v
            Publish GHCR
                 |
                 v
             Conexión SSH
                 |
                 v
              Azure VM
                 |
                 v
            Docker Compose
                 |
                 v
       Actualizar contenedores
                 |
                 v
            Health Checks
                 |
           +-----+-----+
           |           |
           v           v
        Exitoso       Error
           |           |
           v           v
        Staging    Recuperación
       actualizado  (rollback)
```
La automatización de Producción podrá evaluarse posteriormente, una vez que el proceso de Staging esté completamente implementado y validado.

## 22. Conclusión

El proyecto cuenta con una base funcional de Integración Continua mediante GitHub Actions, que automatiza la instalación de dependencias, la generación del cliente de Prisma, el análisis estático del código, la ejecución de pruebas y la compilación.

En cuanto al CD, se logró automatizar la construcción y publicación de imágenes Docker del backend y frontend en GitHub Container Registry. También se incorporó Docker BuildKit con cachés independientes y un mecanismo de control de concurrencia. Las pruebas realizadas demostraron una reducción aproximada del 78,4 % en el tiempo observado de construcción y publicación.

Como siguiente avance, se incorporó un job de despliegue remoto mediante SSH al workflow de CD. Este job está preparado para descargar las imágenes desde GHCR, actualizar los contenedores de Azure mediante Docker Compose y comprobar la disponibilidad de los servicios mediante verificaciones HTTP.

Las comprobaciones directas realizadas en la VM confirmaron que el backend y frontend responden correctamente. Sin embargo, todavía es necesario validar el proceso completo mediante una ejecución real de GitHub Actions y completar el mecanismo de rollback.

De esta manera, el proyecto ha avanzado desde la automatización de la construcción y publicación de imágenes hacia un proceso de despliegue continuo integrado con Azure Staging.
