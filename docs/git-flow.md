# Git Flow

## 1. Objetivo

Definir una estrategia de control de versiones para el proyecto mediante Git y GitHub, estableciendo una estructura clara de ramas, reglas de trabajo y mecanismos de integración que permitan desarrollar nuevas funcionalidades de manera organizada y segura.

La estrategia utilizada se basa en Git Flow, adaptada a las necesidades del proyecto y a los ambientes definidos en la arquitectura cloud.

El objetivo principal es evitar que el desarrollo de nuevas funcionalidades afecte directamente al código estable y establecer un proceso controlado para integrar los cambios.

---

## 2. Herramientas utilizadas
| Herramienta |	Uso |
| ---|---|
| Git |	Control de versiones local |
| GitHub |	Repositorio remoto y colaboración |
| GitHub Pull Requests |	Revisión e integración de cambios |
| GitHub Actions |	Automatización de validaciones y CI/CD |
| VS Code |	Desarrollo y ejecución de comandos Git |

---

## 3. Estructura de ramas

El repositorio utiliza tres niveles principales de ramas:

```text
main
  │
  └── develop
        │
        ├── feature/*
        ├── feature/*
        └── feature/*
```

### 3.1 Rama main

La rama main representa la versión estable del proyecto y corresponde al ambiente de Producción.

En esta rama solamente deben incorporarse cambios que hayan pasado por el proceso de desarrollo, integración y validación correspondiente.

**Reglas:**

- No desarrollar directamente sobre main.
- Los cambios deben llegar mediante Pull Request.
- Representa la versión preparada para producción.
- Debe mantenerse siempre en un estado estable.

---

### 3.2 Rama develop

La rama develop representa la rama principal de integración del desarrollo y está asociada al ambiente de Staging.

En esta rama se integran las funcionalidades desarrolladas por los diferentes miembros del equipo antes de ser consideradas para producción.

**Reglas:**

- No desarrollar directamente sobre develop.
- Las funcionalidades se incorporan mediante Pull Request.
- Permite integrar y probar los cambios antes de llegar a main.
- Sirve como base para crear nuevas ramas feature/*.

---

### 3.3 Ramas feature/*

Las ramas feature/* se utilizan para desarrollar funcionalidades, correcciones o tareas específicas.

Cada integrante crea una rama independiente a partir de develop.

La nomenclatura utilizada será:

- feature/nombre-de-la-tarea

**Ejemplos:**

- feature/login
- feature/registro-usuarios
- feature/devops-arquitectura-gitflow
- feature/api-productos

Cada rama debe estar enfocada en una tarea concreta para facilitar la revisión y mantener cambios pequeños y controlables.

---

## 4. Flujo de trabajo

El flujo general utilizado por el equipo es:

```text
              ┌──────────────┐
              │     main     │
              │  Producción  │
              └──────┬───────┘
                     │
                     │
              ┌──────▼───────┐
              │   develop    │
              │   Staging    │
              └──────┬───────┘
                     │
              crear rama
                     │
              ┌──────▼────────────┐
              │    feature/*      │
              │ Desarrollo tarea  │
              └──────┬────────────┘
                     │
                  commits
                     │
                     ▼
              Pull Request
                     │
                     ▼
              ┌──────────────┐
              │   develop    │
              └──────┬───────┘
                     │
                validación
                     │
                     ▼
              Pull Request
                     │
                     ▼
              ┌──────────────┐
              │     main     │
              └──────────────┘
```

---

## 5. Creación de una rama de trabajo

Antes de comenzar una nueva tarea, el integrante debe actualizar su repositorio local y ubicarse en develop.

- git switch develop
- git pull origin develop

Posteriormente crea una rama para la tarea:

- git switch -c feature/nombre-de-la-tarea

**Ejemplo:**

- git switch -c feature/devops-arquitectura-gitflow

De esta manera, el trabajo se realiza de forma aislada y no modifica directamente develop.

---

## 6. Realización de cambios y commits

Los cambios correspondientes a la tarea se realizan dentro de la rama feature/*.

Antes de realizar un commit se deben revisar los archivos modificados:

- git status

Posteriormente se agregan los cambios:

- git add .

Y se crea el commit:

- git commit -m "docs: actualizar arquitectura cloud"

Se recomienda utilizar mensajes de commit claros y consistentes.

### Convención de commits

El proyecto utiliza una convención basada en prefijos:

| Prefijo |	Uso |
| ---|---|
| feat: |	Nueva funcionalidad |
| fix: |	Corrección de errores |
| docs: |	Documentación |
| refactor: |	Refactorización |
| test:	| Pruebas |
| chore: |	Tareas de mantenimiento |
| ci: |	Cambios relacionados con CI/CD |

**Ejemplos:**

- feat: agregar módulo de usuarios
- fix: corregir validación del formulario
- docs: actualizar arquitectura cloud
- test: agregar pruebas del módulo usuarios
- ci: configurar workflow de GitHub Actions

---

## 7. Publicación de la rama

Una vez realizados los cambios, la rama se publica en GitHub:

- git push -u origin feature/nombre-de-la-tarea

**Ejemplo:**

- git push -u origin feature/devops-arquitectura-gitflow

La rama queda disponible en el repositorio remoto para realizar el Pull Request.

---

## 8. Pull Request hacia develop

Cuando la tarea está terminada, se crea un Pull Request desde feature/* hacia develop.

```text
feature/*
     │
     │ Pull Request
     ▼
  develop
```

El Pull Request permite:

- Revisar los cambios.
- Detectar errores antes de integrar.
- Mantener trazabilidad de las modificaciones.
- Asociar los cambios con una tarea del proyecto.
- Ejecutar validaciones automatizadas mediante GitHub Actions cuando estén configuradas.
- Evitar modificaciones directas sobre develop.

Una vez aprobada la revisión y superadas las validaciones correspondientes, la rama puede integrarse mediante Merge.

---

## 9. Integración en develop

Después del Merge:

```text
feature/*
    │
    ▼
develop
```

La funcionalidad pasa a formar parte de la versión de integración del proyecto.

El ambiente asociado a develop es Staging, donde se podrán realizar pruebas de integración antes de llevar los cambios a producción.

---

## 10. Promoción hacia main

Cuando el conjunto de cambios integrado en develop ha sido validado y se considera estable, se crea un Pull Request desde develop hacia main.

```text
develop
   │
   │ Pull Request
   ▼
 main
```

Después de la aprobación y las validaciones correspondientes, los cambios se integran en main.

La rama main representa entonces la versión destinada al ambiente de Producción.

---

## 11. Relación entre Git Flow y ambientes

La estrategia de ramas está directamente relacionada con la arquitectura cloud definida para el proyecto.

| Rama |	Propósito |	Ambiente |
| ---|---|---|
| feature/* |	Desarrollo de tareas |	Desarrollo |
| develop |	Integración y validación |	Staging |
| main |	Versión estable |	Producción |

Esta separación permite que el código en desarrollo no afecte directamente al sistema utilizado en producción.

---

## 12. GitHub Actions y validaciones

El flujo de Git se complementará progresivamente con GitHub Actions.

El objetivo es que los Pull Requests puedan ejecutar automáticamente validaciones como:

```text
Pull Request
     │
     ▼
GitHub Actions
     │
     ├── Instalación de dependencias
     ├── Lint
     ├── TypeScript
     ├── Tests
     └── Build
```

Estas validaciones permitirán detectar errores antes de integrar los cambios.

La implementación completa de CI/CD será desarrollada progresivamente durante el proyecto y no se considera que todas estas automatizaciones estén implementadas desde el inicio.

---

## 13. Reglas de protección

Para mantener la estabilidad del repositorio se establecen las siguientes reglas:

### main
- No realizar commits directamente.
- Integrar cambios mediante Pull Request.
- Requerir validaciones antes del Merge.
- Mantener la rama en estado estable.
### develop
- Evitar commits directos.
- Integrar funcionalidades mediante Pull Request.
- Validar la integración antes de promover cambios a main.
- feature/*
- Utilizar una rama por tarea.
- Mantener el alcance de la rama limitado a su objetivo.
- Realizar commits pequeños y descriptivos.
- Actualizar la rama desde develop cuando sea necesario.

---

## 14. Ejemplo aplicado al proyecto

Para una tarea de DevOps relacionada con la arquitectura cloud y Git Flow, el flujo utilizado es:

- git switch develop
- git pull origin develop

- git switch -c feature/devops-arquitectura-gitflow

Se realizan los cambios necesarios en:

- arquitectura-cloud.md
- git-flow.md

Posteriormente:

- git status
- git add .
- git commit -m "docs: definir arquitectura cloud y git flow"
- git push -u origin feature/devops-arquitectura-gitflow

Finalmente, se crea un Pull Request:

```text
feature/devops-arquitectura-gitflow
                    │
                    │ Pull Request
                    ▼
                 develop
```

Después de la integración, la rama develop contiene los cambios de la tarea y puede continuar el proceso de validación hacia main.

---

## 15. Beneficios de la estrategia

La estrategia Git Flow permite:

- Separar desarrollo, integración y producción.
- Reducir el riesgo de introducir cambios inestables en producción.
- Facilitar el trabajo simultáneo de varios integrantes.
- Mantener trazabilidad de las modificaciones.
- Revisar los cambios mediante Pull Requests.
- Integrar progresivamente automatizaciones de CI/CD.
- Facilitar la identificación del responsable de cada cambio.
- Mantener una estructura organizada del repositorio.

---

## 16. Estado actual del flujo

El proyecto ya cuenta con la estructura básica de ramas necesaria para aplicar esta estrategia:

```text
main
  │
  └── develop
        │
        └── feature/*
```

Durante el desarrollo del proyecto, esta estructura se utilizará como base para incorporar progresivamente las validaciones automatizadas, despliegues a Staging y posteriormente el proceso de despliegue hacia Producción.

La estrategia se implementará de manera progresiva conforme se desarrollen las diferentes etapas del proyecto.

---

## 17. Resumen

El flujo de trabajo definido para el proyecto es:

```text
┌─────────────────────┐
│       main          │
│     Producción      │
└──────────▲──────────┘
           │
      Pull Request
           │
┌──────────┴──────────┐
│      develop        │
│      Staging        │
└──────────▲──────────┘
           │
      Pull Request
           │
┌──────────┴──────────┐
│     feature/*       │
│     Desarrollo      │
└─────────────────────┘
```

Cada funcionalidad comienza en una rama feature/*, posteriormente se integra mediante Pull Request en develop para su validación y, una vez considerada estable, se promueve mediante Pull Request hacia main.

De esta forma, Git y GitHub proporcionan una estructura de trabajo controlada que se integra con la arquitectura cloud y permite evolucionar posteriormente hacia un proceso completo de CI/CD.