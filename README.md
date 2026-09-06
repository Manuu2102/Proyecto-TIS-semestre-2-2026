# Sistema de Gestión de Edificio

## 📌 Descripción General

Sistema destinado a la gestión de las operaciones administrativas y servicios de un edificio.

El sistema permitirá gestionar información relacionada con usuarios, residentes y diferentes procesos administrativos, proporcionando una plataforma centralizada, segura y de fácil utilización.

El proyecto se plantea bajo una arquitectura modular y desacoplada, con una separación clara entre frontend, backend e infraestructura.

---

## 🎯 Objetivo del Proyecto

Construir una plataforma para facilitar la gestión interna de un edificio, centralizando la administración de usuarios, información y servicios relacionados con los residentes y la administración.

Entre las funcionalidades previstas se encuentran:

- Gestión de usuarios.
- Autenticación y autorización.
- Gestión de información de residentes y copropietarios.
- Gestión de procesos administrativos.
- Consulta y administración de información del edificio.

---

## 🏗️ Arquitectura

El proyecto seguirá un enfoque **monorepo**, con una separación clara de responsabilidades:

- **Frontend:** Next.js, React y TypeScript.
- **Backend:** API REST utilizando Node.js y TypeScript.
- **Base de datos:** PostgreSQL.
- **Infraestructura:** Docker, GitHub Actions y DigitalOcean.

La infraestructura DevOps será implementada progresivamente durante el desarrollo del proyecto, incorporando integración continua, despliegue automatizado, ambientes de Staging y Producción, respaldos y medidas básicas de seguridad.

---

## 📂 Estructura del Proyecto

```text
.
├── backend/                # API y lógica de negocio
├── frontend/               # Aplicación frontend
├── docker/                 # Archivos relacionados con contenedores
├── docs/                   # Documentación técnica
└── .github/
    └── workflows/          # Pipelines CI/CD

La estructura podrá ampliarse conforme se incorporen nuevos componentes al sistema.

```
---

## 🛠️ Tecnologías
 **Desarrollo**
   Node.js
   TypeScript
   Next.js
   React
   PostgreSQL
 **DevOps e Infraestructura** 
   Git
   GitHub
   Docker
   GitHub Actions
   DigitalOcean
 **Pruebas** 
 Postman

---

## 🌎 Ambientes

El proyecto contempla tres ambientes principales:

- Desarrollo

Ambiente utilizado por los desarrolladores para implementar y probar funcionalidades localmente.

- Staging

Ambiente de pruebas destinado a validar las funcionalidades integradas antes de su publicación en Producción.

- Producción

Ambiente destinado a la versión estable y funcional del sistema.

- El flujo previsto será:

Desarrollo
    ↓
Feature Branch
    ↓
Pull Request
    ↓
Develop
    ↓
CI/CD
    ↓
Staging
    ↓
Validación
    ↓
Main
    ↓
Producción

---

## ⚙️ Requisitos

- Para trabajar con el proyecto se requerirá:

Node.js
pnpm
Git
Docker

Las versiones específicas de Node.js y pnpm serán definidas por el equipo al establecer la configuración definitiva del proyecto.

- Instalar pnpm
npm install -g pnpm

---

### 🚀 Ejecución Local

1. Clonar el repositorio
git clone <repo-url>

cd <repo>
2. Instalar dependencias
pnpm install
3. Configurar variables de entorno

- Crear el archivo:

backend/.env

- Ejemplo:

PORT=5000
JWT_SECRET=your_secret_key
DATABASE_URL=your_database_url

- Las variables reales no deberán ser almacenadas en el repositorio.

4. Ejecutar Backend
pnpm --filter backend dev

- El backend estará disponible en:

http://localhost:5000
5. Ejecutar Frontend

- En otra terminal:

pnpm --filter frontend dev

- El frontend estará disponible en:

http://localhost:3000
6. Ejecutar el proyecto completo
pnpm dev

- Los comandos anteriores estarán disponibles una vez que la estructura del monorepo y los respectivos proyectos hayan sido configurados.

---

### 🐳 Docker

Docker será utilizado para empaquetar y ejecutar los servicios de la aplicación de manera consistente entre los diferentes ambientes.

La configuración se implementará progresivamente durante el desarrollo del proyecto.

Para ejecutar los servicios mediante Docker:

docker compose up --build

Para detener los servicios:

docker compose down

---

### 🔄 CI/CD

Se implementará un pipeline mediante GitHub Actions para automatizar progresivamente el proceso de integración y despliegue.

El pipeline contemplará:

Validación del código.
Instalación de dependencias.
Ejecución de pruebas.
Construcción de la aplicación.
Construcción de imágenes Docker.
Despliegue al ambiente de Staging.
Validación del entorno.
Posterior despliegue a Producción.

La implementación del pipeline será desarrollada durante las etapas correspondientes de la planificación DevOps.

---

### 🌿 Estrategia de Ramas

Se utilizará una estrategia Git Flow simplificada.

Ramas principales
- main: contiene las versiones estables destinadas a Producción.
- develop: rama de integración de funcionalidades.
- feature/*: ramas utilizadas para desarrollar funcionalidades específicas.
Flujo de trabajo:

feature/*
     ↓
Pull Request
     ↓
develop
     ↓
Validación / pruebas
     ↓
main
     ↓
Producción

- Ejemplos de ramas:

feature/login
feature/usuarios
feature/copropietarios
feature/pagos
feature/reportes

- Reglas: 
No realizar modificaciones directamente sobre main.
Utilizar Pull Requests para integrar cambios.
Crear las ramas feature/* a partir de develop.
Mantener las ramas enfocadas en una funcionalidad específica.
Validar los cambios antes de integrarlos en main.
Las modificaciones destinadas a Producción deberán haber sido previamente validadas en Staging.

---

### 📝 Convención de Commits

Se utilizará una convención de commits descriptiva:

- feat: nueva funcionalidad
- fix: corrección de errores
- chore: tareas de configuración o mantenimiento
- docs: actualización de documentación
- refactor: modificación interna del código
- test: incorporación o modificación de pruebas
- ci: cambios relacionados con CI/CD

- Ejemplos:

feat: implementar autenticacion de usuarios

fix: corregir validacion de contrasena

docs: actualizar arquitectura cloud

ci: agregar workflow de validacion

chore: configurar docker

Se recomienda mantener los commits pequeños, relacionados con un único cambio y con mensajes descriptivos.

---

### 📦 Buenas Prácticas

Mantener commits pequeños y relacionados con un único cambio.
Utilizar mensajes de commit descriptivos.
No mezclar funcionalidades diferentes en un mismo commit.
Utilizar Pull Requests para integrar cambios.
Mantener separadas las responsabilidades del frontend y backend.
Mantener la documentación técnica actualizada.
Validar los cambios en Staging antes de llevarlos a Producción.
No modificar directamente las configuraciones críticas de Producción.
Realizar los cambios importantes de infraestructura mediante Pull Requests.

---

### 🔐 Seguridad

No subir archivos .env al repositorio.
No almacenar contraseñas, tokens o claves directamente en el código.
Utilizar variables de entorno para configuraciones sensibles.
Utilizar Secrets de GitHub para credenciales utilizadas por CI/CD.
No almacenar credenciales de Producción dentro del repositorio.
Revisar los scripts antes de ejecutarlos.
Mantener separadas las credenciales de Desarrollo, Staging y Producción.

---

### ☁️ Infraestructura Cloud

La infraestructura Cloud propuesta contempla:

                    INTERNET
                        │
                        ▼
                   ┌─────────┐
                   │ GitHub  │
                   └────┬────┘
                        │
                     CI/CD
                        │
                        ▼
                ┌──────────────┐
                │    Docker    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ DigitalOcean │
                └──────┬───────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
          STAGING          PRODUCCIÓN
              │                 │
              └────────┬────────┘
                       ▼
                 PostgreSQL
                       │
                       ▼
                    Backups

La implementación de esta infraestructura será realizada progresivamente durante el semestre.

---

### 📚 Documentación Técnica

La documentación específica de DevOps estará organizada en:

docs/arquitectura-cloud.md → Arquitectura de infraestructura Cloud.
docs/git-flow.md → Estrategia de ramas y flujo de trabajo.
.github/workflows/ → Configuración de los pipelines CI/CD.

---

### 🚧 Estado del Proyecto

Estado: En desarrollo.

Estado de infraestructura DevOps
 Repositorio GitHub
 Estructura inicial del repositorio
 Estrategia Git Flow
 Diseño de arquitectura Cloud
 Pipeline CI/CD
 Ambiente Staging
 Despliegue Cloud
 Backups de la base de datos
 Backups automatizados
 SSL/HTTPS
 Despliegue a Producción

Los elementos pendientes serán implementados de acuerdo con la planificación semestral del rol DevOps.

---

### 👥 Contribución

Para contribuir al proyecto:

Actualizar la rama develop.
git checkout develop
git pull origin develop
Crear una rama para la funcionalidad:
git checkout -b feature/nombre-funcionalidad
Implementar los cambios.
Realizar un commit descriptivo:
git add .
git commit -m "feat: descripcion del cambio"
Subir la rama:
git push -u origin feature/nombre-funcionalidad
Crear un Pull Request hacia develop.
Esperar la revisión y validación correspondiente antes de realizar el merge.

---

### 📄 Licencia

Pendiente de definición.
