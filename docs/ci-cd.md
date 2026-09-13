# Pipeline CI/CD

## 1. Objetivo

El proyecto implementa una estrategia de Integración Continua (CI) y establece la arquitectura base para la futura implementación de Entrega/Despliegue Continuo (CD).

El objetivo del pipeline es automatizar la validación del código cada vez que se realiza un cambio relevante en las ramas de integración y producción, garantizando que el proyecto pueda ser integrado de manera segura antes de avanzar hacia los entornos de Staging y Producción.

La implementación del CD se realizará progresivamente junto con la preparación del entorno Staging definido para la siguiente etapa del proyecto.

---

## 2. Tecnologías utilizadas

El pipeline utiliza las siguientes tecnologías:

- GitHub para el control de versiones y gestión de Pull Requests.
- GitHub Actions para la automatización del pipeline.
- Node.js 24 para la ejecución del proyecto.
- pnpm 10.33.0 como gestor de paquetes.
- Prisma como ORM del backend.
- ESLint y Oxlint para la validación de código.
- Vitest para la ejecución de pruebas.
- Next.js para el frontend.
- NestJS para el backend.
- Docker y DigitalOcean como parte de la arquitectura de despliegue prevista.

---

## 3. Flujo general del pipeline

El flujo definido para el proyecto se basa en la integración progresiva del código mediante Git Flow.

```text
feature/*
     |
     | Pull Request
     v
  develop
     |
     | CI
     v
+----------------------+
| GitHub Actions       |
|                      |
| 1. Install           |
| 2. Prisma Generate   |
| 3. Lint              |
| 4. Tests             |
| 5. Build             |
+----------+-----------+
           |
           | CI aprobado
           v
       develop
           |
           | Pull Request
           v
         main
           |
           | CD (futuro)
           v
      Producción
```

La rama develop representa el entorno de integración y posteriormente será asociada al entorno Staging.

La rama main representa la versión estable del proyecto y posteriormente será asociada al entorno de Producción.

---

## 4. Integración Continua (CI)

La Integración Continua se encuentra implementada mediante GitHub Actions.

El workflow se encuentra ubicado en:

```text
.github/
└── workflows/
    └── ci.yml
```

El pipeline se ejecuta automáticamente bajo las siguientes condiciones:

- Pull Requests

Se ejecuta cuando se crea o actualiza un Pull Request dirigido hacia:

- develop
- main
- Push

También se ejecuta cuando se realiza un push directamente sobre:

- develop
- main

Esto permite validar automáticamente los cambios antes de integrarlos a las ramas principales del proyecto.

---

## 5. Configuración del entorno

El pipeline utiliza Ubuntu como sistema operativo de ejecución:

runs-on: ubuntu-latest

Para mantener un entorno reproducible, se establecen versiones específicas de las herramientas principales.
```text
pnpm
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 10.33.0
Node.js
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 24
    cache: pnpm
```

La configuración coincide con las versiones definidas para el proyecto.

---

## 6. Etapas del pipeline CI

El pipeline actualmente cuenta con un único job denominado validate, compuesto por diferentes etapas de validación.

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

---

## 7. Checkout del repositorio

La primera etapa obtiene el código fuente del repositorio mediante la acción oficial de GitHub:

```text
- name: Checkout
  uses: actions/checkout@v4
```

Esto permite que GitHub Actions disponga del código necesario para ejecutar las siguientes etapas del pipeline.

---

## 8. Instalación de dependencias

Las dependencias del monorepo se instalan mediante:

```text
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

Se utiliza --frozen-lockfile para garantizar que las dependencias instaladas coincidan exactamente con el archivo pnpm-lock.yaml.

De esta manera, el pipeline evita modificar automáticamente el lockfile y permite detectar inconsistencias entre las dependencias declaradas y las registradas en el repositorio.

---

## 9. Generación del cliente de Prisma

Después de instalar las dependencias, se genera automáticamente el cliente de Prisma:

```text
- name: Generate Prisma Client
  run: pnpm --filter backend exec prisma generate
```

Esta etapa prepara el cliente generado que utiliza el backend para interactuar con la base de datos mediante Prisma.

La generación automática dentro del CI permite comprobar que el esquema y la configuración de Prisma pueden generar correctamente el cliente requerido por el backend.

---

## 10. Lint

El pipeline ejecuta las herramientas de análisis estático mediante:

```text
- name: Lint
  run: pnpm lint
```

El comando ejecuta el script lint definido en el proyecto:

- "lint": "pnpm --recursive lint"

Esto permite validar el código de los diferentes proyectos incluidos en el workspace, incluyendo:

- Backend mediante Oxlint.
- Frontend mediante ESLint.

Si se detectan errores de lint, el pipeline falla y el Pull Request no puede considerarse validado.

---

## 11. Tests

La siguiente etapa ejecuta las pruebas automatizadas:

```text
- name: Tests
  run: pnpm test
```

El comando utiliza el script definido en el proyecto:

- "test": "pnpm --recursive test"

Esta etapa permite comprobar que las pruebas automatizadas existentes se ejecutan correctamente antes de integrar los cambios.

A medida que se desarrollen nuevas funcionalidades, las pruebas correspondientes se incorporarán al proyecto y serán ejecutadas automáticamente por el pipeline.

---

## 12. Build

La última etapa del CI ejecuta la compilación de los proyectos:

```text
- name: Build
  run: pnpm build
```

El comando utiliza el script:

- "build": "pnpm --recursive build"

Esta etapa permite verificar que el frontend y backend puedan ser compilados correctamente con el código que se pretende integrar.

Un error durante la compilación provoca que el pipeline falle.

---

## 13. Resultado del CI

El pipeline utiliza un único job denominado:

- validate

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

## 14. Estrategia base de Continuous Delivery / Deployment (CD)

El componente de CD todavía no se encuentra implementado como un despliegue automático.

Sin embargo, se ha definido su arquitectura base para integrarlo posteriormente con el entorno Staging y Producción.

La estrategia prevista es:

```text
                 GitHub
                    |
                    v
              Pull Request
                    |
                    v
                   CI
                    |
             CI aprobado
                    |
                    v
                 develop
                    |
                    v
             CD hacia Staging
                    |
                    v
          +-------------------+
          |     Staging       |
          |                   |
          |    DigitalOcean   |
          |      Docker       |
          +-------------------+
                    |
             Validación del
             entorno Staging
                    |
                    v
                  main
                    |
                    v
           CD hacia Producción
                    |
                    v
          +-------------------+
          |    Producción     |
          |                   |
          |    DigitalOcean   |
          |      Docker       |
          +-------------------+
```

La implementación del CD se realizará una vez que el entorno Staging se encuentre preparado.

## 15. Relación entre CI y CD

La estrategia de despliegue del proyecto seguirá una separación entre validación e implementación:

- CI

Responsable de comprobar que el código cumple las condiciones necesarias para ser integrado.

```text
Código
  |
  v
Install
  |
  v
Prisma Generate
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

- CD

Responsable de llevar una versión previamente validada hacia un entorno de ejecución.

```text
CI aprobado
     |
     v
  develop
     |
     v
  Staging
     |
     v
Validación
     |
     v
  main
     |
     v
Producción
```

De esta manera, el despliegue se realizará sobre código que previamente pasó por las validaciones automatizadas del CI.

---

## 16. Entorno Staging

El entorno Staging constituye la siguiente etapa de implementación del proceso DevOps.

La arquitectura prevista utilizará:

- DigitalOcean como infraestructura cloud.
- Docker para la ejecución de los servicios.
- Backend NestJS dentro de un contenedor.
- Frontend Next.js dentro de un contenedor.
- PostgreSQL administrado mediante Supabase.
- Variables de entorno para la configuración de los servicios.

La rama develop será utilizada como referencia para el entorno Staging.

```text
develop
   |
   v
 CI aprobado
   |
   v
 CD
   |
   v
DigitalOcean
   |
   v
Docker
   |
   v
Staging
``` 

La preparación de este entorno corresponde a la siguiente etapa del proyecto.

---

## 17. Entorno de Producción

La rama main representa la versión estable del proyecto.

La arquitectura prevista establece que los cambios lleguen a Producción después de haber sido integrados y validados previamente en develop y Staging.

```text
feature/*
    |
    v
develop
    |
    v
CI
    |
    v
Staging
    |
    v
Validación
    |
    v
main
    |
    v
Producción
```

El despliegue automático hacia Producción será implementado posteriormente, una vez que el proceso de Staging se encuentre establecido y validado.

---

## 18. Variables de entorno y secretos

Las credenciales y configuraciones sensibles no forman parte del repositorio.

El backend utiliza variables de entorno para la configuración de servicios como la conexión con PostgreSQL/Supabase.

Se mantiene un archivo de ejemplo para documentar las variables requeridas:

```text
backend/
├── .env
└── .env.example
```

- El archivo .env contiene valores locales y permanece fuera del repositorio.

- El archivo .env.example contiene únicamente la estructura y los nombres de las variables necesarias.

Esta estrategia será extendida al entorno Staging y posteriormente a Producción utilizando los mecanismos de secretos y variables de entorno correspondientes.

---

## 19. Estado actual de implementación
| Componente | 	Estado |
| --- | --- | 
| Git Flow |	Implementado |
| GitHub Actions |	Implementado | 
| Instalación automática de dependencias |	Implementado |
| Prisma Generate |	Implementado |
| Lint |	Implementado |
| Tests |	Implementado |
| Build |	Implementado |
| CI para Pull Requests |	Implementado |
| CI para develop |	Implementado |
| CI para main |	Implementado |
| Arquitectura base de CD |	Definida |
| Despliegue automático a Staging |	Pendiente |
| Entorno Staging |	Próxima etapa |
| Despliegue automático a Producción |	Pendiente |

---

## 20. Evolución prevista

La implementación del pipeline se realizará de manera progresiva:

```text
1. Git Flow
      |
      v
2. CI implementado
      |
      v
3. Prisma Generate integrado
      |
      v
4. Entorno Staging
      |
      v
5. CD hacia Staging
      |
      v
6. Validación de Staging
      |
      v
7. CD hacia Producción
      |
      v
8. Automatización y optimización
```

Esta estrategia permite implementar cada componente de manera controlada y evitar realizar despliegues automáticos sobre infraestructura que todavía no se encuentra preparada.

---

## 21. Conclusión

El proyecto cuenta actualmente con una base funcional de Integración Continua mediante GitHub Actions. El pipeline automatiza la instalación de dependencias, la generación del cliente de Prisma, el análisis estático del código, la ejecución de pruebas y la compilación del proyecto.

La integración del CI con los Pull Requests permite detectar errores antes de incorporar cambios a las ramas develop y main, fortaleciendo el flujo de trabajo definido mediante Git Flow.

Para la parte de Continuous Delivery/Deployment se ha establecido una arquitectura base que conecta el código validado con los futuros entornos de Staging y Producción. La implementación del despliegue automático se realizará progresivamente, comenzando con la preparación del entorno Staging en DigitalOcean y Docker.

De esta manera, el pipeline actual constituye la base sobre la cual se construirá posteriormente el proceso completo de CI/CD del proyecto.

---