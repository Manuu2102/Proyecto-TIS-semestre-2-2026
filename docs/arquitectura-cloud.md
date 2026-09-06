# Arquitectura Cloud

## Objetivo

Establecer una infraestructura que permita ejecutar el sistema
en ambientes de pruebas y producción de manera estable,
reproducible y escalable.

## Tecnologías

- DigitalOcean: servidor Cloud
- Docker: contenedores
- PostgreSQL: base de datos
- GitHub: repositorio
- GitHub Actions: CI/CD

## Arquitectura

GitHub
   |
   v
GitHub Actions
   |
   v
Docker
   |
   v
DigitalOcean
   |
   +---- Staging
   |
   +---- Producción
   |
   v
PostgreSQL
   |
   v
Backups

## Ambientes

### Staging

Ambiente destinado a realizar pruebas antes de publicar
una versión en producción.

### Producción

Ambiente donde estará disponible la versión estable
del sistema.

## Evolución

La infraestructura se implementará progresivamente:

1. Configuración del repositorio.
2. Configuración de ramas.
3. Configuración CI/CD.
4. Implementación de Staging.
5. Despliegues automatizados.
6. Backups de la BD.
7. Seguridad y SSL.
8. Despliegue final a producción.