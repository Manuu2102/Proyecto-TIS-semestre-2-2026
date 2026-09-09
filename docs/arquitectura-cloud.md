# Arquitectura Cloud

## 1. Objetivo

Definir la arquitectura de infraestructura y despliegue del sistema, estableciendo la distribución de sus componentes entre el entorno de desarrollo, los ambientes de Staging y Producción, y los servicios cloud utilizados.

La arquitectura busca proporcionar un entorno estable, reproducible, seguro y escalable, separando la aplicación en sus principales componentes: frontend, backend y base de datos.

La infraestructura será gestionada mediante Docker y desplegada en DigitalOcean, mientras que la base de datos PostgreSQL será administrada mediante Supabase.

---

## 2. Alcance

La arquitectura contempla los siguientes componentes:

- Aplicación frontend.
- API backend.
- Base de datos PostgreSQL.
- Contenedores Docker.
- Infraestructura cloud de DigitalOcean.
- Servicio de base de datos administrada de Supabase.
- Repositorio GitHub.
- Automatización mediante GitHub Actions.
- Ambientes de Staging y Producción.
- Gestión de variables de entorno y secretos.
- Estrategia de backups y recuperación de la base de datos.

---

## 3. Tecnologías

| Componente | Tecnología | Función |
|---|---|---|
| Frontend |	Next.js + React + TypeScript |	Interfaz de usuario |
| Estilos |	Tailwind CSS |	Diseño de la interfaz |
| Backend |	NestJS + TypeScript |	API y lógica de negocio |
| ORM	| Prisma 7 |	Acceso a la base de datos |
| Runtime |	Node.js 24 |	Ejecución de la aplicación |
| Gestor de paquetes |	pnpm 10 |	Gestión de dependencias |
| Base de datos |	PostgreSQL |	Persistencia de información |
| Administración de BD |	Supabase |	Gestión de PostgreSQL |
| Contenedores |	Docker |	Empaquetado y ejecución |
| Cloud |	DigitalOcean |	Infraestructura de despliegue |
| Repositorio |	GitHub |	Control de versiones |
| CI/CD |	GitHub Actions |	Automatización de integración y despliegue |

--- 

## 4. Arquitectura general

La solución utilizará una arquitectura de tres capas principales:

- Capa de presentación: aplicación frontend desarrollada con React.
- Capa de aplicación: API desarrollada con NestJS.
- Capa de datos: PostgreSQL administrado mediante Supabase.

Docker permitirá empaquetar los componentes de aplicación para garantizar que puedan ejecutarse de manera consistente entre los diferentes ambientes.


Diagrama general:
```text
                         ┌───────────────────┐
                         │      USUARIO      │
                         │   Navegador Web   │
                         └─────────┬─────────┘
                                   │
                                  HTTPS
                                   │
                                   ▼
                 ┌─────────────────────────────────┐
                 │          DIGITALOCEAN           │
                 │                                 │
                 │          FRONTEND               │
                 │  Next.js + React + TypeScript   │
                 │          + Tailwind             │
                 │                                 │
                 │             Docker              │
                 └────────────────┬────────────────┘
                                  │
                              HTTPS / REST
                                  │
                                  ▼
                 ┌─────────────────────────────────┐
                 │          DIGITALOCEAN           │
                 │                                 │
                 │           BACKEND               │
                 │      NestJS + TypeScript        │
                 │                                 │
                 │           Prisma 7              │
                 │                                 │
                 │             Docker              │
                 └────────────────┬────────────────┘
                                  │
                            PostgreSQL
                                  │
                                  ▼
                 ┌─────────────────────────────────┐
                 │            SUPABASE             │
                 │                                 │
                 │           PostgreSQL            │
                 │                                 │
                 │       Base de datos             │
                 └─────────────────────────────────┘


                 ┌─────────────────────────────────┐
                 │             GITHUB              │
                 │                                 │
                 │       Código fuente             │
                 │          Git Flow               │
                 │                                 │
                 │       GitHub Actions            │
                 └─────────────────────────────────┘
```
---

## 5. Frontend

El frontend será desarrollado utilizando Next.js, React y TypeScript, utilizando Tailwind CSS para la construcción de la interfaz.

Su función es proporcionar la interfaz de usuario y comunicarse con el backend mediante solicitudes HTTP/HTTPS.

El frontend no tendrá acceso directo a la base de datos. Todas las operaciones que requieran información persistente serán realizadas mediante la API del backend.

### Responsabilidades:
- Presentar la interfaz del sistema.
- Gestionar la interacción con los usuarios.
- Consumir la API del backend.
- Realizar validaciones propias de la interfaz.
- Gestionar el estado de la aplicación.

---

## 6. Backend

El backend será desarrollado utilizando NestJS y TypeScript.

Representará la capa encargada de la lógica de negocio y proporcionará una API para la comunicación con el frontend.

El acceso a PostgreSQL se realizará mediante Prisma 7.

### Responsabilidades:
- Exponer la API.
- Implementar la lógica de negocio.
- Validar solicitudes.
- Gestionar autenticación y autorización cuando corresponda.
- Gestionar errores.
- Acceder a PostgreSQL mediante Prisma.
- Aplicar las reglas de negocio del sistema.

---

## 7. Base de datos

La aplicación utilizará PostgreSQL como sistema gestor de base de datos.

PostgreSQL será administrado mediante Supabase, permitiendo utilizar una base de datos gestionada en la nube sin que el equipo tenga que administrar directamente el servidor de base de datos.

El backend utilizará Prisma para comunicarse con PostgreSQL.

La configuración de conexión utilizará variables de entorno, entre ellas:

DATABASE_URL="..."
DIRECT_URL="..."

Los valores reales no forman parte del código fuente y no deberán almacenarse en el repositorio.

El archivo:

backend/.env

se mantendrá fuera del control de versiones.

El repositorio contendrá únicamente un archivo de ejemplo:

backend/.env.example

sin credenciales reales.

--- 

## 8. Contenedores Docker

Docker será utilizado para empaquetar los componentes de aplicación y garantizar un entorno de ejecución consistente.

El uso de contenedores permitirá reducir diferencias entre el entorno local, Staging y Producción.

La arquitectura contempla principalmente:

```text
Docker
│
├── Frontend
│   └── Contenedor de la aplicación web
│
└── Backend
    └── Contenedor de la API
```

La base de datos no se ejecutará dentro de los contenedores de la aplicación, debido a que PostgreSQL será administrado mediante Supabase.

### Beneficios
- Reproducibilidad del entorno.
- Aislamiento de servicios.
- Facilidad de despliegue.
- Simplificación de la configuración.
- Mayor consistencia entre ambientes.

---

## 9. DigitalOcean

DigitalOcean será utilizado como proveedor de infraestructura cloud para desplegar los componentes de aplicación.

Los servicios de frontend y backend serán ejecutados mediante contenedores Docker dentro de la infraestructura de DigitalOcean.

La infraestructura será diseñada para permitir la separación entre los ambientes de Staging y Producción.

La configuración específica de los recursos de DigitalOcean podrá ajustarse de acuerdo con los requerimientos de rendimiento, disponibilidad y presupuesto del proyecto.

---

## 10. Ambientes

El proyecto contará con dos ambientes principales:

### 10.1 Staging

Staging será el ambiente utilizado para validar cambios antes de incorporarlos a Producción.

Su finalidad será permitir:

- Pruebas funcionales.
- Validación de nuevas funcionalidades.
- Pruebas de integración.
- Detección de errores antes del despliegue final.
- Validación de versiones generadas por el proceso CI/CD.

El código integrado en develop será candidato para ser desplegado en Staging. 

---

### 10.2 Producción

Producción será el ambiente destinado a ejecutar la versión estable del sistema.

Los cambios llegarán a Producción después de haber sido integrados y validados mediante el flujo establecido por el equipo.

La rama main representará el código considerado estable para Producción.

```text
Flujo de ambientes
feature/*
    │
    │ Pull Request
    ▼
 develop
    │
    │ CI/CD
    ▼
 STAGING
    │
    │ Validación
    ▼
 Pull Request
    │
    ▼
  main
    │
    │ CI/CD
    ▼
PRODUCCIÓN
```

---

##  11. Separación de datos entre ambientes

Se procurará mantener separados los datos utilizados en Staging de los datos utilizados en Producción.

La configuración recomendada es disponer de recursos de base de datos independientes para cada ambiente dentro de Supabase:

```text
                    SUPABASE
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
          PostgreSQL         PostgreSQL
           Staging           Producción
              │                 │
              ▲                 ▲
              │                 │
          Backend           Backend
          Staging          Producción
```

Esta separación evita que las pruebas realizadas en Staging afecten los datos reales de Producción.

En caso de que las restricciones del proyecto requieran inicialmente utilizar un único proyecto de Supabase, se deberá mantener igualmente una separación lógica y una política estricta para evitar modificaciones accidentales de los datos de Producción.

---

## 12. Gestión de configuración y secretos

La configuración específica de cada ambiente se manejará mediante variables de entorno.

No se almacenarán credenciales, contraseñas, tokens ni cadenas de conexión reales dentro del repositorio.

Ejemplo:

DATABASE_URL="..."
DIRECT_URL="..."

La configuración real será proporcionada mediante variables de entorno del ambiente correspondiente.

Esta estrategia permite utilizar el mismo código fuente en diferentes ambientes sin incluir información sensible dentro de la aplicación.

---

## 13. Control de versiones y Git Flow

El proyecto utilizará Git y GitHub como sistema de control de versiones.

Las ramas principales serán:

- main
- develop
- feature/*

**main**

Contendrá la versión estable destinada a Producción.

**develop**

Será la rama de integración de las funcionalidades desarrolladas por el equipo y estará asociada al ambiente de Staging.

**feature/***

Se utilizará para desarrollar funcionalidades, correcciones o tareas específicas.

El flujo general será:

```text
feature/*
     │
     ▼
Pull Request
     │
     ▼
develop
     │
     ▼
Staging
     │
     ▼
Validación
     │
     ▼
Pull Request
     │
     ▼
main
     │
     ▼
Producción
```

La definición detallada de Git Flow se encuentra en el documento git-flow.md.

---

## 14. Integración y despliegue continuo

GitHub Actions será utilizado para automatizar progresivamente el proceso de integración y despliegue.

El flujo previsto será:

```text
Developer
    │
    ▼
GitHub
    │
    ▼
Pull Request
    │
    ▼
GitHub Actions
    │
    ├── Instalación de dependencias
    ├── Lint
    ├── Pruebas
    └── Build
            │
            ▼
        Docker
            │
            ▼
       DigitalOcean
            │
       ┌────┴────┐
       ▼         ▼
    Staging   Producción
```

El pipeline se implementará progresivamente de acuerdo con las etapas establecidas para el proyecto.

---

## 15. Backups y recuperación

La protección de la información almacenada en PostgreSQL será una responsabilidad del área DevOps.

Se establecerá una política de backups para reducir el riesgo de pérdida de información y permitir la recuperación ante incidentes.

La estrategia contemplará:

- Definición de una frecuencia de respaldo.
- Definición de un período de retención.
- Verificación de la existencia de los respaldos.
- Procedimiento documentado de restauración.
- Pruebas periódicas de recuperación.
- Protección de las credenciales utilizadas para administrar los respaldos.

Los mecanismos específicos de backup dependerán de las capacidades disponibles en Supabase y de las necesidades del proyecto.

La implementación y automatización de esta estrategia será realizada como parte de las actividades DevOps posteriores.

---

## 16. Seguridad

La arquitectura contempla las siguientes medidas:

- Uso de HTTPS para las comunicaciones externas.
- No almacenar credenciales dentro del repositorio.
- Uso de variables de entorno.
- Separación entre Staging y Producción.
- Restricción del acceso directo a PostgreSQL desde el frontend.
- Acceso a la base de datos mediante el backend.
- Control de cambios mediante Pull Requests.
- Validaciones automatizadas mediante GitHub Actions.
- Uso de contenedores Docker para aislar los servicios de aplicación.

La configuración de seguridad se fortalecerá progresivamente durante la implementación.

---

## 17. Escalabilidad

La separación de frontend, backend y base de datos permite ampliar los recursos de cada componente según las necesidades del sistema.

La infraestructura podrá evolucionar mediante:

- Incremento de recursos de los servicios de DigitalOcean.
- Escalamiento de los contenedores del backend.
- Optimización de las consultas a PostgreSQL.
- Ajuste de los recursos disponibles en Supabase.
- Implementación futura de mecanismos adicionales de balanceo y disponibilidad.

La arquitectura inicial prioriza la simplicidad y el costo adecuado para un proyecto universitario, manteniendo la posibilidad de crecimiento.

---

## 18. Flujo completo de operación

El funcionamiento general de la arquitectura será:

```text
1. Usuario accede al sistema
              │
              ▼
2. Frontend en DigitalOcean
              │
              ▼
3. Solicitud HTTPS a la API
              │
              ▼
4. Backend NestJS
              │
              ▼
5. Prisma
              │
              ▼
6. PostgreSQL en Supabase
              │
              ▼
7. Respuesta al Backend
              │
              ▼
8. Respuesta al Frontend
              │
              ▼
9. Información presentada al usuario
```

---

## 19. Evolución de la infraestructura

La infraestructura será implementada progresivamente para reducir riesgos y permitir validar cada componente antes de avanzar a la siguiente etapa.

### Etapa 1 — Repositorio y desarrollo
-Configuración del repositorio GitHub.
-Configuración de Git Flow.
-Configuración del monorepo.
-Configuración de frontend y backend.
-Configuración de Prisma.
### Etapa 2 — Arquitectura cloud
-Definición de DigitalOcean.
-Definición de Docker.
-Integración con Supabase.
-Definición de Staging y Producción.
### Etapa 3 — Contenerización
-Creación de Dockerfiles.
-Configuración de imágenes.
-Pruebas de ejecución local mediante Docker.
### Etapa 4 — CI/CD
-Configuración de GitHub Actions.
-Validación automática del código.
-Ejecución de pruebas.
-Construcción de imágenes Docker.
-Automatización de despliegues.
### Etapa 5 — Staging
-Despliegue del sistema en Staging.
-Configuración de variables de entorno.
-Pruebas de integración.
-Validación de la aplicación.
### Etapa 6 — Producción
-Despliegue de la versión estable.
-Configuración de variables de entorno de Producción.
-Verificación del servicio.
-Monitoreo inicial.
### Etapa 7 — Backups y recuperación
-Definición de política de backups.
-Automatización de respaldos cuando corresponda.
-Verificación de respaldos.
-Pruebas de restauración.
### Etapa 8 — Seguridad y optimización
-Configuración de HTTPS.
-Revisión de secretos.
-Restricción de accesos.
-Optimización de recursos.
-Revisión de disponibilidad y rendimiento.

---

## 20. Justificación de la arquitectura

La arquitectura propuesta separa las responsabilidades del sistema y utiliza servicios especializados para cada componente.

DigitalOcean proporciona la infraestructura necesaria para ejecutar las aplicaciones mediante Docker, mientras que Supabase permite utilizar PostgreSQL como una base de datos administrada.

La utilización de Docker permite reproducir los entornos de ejecución y reducir diferencias entre desarrollo, Staging y Producción.

La separación entre frontend, backend y base de datos evita que los usuarios tengan acceso directo a la información almacenada y permite centralizar las reglas de negocio en el backend.

GitHub y Git Flow proporcionan un mecanismo organizado para controlar los cambios del código, mientras que GitHub Actions permitirá automatizar las validaciones y despliegues.

Finalmente, la separación de Staging y Producción, junto con una estrategia de backups y recuperación, permitirá reducir el impacto de errores durante el desarrollo y mejorar la confiabilidad del sistema.

---

## 21. Resumen de la arquitectura

```text
                    ┌──────────────────┐
                    │      GITHUB      │
                    │   Git + GitFlow  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ GitHub Actions   │
                    │      CI/CD       │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │      Docker      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   DigitalOcean   │
                    │                  │
                    │ ┌──────────────┐ │
                    │ │   Frontend   │ │
                    │ └──────────────┘ │
                    │                  │
                    │ ┌──────────────┐ │
                    │ │    Backend   │ │
                    │ └──────┬───────┘ │
                    └────────┼─────────┘
                             │
                             │ Prisma
                             ▼
                    ┌──────────────────┐
                    │     Supabase     │
                    │   PostgreSQL     │
                    │                  │
                    │     Backups      │
                    └──────────────────┘
```

Esta arquitectura constituye la base para la implementación progresiva de la infraestructura DevOps del proyecto.