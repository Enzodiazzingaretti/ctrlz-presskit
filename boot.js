/* Marca que hay JavaScript antes del primer pintado.
   Las animaciones de entrada esconden el contenido con opacity:0, así que ese
   estado sólo puede existir si algo va a volver a mostrarlo. Sin JS, esta clase
   nunca cambia y el sitio se ve completo. */
document.documentElement.className =
  document.documentElement.className.replace('no-js', 'js');
