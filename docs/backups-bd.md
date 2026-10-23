# Configuración de respaldos de base de datos

## 1. Introducción

El presente documento describe la configuración inicial de un procedimiento manual para respaldar la base de datos PostgreSQL del Sistema de Gestión de Edificio. El objetivo es establecer un mecanismo reproducible para proteger la información y preparar la implementación futura de respaldos automatizados.

## 2. Objetivos

### 2.1. Objetivo general

Establecer un procedimiento de respaldo de la base de datos que permita generar copias de seguridad y verificar su integridad estructural mediante herramientas de PostgreSQL.

### 2.2. Objetivos específicos

- Configurar un procedimiento de respaldo manual utilizando `pg_dump`.
- Generar copias en un formato compatible con `pg_restore`.
- Proteger las credenciales de conexión y evitar la publicación de respaldos en el repositorio.
- Documentar los pasos de ejecución y verificación.
- Establecer una base para la futura automatización de los respaldos.

## 3. Alcance

Esta etapa comprende la preparación de la documentación y del procedimiento de respaldo manual de la base de datos PostgreSQL administrada mediante Supabase.

La programación periódica, la ejecución automática, las notificaciones y la gestión automatizada de las copias se abordarán en una etapa posterior.

## 4. Arquitectura de la solución

La arquitectura contempla los siguientes componentes:

- **Base de datos:** PostgreSQL administrado mediante Supabase.
- **Herramienta de respaldo:** `pg_dump`, utilizada para generar una copia de la base de datos.
- **Formato de salida:** formato personalizado de PostgreSQL, identificado por la extensión `.dump`.
- **Herramienta de verificación:** `pg_restore`, utilizada para inspeccionar el contenido del archivo y realizar restauraciones controladas.
- **Almacenamiento temporal:** directorio local destinado a las copias generadas, excluido del control de versiones.

La conexión a la base de datos se configurará mediante la variable de entorno `DATABASE_URL`. Esta variable debe mantenerse protegida y no debe incluirse directamente en el código fuente ni publicarse en el repositorio.

## 5. Procedimiento de respaldo manual

### 5.1. Verificación de herramientas

Antes de realizar un respaldo, se debe comprobar la disponibilidad de las herramientas necesarias:

```bash
pg_dump --version
pg_restore --version
```

También se debe verificar la compatibilidad de la versión del cliente PostgreSQL con el servidor de base de datos.

### 5.2. Configuración de la conexión
La conexión debe configurarse mediante una variable de entorno denominada DATABASE_URL.

Las credenciales deben obtenerse de la configuración segura del proyecto. No se deben compartir contraseñas ni cadenas de conexión en capturas públicas, archivos versionados o conversaciones.
### 5.3. Ejecución del respaldo

El respaldo se realizará mediante pg_dump, utilizando el formato personalizado:

```text
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="backup_bd.dump"
```

El comando genera un archivo de respaldo que puede inspeccionarse y restaurarse mediante las herramientas de PostgreSQL.

### 5.4. Verificación del archivo generado
Después de ejecutar el respaldo, se debe comprobar que el archivo exista y tenga un tamaño razonable:
ls -lh backup_bd.dump


Posteriormente, se puede inspeccionar la estructura del archivo:

```text
pg_restore --list backup_bd.dump
```

La posibilidad de listar el contenido confirma que el archivo puede interpretarse como un archivo de respaldo válido. Sin embargo, esta comprobación por sí sola no garantiza que una restauración completa vaya a funcionar.

### 5.5. Prueba de restauración
Cuando el entorno lo permita, se realizará una restauración de prueba en una base de datos aislada o desechable.

La prueba permitirá comprobar que la copia puede utilizarse para recuperar la información y que los objetos restaurados son accesibles.

No se debe ejecutar una restauración de prueba sobre la base de datos de producción ni sobre una base de datos compartida sin autorización y sin un procedimiento de protección adecuado.

## 6. Seguridad de los respaldos
Para proteger la información del proyecto, se establecen las siguientes medidas:

- No almacenar credenciales directamente en los scripts.
- No versionar archivos .env, cadenas de conexión ni contraseñas.
- Excluir los respaldos reales del control de versiones mediante .gitignore.
- Restringir el acceso a los archivos de respaldo.
- Evitar almacenar copias en ubicaciones públicas o repositorios accesibles sin autorización.
- Comprobar periódicamente la posibilidad de restaurar las copias.
- Definir posteriormente una política de conservación y eliminación segura de respaldos antiguos.

## 7. Evidencias y resultados
Durante la ejecución de la práctica se recopilarán las siguientes evidencias:

1. Captura de la verificación de las herramientas PostgreSQL.
2. Captura de la ejecución del procedimiento de respaldo, ocultando cualquier dato sensible.
3. Captura del archivo de respaldo generado y su tamaño.
4. Captura de la inspección del archivo mediante pg_restore --list.
5. Evidencia de la prueba de restauración, si se realiza.
6. Registro de fecha, entorno utilizado y resultado de cada prueba.
Los resultados se documentarán únicamente después de ejecutar las pruebas correspondientes. La existencia del procedimiento o del script no constituye, por sí sola, evidencia de que se haya generado o restaurado un respaldo correctamente.
8. Trabajo futuro: automatización de respaldos
En una etapa posterior se evaluará la automatización del procedimiento mediante herramientas de integración continua, como GitHub Actions.

La automatización podrá contemplar:

- Ejecución programada de respaldos.
- Gestión segura de credenciales mediante secretos.
- Verificación automática del resultado de cada ejecución.
- Política de conservación de copias.
- Notificaciones ante errores.
- Pruebas periódicas de restauración.
Estas funcionalidades quedan fuera del alcance de la configuración manual inicial.

## 9. Conclusión
La preparación de un procedimiento de respaldo manual establece una base para mejorar la protección de la información del Sistema de Gestión de Edificio.

La eficacia del procedimiento deberá comprobarse mediante la generación de una copia, la inspección de su estructura y, cuando sea posible, una restauración controlada. Esta etapa servirá como fundamento para implementar posteriormente una solución automatizada de respaldos de base de datos.