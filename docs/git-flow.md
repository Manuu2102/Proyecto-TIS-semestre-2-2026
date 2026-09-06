# Estrategia Git Flow

## Objetivo

Establecer una estrategia de control de versiones que permita
trabajar de manera colaborativa y mantener una versión estable
del sistema.

## Ramas principales

### main

Contiene las versiones estables destinadas a producción.

### develop

Integra las funcionalidades desarrolladas antes de su publicación.

### feature/*

Se utilizan para desarrollar funcionalidades específicas.

Ejemplos:

- feature/login
- feature/usuarios
- feature/pagos
- feature/reportes

## Flujo de trabajo

1. El desarrollador obtiene la última versión de develop.
2. Crea una rama feature.
3. Implementa la funcionalidad.
4. Realiza commits.
5. Sube la rama a GitHub.
6. Crea un Pull Request hacia develop.
7. Se revisa el código.
8. Se ejecutan las validaciones correspondientes.
9. La funcionalidad se integra en develop.
10. Las versiones estables se integran posteriormente en main.

## Reglas

- No realizar cambios directamente sobre main.
- Utilizar Pull Requests.
- Utilizar nombres descriptivos para las ramas.
- Realizar commits pequeños y descriptivos.
- No subir contraseñas, tokens ni archivos .env.