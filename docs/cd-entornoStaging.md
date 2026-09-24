# Documentación DevOps — CI/CD y Entorno de Staging

## 1. Objetivo

Como parte del desarrollo del Sistema de Gestión de Edificio, se implementó la infraestructura y automatización correspondiente al rol DevOps.

Los principales objetivos fueron:

- Definir una estrategia de ramas para el desarrollo colaborativo.
- Preparar un entorno reproducible mediante Docker.
- Implementar integración continua (CI).
- Implementar despliegue continuo (CD).
- Preparar un entorno de staging.
- Preparar la aplicación para un futuro despliegue en un servidor cloud.

La arquitectura considera un frontend desarrollado con Next.js, un backend desarrollado con NestJS y una base de datos PostgreSQL administrada mediante Supabase.

---

## 2. Arquitectura general

La aplicación está organizada como un monorepo con dos aplicaciones principales:

```text
Proyecto-TIS-semestre-2-2026/
│
├── frontend/              # Aplicación Next.js
├── backend/               # API NestJS
│
├── docker/
│   ├── frontend/
│   │   └── Dockerfile
│   └── backend/
│       └── Dockerfile
│
├── docker-compose.yml
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
└── docs/
```

El flujo general de la aplicación es:

```text
                 GitHub
                    │
                    ▼
              GitHub Actions
                    │
             ┌──────┴──────┐
             │             │
             ▼             ▼
            CI             CD
             │             │
      Build / Tests        │
             │             ▼
             │       Docker / Staging
             │             │
             └─────────────┤
                           ▼
                       Aplicación
                      ┌─────────┐
                      │Frontend │
                      │ Next.js │
                      └────┬────┘
                           │
                           ▼
                      ┌─────────┐
                      │Backend  │
                      │ NestJS  │
                      └────┬────┘
                           │
                           ▼
                     ┌──────────┐
                     │ Supabase │
                     │PostgreSQL│
                     └──────────┘
```

---

## 3. Estrategia de ramas Git

Se utiliza una estrategia basada en ramas para separar el desarrollo de las versiones estables.

Las ramas principales utilizadas son:

- main: rama destinada a versiones estables.
- develop: rama de integración de los cambios del equipo.
- feature/*: ramas utilizadas para desarrollar funcionalidades específicas.

Durante el desarrollo DevOps se utilizó principalmente:

```text
feature/devops-cd
        │
        ▼
     develop
        │
        ▼
      main
```

Los cambios se integran mediante Pull Requests y se validan mediante GitHub Actions antes de ser incorporados a las ramas correspondientes.

---

## 4. Contenerización con Docker

Se implementaron contenedores independientes para el frontend y backend.

### Backend

El backend utiliza un Dockerfile basado en Node.js 24 y pnpm.

- Durante la construcción se genera explícitamente el cliente de Prisma:

pnpm --filter backend exec prisma generate

- Posteriormente se realiza la compilación:

pnpm --filter backend build

Esta generación explícita de Prisma fue necesaria para garantizar que el cliente generado estuviera disponible dentro de la imagen antes de compilar el backend.

- El backend se ejecuta en:

http://localhost:3001

### Frontend

El frontend utiliza Next.js y se construye mediante Docker utilizando una imagen optimizada para producción.

- El frontend se ejecuta en:

http://localhost:3000

- La URL de la API se configura mediante:

NEXT_PUBLIC_API_URL

Esto permite cambiar la dirección del backend dependiendo del entorno.

---

## 5. Docker Compose

Se configuró docker-compose.yml para ejecutar conjuntamente frontend y backend.

Los servicios principales son:

```text
services:
  backend:
    ...

  frontend:
    ...
```

El backend utiliza el puerto:

3001

y el frontend:

3000

Además, el frontend depende del servicio backend mediante:

```text
depends_on:
  - backend
```

Esto permite levantar el entorno de staging local de manera reproducible.

---

## 6. Entorno de Staging

Actualmente se dispone de un entorno de staging local funcional mediante Docker.

La ejecución se realiza mediante:

- docker compose up -d

Los contenedores utilizados son:

- tis-backend-staging
- tis-frontend-staging

El entorno permite comprobar la integración entre:

- Frontend → Backend → Base de datos

Se verificó que el backend pueda iniciar correctamente dentro del contenedor y responder mediante:

- http://localhost:3001

El frontend puede accederse mediante:

- http://localhost:3000

Por lo tanto, la aplicación puede ser probada de forma integrada antes de realizar un despliegue en un servidor externo.

---

## 7. Problema encontrado con Prisma durante Docker

Durante las primeras pruebas del contenedor del backend se presentó un error relacionado con el cliente generado de Prisma:

```text
Error [ERR_MODULE_NOT_FOUND]:
Cannot find module
'/app/backend/dist/generated/prisma/internal/class.ts'
```

El problema estaba relacionado con la generación y copia del cliente de Prisma durante las diferentes etapas del Dockerfile.

Para solucionarlo se modificó el proceso de construcción para generar Prisma explícitamente dentro de la etapa builder:

- RUN pnpm --filter backend exec prisma generate

- RUN pnpm --filter backend build

Después de realizar este cambio:

- El backend pudo compilarse correctamente.
- El contenedor pudo iniciar.
- NestJS inició correctamente.
- Los módulos de autenticación, Prisma y demás módulos fueron cargados.
- El endpoint principal respondió correctamente.

Esta corrección también fue incorporada al repositorio y posteriormente validada mediante el pipeline de CI/CD.

---

## 8. Integración Continua (CI)

Se configuró GitHub Actions para automatizar la validación del proyecto.

El proceso de CI contempla las principales tareas necesarias para verificar que los cambios del equipo no rompan el proyecto.

El flujo general es:

```text
Checkout del repositorio
        ↓
Configuración de Node.js
        ↓
Configuración de pnpm
        ↓
Instalación de dependencias
        ↓
Generación de Prisma
        ↓
Lint
        ↓
Tests
        ↓
Build
```

La instalación utiliza:

- pnpm install --frozen-lockfile

Esto permite mantener consistencia entre las dependencias utilizadas localmente y las utilizadas por CI.

---

## 9. Despliegue Continuo (CD)

Además de la integración continua, se implementó un flujo de CD para automatizar la construcción y preparación del entorno de staging.

El flujo general es:

```text
Push / Merge
     ↓
GitHub Actions
     ↓ 
    CI
     ↓
Build Docker
     ↓
    CD
     ↓
Staging
```

Durante las pruebas iniciales el pipeline presentó un error relacionado con la generación del cliente Prisma dentro del Dockerfile del backend.

Después de corregir el Dockerfile y realizar el commit correspondiente, se ejecutó nuevamente el pipeline.

El check de CD finalizó correctamente, confirmando que la modificación implementada solucionó el problema de construcción que impedía completar el flujo.

---

## 10. Situación actual del servidor de staging

El entorno de staging se encuentra actualmente funcionando de manera local mediante Docker.

No se dispone todavía de un servidor cloud permanente para alojar públicamente el entorno de staging.

Esto no impide validar la solución DevOps, ya que el entorno local permite comprobar:

- Construcción de las imágenes Docker.
- Inicio de los contenedores.
- Comunicación entre frontend y backend.
- Ejecución del backend NestJS.
- Generación de Prisma.
- Comunicación con Supabase.
- Ejecución del pipeline CI/CD.
- Preparación de la aplicación para un futuro servidor.

El pendiente actual corresponde específicamente a disponer de infraestructura cloud para alojar este mismo entorno fuera del equipo local.

---

## 11. Opciones de infraestructura cloud evaluadas

### DigitalOcean

Inicialmente se consideró utilizar DigitalOcean como servidor para el entorno de staging.

Sin embargo, el costo estimado de la infraestructura necesaria representa aproximadamente:

- USD 12 / mes

Debido a que se trata de un proyecto universitario y este gasto recurrente no resulta viable para el equipo, se decidió no contratar el servidor en esta etapa.

### Oracle Cloud

También se evaluó Oracle Cloud como alternativa para disponer de infraestructura cloud.

Durante el proceso de registro/configuración, la tarjeta utilizada fue declinada, por lo que no fue posible completar esta alternativa.

### GitHub Student Developer Pack

Como siguiente alternativa, se realizó la postulación al GitHub Student Developer Pack.

La solicitud fue aceptada, pero los beneficios requieren un período de habilitación de aproximadamente tres días.

Una vez habilitados los beneficios, se podrá evaluar el uso de servicios incluidos en el programa, entre ellos alternativas de infraestructura cloud como Azure.

#### Azure Cloud

Azure Cloud se considera una de las alternativas principales a evaluar una vez que se habiliten los beneficios del GitHub Student Developer Pack.

El objetivo sería utilizar los beneficios educativos para disponer de infraestructura cloud sin generar un costo mensual para el equipo.

### Vercel + Backend externo

Como última alternativa se considera desplegar el frontend mediante Vercel y utilizar otro servicio compatible para alojar el backend.

La arquitectura sería:

```text
Vercel
  │
  └── Frontend Next.js
          │
          ▼
     Servicio backend
          │
          ▼
       Supabase
```

Esta alternativa se mantiene como contingencia en caso de que no sea posible disponer de un servidor cloud mediante los beneficios educativos.

---

## 12. Estado actual del proyecto DevOps

| Componente |	Estado |
| --- | --- |
| Estrategia Git |	Implementada |
| Ramas de desarrollo |	Implementadas |
| Docker Backend |	Implementado y probado |
| Docker Frontend |	Implementado y probado |
| Docker Compose |	Implementado |
| Staging local |	Funcionando |
| Prisma en Docker |	Corregido |
| CI |	Implementado |
| CD |	Implementado |
| Build Docker en pipeline |	Funcionando |
| Check de CD |	Exitoso |
| Servidor cloud permanente |	Pendiente |
| DigitalOcean |	No utilizado por costo |
| Oracle Cloud |	No disponible por rechazo de tarjeta |
| GitHub Student Pack |	Aceptado, beneficios pendientes de habilitación |
| Azure | Alternativa a evaluar con beneficios educativos |
| Vercel + backend externo |	Alternativa de contingencia |

---

## 13. Conclusión

El trabajo DevOps permitió establecer una base automatizada y reproducible para el proyecto.

Actualmente se cuenta con:

```text
Código
  ↓
Git / GitHub
  ↓
GitHub Actions
  ↓
CI
  ↓
Docker Build
  ↓
CD
  ↓
Staging local
  ↓
Frontend + Backend + Supabase
```

El entorno de staging local se encuentra funcional y el pipeline de CI/CD fue validado exitosamente.

La principal tarea pendiente no corresponde a la implementación del proceso DevOps, sino a disponer de una infraestructura cloud permanente para publicar el entorno de staging.

La infraestructura cloud se mantiene como una etapa posterior, condicionada a la disponibilidad de recursos educativos o de una alternativa que no implique un costo mensual para el equipo.
