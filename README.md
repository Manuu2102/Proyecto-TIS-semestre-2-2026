# Sistema de Gestión de Edificio

## 📌 Descripción General

Sistema destinado a la gestión de las operaciones administrativas y servicios de un edificio.

Permite a los usuarios:

* Explorar listados disponibles
* Gestionar información de usuarios
* Autenticarse y operar de forma segura

El sistema está diseñado bajo una arquitectura moderna, escalable y desacoplada.

---
## Proyecto

Proyecto académico de Ingeniería de Sistemas.

---

## 🧱 Arquitectura

El proyecto sigue un enfoque **monorepo** con una clara separación por capas:

* **Frontend** → Next.js (App Router + TypeScript)
* **Backend** → API REST (Node.js + TypeScript)
* **Infraestructura** → Docker + CI/CD (GitHub Actions)

---

## 📂 Estructura del Proyecto

```bash
.
├── backend/      # API (lógica de negocio, autenticación)
├── frontend/     # Aplicación frontend
├── docker/        # archivos relacionados con contenedores
├── docs/      # documentación técnica
└── .github/workflows      # pipelines CI/CD

```

---

## Tecnologías

- Git
- GitHub
- Docker
- GitHub Actions
- DigitalOcean
- PostgreSQL
- Node.js
- Next.js
- React
- Postman  

---

## ⚙️ Requisitos

* Node.js >= 18
* pnpm
* Git
* Docker (opcional)

Instalar pnpm:

```bash
npm install -g pnpm
```

---

## 🚀 Ejecución Local

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd <repo>
```

---

### 2. Instalar dependencias

```bash
pnpm install
```

---

### 3. Configurar variables de entorno

Crear archivo:

```bash
backend/.env
```

Ejemplo:

```env
PORT=5000
JWT_SECRET=your_secret_key
DATABASE_URL=your_database_url
```

---

### 4. Ejecutar Backend

```bash
pnpm --filter backend dev
```

Disponible en:

```bash
http://localhost:5000
```

---

### 5. Ejecutar Frontend

En otra terminal:

```bash
pnpm --filter frontend dev
```

Disponible en:

```bash
http://localhost:3000
```

---

### 6. Ejecutar todo (monorepo)

```bash
pnpm dev
```

---

## 🐳 Docker

Levantar contenedor de desarrollo:

```bash
docker-compose up --build
```

---

## 🔄 Scripts principales

| Acción           | Comando                      |
| ---------------- | ---------------------------- |
| Instalar deps    | `pnpm install`               |
| Dev (todo)       | `pnpm dev`                   |
| Backend dev      | `pnpm --filter backend dev`  |
| Frontend dev     | `pnpm --filter frontend dev` |
| Build            | `pnpm build`                 |
| Start producción | `pnpm start`                 |

---

## 🌿 Flujo de Trabajo

* `main` → producción
* `develop` → integración

### Convención de commits

```bash
feat: nueva funcionalidad
fix: corrección de errores
chore: tareas internas
```

---

## 📦 Buenas Prácticas

* No subir archivos `.env`
* No modificar configuraciones críticas sin aprobación
* Mantener commits pequeños (máx. ~250 líneas)
* Seguir arquitectura por capas en backend
* Separar lógica y UI en frontend

---

## 🔐 Seguridad

* No hardcodear credenciales
* Uso obligatorio de variables de entorno
* Revisar scripts antes de ejecutarlos (`/scripts`)

---

## 🚧 Estado del Proyecto

En desarrollo activo.

---

## 🎯 Objetivo del Proyecto

Construir una plataforma robusta y escalable que facilite la gestion interna de un edificio, permitiendo:

* Gestión eficiente de usuarios
* Experiencia moderna y rápida

---

## Estrategia de ramas

Se utilizará una estrategia Git Flow simplificada:

- `main`: versión estable/producción
- `develop`: integración de funcionalidades
- `feature/*`: desarrollo de nuevas funcionalidades

---

## 👥 Contribución

1. Crear una rama desde `develop`
   `feature/*`
2. Implementar cambios siguiendo estándares
3. Abrir un Pull Request

---

## 📄 Licencia

Pendiente de definición.
