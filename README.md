# SkyRace

Sistema web de cronometraje para carreras contrarreloj de drones con cinco secciones, leaderboard en vivo y vista pública.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://127.0.0.1:4173`.

## Desplegar en Vercel desde GitHub

1. Sube estos archivos al repositorio `LilTeo14/SkyRace`.
2. En Vercel, selecciona **Add New > Project** e importa el repositorio.
3. Vercel detectará automáticamente Vite. La configuración ya está declarada en `vercel.json`.
4. Selecciona **Deploy**. Supabase no es obligatorio para el primer despliegue.

Sin variables de Supabase, la aplicación utiliza `localStorage` y `BroadcastChannel`: conserva los resultados en el navegador y sincroniza pestañas del mismo dispositivo.

## Conectar Supabase más adelante

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta todo el archivo `supabase/schema.sql`.
3. En Vercel abre **Project Settings > Environment Variables** y agrega:

```text
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_ANON
```

4. Activa ambas variables para Production y Preview.
5. Vuelve a desplegar el proyecto. Las variables de Vite se incorporan durante el build, por lo que no afectan despliegues anteriores.

Para trabajar localmente, copia `.env.example` como `.env.local` y completa los mismos valores.

Cuando las variables son válidas, la aplicación cambia automáticamente a Supabase, carga pilotos y tiempos desde la base de datos y escucha actualizaciones de Realtime entre dispositivos.

## Seguridad antes de un evento público

El esquema incluido permite escritura anónima para que el prototipo funcione sin autenticación. Antes de una competencia real abierta a internet se recomienda agregar Supabase Auth para jueces y reemplazar las políticas de `INSERT` y `DELETE` por políticas exclusivas para usuarios autenticados. La vista pública solo necesita permiso de lectura.

## Funciones

- Cronómetro con un único botón de control: inicio, secciones 1–4 y meta/sección 5.
- Clasificación automática usando el mejor intento de cada piloto.
- Tiempos individuales para las cinco secciones.
- Vista pública para proyección.
- Registro de pilotos e historial de intentos.
- Exportación CSV.
- Funcionamiento local sin backend y conexión opcional con Supabase.

La primera apertura en modo local incluye resultados de demostración. Usa **Borrar resultados** antes de comenzar un evento real. Supabase comienza sin resultados de demostración.
