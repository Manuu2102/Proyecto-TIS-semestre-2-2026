# Sistema de Gestión de Edificio

## 📌 Descripción General

Sistema destinado a la gestión de las operaciones administrativas y servicios de un edificio.

El sistema permite gestionar información relacionada con usuarios, residentes, copropietarios y diferentes procesos administrativos, proporcionando una plataforma centralizada, segura y de fácil utilización.

El proyecto utiliza una arquitectura modular y desacoplada, separando las responsabilidades entre frontend, backend, base de datos e infraestructura.

---

## 🎯 Objetivo del Proyecto

Construir una plataforma para facilitar la gestión interna de un edificio, centralizando la administración de usuarios, información y servicios relacionados con los residentes y la administración.

Entre las funcionalidades del sistema se encuentran:

- Gestión de usuarios.
- Autenticación y autorización.
- Gestión de residentes y copropietarios.
- Gestión de información del edificio.
- Procesos administrativos.
- Consulta de información.
- Diferentes niveles de acceso según el rol del usuario.

---

## 🏗️ Arquitectura

El proyecto utiliza una estructura **monorepo** con separación de responsabilidades:

- **Frontend:** Next.js, React y TypeScript.
- **Backend:** NestJS, Node.js y TypeScript.
- **Base de datos:** PostgreSQL mediante Supabase.
- **ORM:** Prisma.
- **Contenedores:** Docker y Docker Compose.
- **Control de versiones:** Git y GitHub.
- **CI/CD:** GitHub Actions.
- **Cloud:** Microsoft Azure.
- **Staging:** Máquina virtual Ubuntu en Azure.

### Arquitectura general

```text
                         ┌─────────────────┐
                         │     GitHub      │
                         │ Repository + CI │
                         └────────┬────────┘
                                  │
                           Merge a develop
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ GitHub Actions  │
                         │       CD        │
                         └────────┬────────┘
                                  │ SSH
                                  ▼
                    ┌─────────────────────────┐
                    │       Azure VM          │
                    │   Ubuntu Server 24.04   │
                    └───────────┬─────────────┘
                                │
                       Docker Compose
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
        ┌─────────────────┐         ┌─────────────────┐
        │    Frontend     │         │     Backend     │
        │    Next.js      │         │     NestJS      │
        │     :3000       │         │      :3001      │
        └─────────────────┘         └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │     Supabase    │
                                    │   PostgreSQL    │
                                    └─────────────────┘
```

## 📂 Estructura del Proyecto

```text
.
├── backend/                 # API y lógica de negocio
│   ├── prisma/              # Schema y configuración de Prisma
│   └── src/                 # Código fuente del backend
│
├── frontend/                # Aplicación web Next.js
│   └── src/                 # Código fuente del frontend
│
├── docker/
│   ├── backend/
│   │   └── Dockerfile       # Imagen del backend
│   └── frontend/
│       └── Dockerfile       # Imagen del frontend
│
├── docs/                    # Documentación técnica
│
├── .github/
│   └── workflows/
│       ├── ci.yml           # Integración continua
│       └── cd.yml           # Despliegue continuo
│
├── docker-compose.yml       # Orquestación de servicios
├── package.json             # Configuración del monorepo
├── pnpm-workspace.yaml      # Workspaces de pnpm
├── pnpm-lock.yaml           # Dependencias bloqueadas
└── README.md
```

---

## 🛠️ Tecnologías

- Desarrollo
- Node.js 24
- pnpm 10
- TypeScript
- React
- Next.js 16
- NestJS 12
- Base de datos
- PostgreSQL
- Supabase
- Prisma 7
- DevOps e infraestructura
- Git
- GitHub
- GitHub Actions
- Docker
- Docker Compose
- Microsoft Azure
- Ubuntu Server

---

## 🌎 Ambientes

El proyecto contempla los siguientes ambientes:

- Desarrollo

Ambiente utilizado por los desarrolladores para implementar y probar funcionalidades localmente.

- Staging

Ambiente utilizado para validar los cambios integrados antes de llevarlos a producción.

Actualmente el ambiente de Staging está desplegado en una máquina virtual de Microsoft Azure utilizando Docker Compose.

- Producción

Ambiente destinado a la versión estable del sistema.

La infraestructura de producción se implementará posteriormente.

- Flujo general:

```text
Feature Branch
      ↓
Pull Request
      ↓
CI
      ↓
Merge → develop
      ↓
CD automático
      ↓
Azure Staging
      ↓
Validación
      ↓
main
      ↓
Producción
```

----

##  ⚙️ Requisitos

Para trabajar con el proyecto se requiere:

- Node.js 24
- pnpm 10
- Git
- Docker Desktop
- Docker Compose
- Instalar pnpm
- npm install -g pnpm@10.33.0

---

## 🚀 Ejecución Local

1. Clonar el repositorio
git clone https://github.com/Manuu2102/Proyecto-TIS-semestre-2-2026.git
cd Proyecto-TIS-semestre-2-2026

2. Instalar dependencias
pnpm install

3. Configurar variables de entorno

Las variables de entorno no deben almacenarse en el repositorio.

- El backend requiere un archivo:

backend/.env

- Las variables utilizadas incluyen la configuración de conexión a PostgreSQL/Supabase y las credenciales necesarias para los servicios del backend.

Para el frontend se utiliza la configuración de:

NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

Los valores reales deben mantenerse fuera del repositorio.

4. Generar el cliente Prisma
pnpm --filter backend exec prisma generate

5. Ejecutar el proyecto completo
pnpm dev

Este comando inicia los servicios del frontend y backend mediante el workspace de pnpm.

### Ejecución individual

- Backend:

pnpm --filter backend dev

- Frontend:

pnpm --filter frontend dev
Puertos locales
Servicio	Puerto
Frontend	3000
Backend	3001

- Frontend:

http://localhost:3000

- Backend:

http://localhost:3001

---

## 🐳 Docker

Docker se utiliza para ejecutar el frontend y backend de manera consistente entre los diferentes ambientes.

Los servicios se encuentran definidos en:

  docker-compose.yml
- Construir y ejecutar
  docker compose up -d --build
- Ver estado de los contenedores
  docker compose ps
- Ver logs

- Backend:

docker compose logs backend

- Frontend:

docker compose logs frontend

- Todos los servicios:

docker compose logs
Detener los servicios
docker compose down
Contenedores de Staging

- En Azure se utilizan:

tis-backend-staging
tis-frontend-staging

---

## 🗄️ Base de Datos

La aplicación utiliza PostgreSQL mediante Supabase.

Prisma se utiliza como ORM para interactuar con la base de datos.

- La configuración principal se encuentra en:

backend/prisma/schema.prisma
backend/prisma7.config.ts

Las credenciales y URLs de conexión se mantienen mediante variables de entorno.

No se deben almacenar credenciales de Supabase o PostgreSQL directamente en el repositorio.

---

## 🔄 CI/CD

El proyecto utiliza GitHub Actions para automatizar la integración continua y el despliegue continuo.

- Los workflows se encuentran en:

.github/workflows/

### CI — Continuous Integration

El workflow de CI se ejecuta en Pull Requests y cambios realizados sobre las ramas principales configuradas.

Entre las validaciones realizadas se encuentran:

- Instalación de dependencias.
- Generación del cliente Prisma.
- Lint.
- Pruebas automatizadas.
- Build del proyecto.

El objetivo es evitar que cambios que no cumplen las validaciones sean integrados a develop.

### CD — Continuous Deployment

El despliegue de Staging se ejecuta automáticamente cuando un cambio es integrado en develop.

El flujo es:

```text
Merge a develop
      ↓
GitHub Actions
      ↓
Conexión SSH
      ↓
Azure VM
      ↓
git fetch origin develop
      ↓
git reset --hard origin/develop
      ↓
docker compose up -d --build
      ↓
Staging actualizado
```

La conexión SSH utiliza GitHub Secrets para mantener las credenciales fuera del código fuente.

### Evidencia de implementación

- El despliegue automático fue validado mediante:

Pull Request #45.
CI #95 — ejecución exitosa.
CD #20 — ejecución exitosa.
Commit desplegado: 5977aec.

---

## ☁️ Infraestructura Cloud — Azure

El ambiente de Staging está desplegado en Microsoft Azure.

- Máquina virtual
- Nombre: tis-staging-vm
- Sistema operativo: Ubuntu Server 24.04 LTS
- Región: North Central US
- Recursos: 2 vCPU / 8 GiB RAM
- Usuario: tisadmin
- Servicios desplegados
- Servicio	Puerto
- Frontend Next.js	3000
- Backend NestJS	3001

### Acceso al ambiente Staging

- Frontend:

http://20.80.34.77:3000

- Página de inicio de sesión:

http://20.80.34.77:3000/login

- Backend:

http://20.80.34.77:3001

La dirección IP corresponde al ambiente de Staging y puede cambiar si la infraestructura es modificada.

---

## 🔐 Seguridad y Variables de Entorno

Las variables sensibles no se almacenan en el repositorio.

El proyecto utiliza:

- Archivos .env para configuración local y del servidor.
- .gitignore para evitar subir archivos de variables de entorno.
- GitHub Secrets para credenciales utilizadas por CI/CD.
- Claves SSH para la conexión entre GitHub Actions y Azure.

Entre los secretos utilizados por el pipeline se encuentran:

- AZURE_HOST
- AZURE_USERNAME
- AZURE_SSH_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Los valores reales de estos secretos no deben almacenarse en el repositorio.

---

## 🌿 Estrategia de Ramas

Se utiliza una estrategia Git Flow simplificada.

### Ramas principales
- main: versiones estables destinadas a Producción.
- develop: integración de funcionalidades.
- feature/*: desarrollo de funcionalidades específicas.

### Flujo de trabajo

```text
feature/*
    ↓
Pull Request
    ↓
CI
    ↓
develop
    ↓
CD
    ↓
Staging
    ↓
Validación
    ↓
main
    ↓
Producción
```

No se deben realizar modificaciones directamente sobre main.

Las nuevas funcionalidades deben desarrollarse en ramas feature/* y posteriormente integrarse mediante Pull Request.

---

## 📝 Convención de Commits

Se utiliza una convención de commits descriptiva:

| Tipo |	Uso |
| --- | --- |
| feat: |	Nueva funcionalidad |
| fix: |	Corrección de errores |
| chore: |	Configuración o mantenimiento |
| docs: |	Documentación |
| refactor: |	Modificación interna |
| test: |	Pruebas |
| ci: |	CI/CD e infraestructura de automatización |

### Ejemplos
- feat: implementar autenticacion de usuarios
- fix: corregir validacion de contrasena
- docs: actualizar arquitectura cloud
- ci: automatizar despliegue de staging
- chore: configurar docker

Se recomienda mantener los commits pequeños y relacionados con un único cambio.

---

## 📚 Documentación Técnica

La documentación específica de DevOps se encuentra en:

```text
docs/
├── arquitectura-cloud.md
└── git-flow.md
```

Los workflows de automatización se encuentran en:

```text
.github/workflows/
├── ci.yml
└── cd.yml
```

---

## 📦 Buenas Prácticas

- Mantener commits pequeños y descriptivos.
- No mezclar funcionalidades diferentes en un mismo commit.
- Utilizar Pull Requests.
- Mantener separadas las responsabilidades del frontend y backend.
- Mantener actualizada la documentación.
- Validar los cambios en Staging antes de llevarlos a Producción.
- No modificar directamente las configuraciones críticas de Producción.
- Realizar los cambios importantes de infraestructura mediante Pull Requests.
- No almacenar credenciales en el repositorio.

---

## 🚧 Estado Actual del Proyecto

### Desarrollo de la aplicación
 - Estructura del monorepo.
 - Frontend Next.js.
 - Backend NestJS.
 - Integración con PostgreSQL/Supabase.
 - Prisma.
 - Autenticación.
 - Gestión de usuarios y roles.
 - Dockerización de frontend y backend.
### DevOps e infraestructura
 - Repositorio GitHub.
 - Estrategia Git Flow.
 - Ramas main, develop y feature/*.
 - Documentación de arquitectura Cloud.
 - Documentación de Git Flow.
 - Docker Compose.
 - Pipeline CI con GitHub Actions.
 - Máquina virtual de Staging en Azure.
 - Despliegue de frontend en Azure.
 - Despliegue de backend en Azure.
 - Variables de entorno para Staging.
 - Acceso externo al ambiente Staging.
 - Pipeline CD con GitHub Actions.
 - Despliegue automático mediante SSH.
 - Actualización automática de Staging después de un merge a develop.
### Pendiente
 - Backups automatizados de la base de datos.
 - Configuración de HTTPS/SSL.
 - Ambiente de Producción.
 - Despliegue automático a Producción.
 - Configuración definitiva de dominio.

---

## 🤝 Contribución

Para contribuir al proyecto:

1. Actualizar develop
git switch develop
git pull origin develop
2. Crear una rama
git switch -c feature/nombre-funcionalidad
3. Implementar los cambios

Realizar las modificaciones necesarias y verificar localmente el funcionamiento.

4. Crear un commit
git add .
git commit -m "feat: descripcion del cambio"
5. Subir la rama
git push -u origin feature/nombre-funcionalidad
6. Crear Pull Request

Crear un Pull Request desde:

feature/nombre-funcionalidad

hacia:

develop

El cambio debe pasar las validaciones correspondientes antes de realizar el merge.

Una vez integrado en develop, el pipeline de CD actualiza automáticamente el ambiente de Staging.

---

## 📄 Licencia

Pendiente de definición.