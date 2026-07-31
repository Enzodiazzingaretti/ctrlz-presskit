# Consola de edición (`/admin.html`)

El panel está construido y funcionando, pero **desactivado a propósito**: sin las
variables de entorno cargadas en Vercel, el login con contraseña no existe y la
única forma de entrar es pegando a mano un token de GitHub. La artista no tiene
acceso y no hay ningún enlace al panel desde el sitio público.

Para activarlo más adelante, los pasos son estos.

---

## Cómo funciona

- **No hay base de datos.** El repositorio *es* la base de datos: el panel escribe
  `content.json` (y las imágenes en `img/`) usando la API de GitHub.
- **El sitio ya trae todo el contenido escrito en `index.html`.** Eso es lo que ven
  Google y WhatsApp, y lo que se muestra si falla el JavaScript. Si `content.json`
  existe, `script.js` lo usa para sobreescribir ese contenido.
- **La publicación es diferida.** Cada "Publicar cambios" hace un commit, Vercel
  redeploya solo y el sitio se ve actualizado en ~1 minuto. Es esperado.

## Activarlo

### 1. Generar las credenciales

```bash
node scripts/hash-password.js
```

Pide una contraseña (mínimo 10 caracteres, no se guarda en ningún archivo) e
imprime dos de las tres variables.

### 2. Cargar las variables en Vercel

**Settings → Environment Variables**:

| Variable | De dónde sale |
|----------|---------------|
| `ADMIN_PASSWORD_HASH` | La imprime `hash-password.js` (empieza con `scrypt$…`) |
| `SESSION_SECRET` | La imprime `hash-password.js` (aleatoria) |
| `GITHUB_TOKEN` | Fine-grained token de GitHub — ver abajo |

El `GITHUB_TOKEN` es un *fine-grained personal access token*
(GitHub → Settings → Developer settings → Fine-grained tokens):

- Alcance: **solo el repositorio `ctrlz-presskit`**.
- Permiso: **Contents → Read and write**.

`GITHUB_OWNER` / `GITHUB_REPO` no hacen falta: se completan solos desde la
integración de Git de Vercel (ver `api/_lib.js`).

### 3. Redeployar

Deployments → ⋯ → Redeploy, para que las variables tomen efecto.

Después de eso, `/admin.html` pide contraseña y la sesión dura 12 horas.

## Desactivarlo de nuevo

Borrar las tres variables y redeployar. El panel vuelve a quedar sin entrada.

---

## Qué se puede editar

| Pestaña | Contenido |
|---------|-----------|
| Artista | Nombre, ciudad, mail, teléfonos, redes, link al press kit |
| Textos | Portada, títulos y párrafos de cada sección |
| Listas | Géneros del ticker, datos destacados, artistas, escenarios, opciones de cabina, requerimientos, hospitalidad |
| Imágenes | Las 7 fotos fijas del sitio y la galería de prensa |
| Secciones | Encender y apagar secciones enteras |

En los textos, envolver una palabra entre asteriscos la destaca: `*así*` se
renderiza en negrita. No se acepta HTML — el contenido se inserta como texto,
así que nada de lo que se escriba en el panel puede inyectar etiquetas.

## Modo token (sin variables de entorno)

Es el estado actual. `/admin.html` detecta que la API no está configurada y pide
un fine-grained token de GitHub con **Contents: Read and write** sobre este repo.
Sirve para editar sin montar nada en Vercel; el token queda en el `localStorage`
del navegador, así que usalo solo en una máquina propia.

## Archivos

- `admin.html` · `admin.css` · `admin.js` — la consola.
- `api/_lib.js` — sesión, contraseña y helpers de GitHub (define qué variables se usan).
- `api/login.js` · `logout.js` · `session.js` — autenticación.
- `api/content.js` — lectura y escritura de `content.json`.
- `api/upload.js` — subida de imágenes a `img/`.
- `scripts/hash-password.js` — genera `ADMIN_PASSWORD_HASH` y `SESSION_SECRET`.
- `content.json` — el único archivo de contenido que el panel puede escribir.
