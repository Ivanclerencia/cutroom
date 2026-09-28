# Cutroom

App compartida entre asistente y editor para llevar **proyectos, entregas, tareas, calendario, jornadas y cobros**.
Los cambios de uno los ve el otro al instante.

- **Asistente:** apunta jornadas (completa o media) y ve la sección **Cobros** (tarifa, importes, facturado/pagado).
- **Editor:** ve y edita proyectos, entregas y tareas, y ve los días trabajados, **sin importes**.
  Esto lo bloquea la base de datos (Row Level Security), no solo la pantalla.

Stack: React + Vite · Supabase (base de datos, login y tiempo real) · GitHub Pages (publicación).

---

## Puesta en marcha (una sola vez, unos 15 minutos)

### 1. Base de datos en Supabase
1. En [supabase.com/dashboard](https://supabase.com/dashboard) crea un proyecto nuevo (región *West EU*). Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. Ve a **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.

### 2. Usuarios
1. **Authentication → Users → Add user → Create new user**: crea tu usuario y el del editor (email y contraseña) con **Auto Confirm User** marcado.
2. **Authentication → Sign In / Providers**: desactiva **Allow new users to sign up**, para que nadie más pueda registrarse.
3. Abre [`supabase/usuarios.sql`](supabase/usuarios.sql), pon los dos emails y nombres, y ejecútalo en el SQL Editor.

### 3. Conectar la app
En **Project Settings → API** (o el botón **Connect**) copia la *Project URL* y la clave *anon / publishable*.

- **En local:** copia `.env.example` como `.env.local` y pega los dos valores. Luego ejecuta `npm install` y `npm run dev`.
- **En GitHub** (para publicarla), en el repositorio ve a **Settings → Secrets and variables → Actions → Variables** y crea:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

> La clave *anon* es pública por diseño: lo que protege los datos son las reglas de seguridad del `schema.sql`.
> Nunca pongas la clave `service_role` en la app.

### 4. Publicar
1. Sube el proyecto a un repositorio de GitHub (rama `main`).
2. **Settings → Pages → Source: GitHub Actions**.
3. Cada `git push` a `main` publica la web en `https://TU_USUARIO.github.io/NOMBRE_REPO/`.
4. Pásale ese enlace y sus credenciales al editor.

---

## Modo demo
Si no hay `.env.local`, la app arranca con datos de ejemplo guardados en el navegador y botones para entrar como asistente o como editor.
Abre dos pestañas, una con cada usuario, y verás cómo se sincronizan.

## Notas
- En el plan gratuito, Supabase pausa el proyecto si pasa **7 días sin ningún uso**. Se reactiva desde el panel con un clic.
- Para cambiar la tarifa: **Cobros → Tarifa por jornada**. Al marcar un mes como *Facturado*, se congela la tarifa de ese mes.
- Estructura: `src/views/` (una pantalla por pestaña), `src/lib/backend.js` (Supabase o demo) y `supabase/` (SQL).
