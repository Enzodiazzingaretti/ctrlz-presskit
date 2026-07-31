# CTRL.Z — Press Kit

Press kit oficial de **CTRL.Z** (Brenda Hetcer), DJ de música urbana de Mendoza,
Argentina. Sitio estático de una sola página: bio, escenarios, fotos de prensa,
rider técnico, hospitalidad y contacto de booking.

La estética sigue el press kit original en PDF: verde oliva y musgo con brillos
de luz, títulos cromados y fotos con el mismo grado de color.

## Cómo está armado

Sin framework ni build: HTML, CSS y JavaScript a mano.

| Archivo | Qué hace |
|---------|----------|
| `index.html` | Todo el contenido escrito. Es lo que ven Google y WhatsApp, y lo que se muestra si falla el JavaScript. |
| `content.json` | El mismo contenido en datos. Si existe, `script.js` lo usa para sobreescribir el HTML. Es lo único que edita el panel. |
| `style.css` | Estilos del sitio. |
| `boot.js` | Marca que hay JavaScript antes del primer pintado, para que las animaciones de entrada no escondan el contenido si el JS no corre. |
| `script.js` | Hidratación desde `content.json`, barra, animaciones de entrada y visor de fotos. |
| `admin.html` · `admin.css` · `admin.js` | La consola de edición. **Desactivada** — ver `docs/PANEL.md`. |
| `api/` | Funciones serverless del panel (login, sesión, contenido, subida de imágenes). |
| `vercel.json` | Cabeceras de seguridad y caché. |

### Contenido en dos lugares a la vez

`index.html` y `content.json` dicen lo mismo, a propósito:

- El HTML es la fuente para los buscadores y para navegadores sin JavaScript.
- El JSON es lo que el panel puede reescribir sin tocar código.

Si se edita algo a mano, conviene cambiarlo en los dos lados. Si sólo se cambia
el JSON, el sitio se ve bien igual, pero la vista previa de WhatsApp y lo que
indexa Google quedan con el texto viejo.

En los textos del JSON, envolver una palabra entre asteriscos la destaca:
`*así*` se renderiza en negrita. No se acepta HTML: el contenido se inserta como
texto plano, así que nada de lo que se escriba en el panel puede inyectar etiquetas.

## Panel de edición

Está construido y probado, pero **sin acceso**: no hay ningún enlace desde el
sitio y, sin las variables de entorno cargadas en Vercel, el login con contraseña
no existe. Queda listo por si más adelante se decide usarlo.

Los pasos para activarlo están en [`docs/PANEL.md`](docs/PANEL.md).

## Deploy

Sitio estático + funciones en `api/`. Se importa el repo en Vercel y no hace
falta configurar build. Las variables de entorno sólo hacen falta para el panel.

## Desarrollo local

```bash
python -m http.server 8125
```

El panel necesita las funciones de `api/`, que no corren con un servidor
estático: en ese caso `admin.html` cae al modo token y pide un fine-grained
token de GitHub.

---

Sitio por [Enzo Díaz Zingaretti](https://portfolio-kexxy.vercel.app).
