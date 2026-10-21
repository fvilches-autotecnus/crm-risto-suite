# Risto Suite · Portal CRM

Panel multi-negocio (reservas, clientes, consultas, conversaciones del bot) sobre Supabase.
Producción: https://crm.ristosuite.app

- **Stack:** Next.js 16 (App Router) · Tailwind 3 · Supabase Auth + Postgres (RLS por membresía).
- **Login:** por *usuario* (`perfiles.usuario`); el email interno es `<usuario>@usuarios.ristosuite.app`.
- **Roles por negocio:** owner · admin · encargado · staff · solo_lectura (+ superadmin de plataforma).
- **Variables (`.env.example`):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  `TOQUE_STATUS_WEBHOOK_SECRET` es opcional: sin él, confirmar/cancelar no avisa por WhatsApp.
- **Base de datos:** las migraciones y los tests de RLS viven en el repo `ristosuite-core` (local).

```bash
npm install
npm run dev
```
