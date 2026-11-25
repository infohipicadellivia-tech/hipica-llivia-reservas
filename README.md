# Hípica de Llívia - MVP web

Aplicación estática conectada al esquema existente de Supabase.

## Incluye
- Login con email y contraseña.
- Inicio con saludo, saldo total y próxima reserva.
- Mis bonos.
- Mis reservas.
- Solicitud de reserva mediante la RPC `request_booking()`.
- Validación visual de bono y disponibilidad.
- Diseño responsive para móvil.

## Configuración
1. Abre `config.js`.
2. En Supabase, entra en **Project Settings > API** (o Connect).
3. Copia la **Project URL** en `supabaseUrl`.
4. Copia la **Publishable key** en `supabasePublishableKey`.
5. No uses nunca la secret key ni `service_role`.

## Probar localmente
No abras `index.html` con doble clic. Levanta un servidor local:

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

## Publicar sin coste
### GitHub Pages
1. Crea un repositorio privado o público.
2. Sube los cuatro archivos del proyecto.
3. Activa Pages desde Settings > Pages.
4. Añade la URL publicada en Supabase: Authentication > URL Configuration > Site URL y Redirect URLs.

### Cloudflare Pages
Conecta el repositorio y publica como sitio estático, sin comando de build.

## Supabase
Este frontend espera las tablas/vistas existentes:
- profiles
- passes y pass_services
- services
- bookings y time_slots
- slot_availability

Y la RPC:
- request_booking(p_time_slot_id, p_pass_id, p_customer_notes)

## Seguridad
La Publishable key puede estar en el navegador; la protección real depende de RLS. El proyecto no contiene ninguna secret key.
