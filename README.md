# EntreLíneas — actualización

Se cambió el nombre visible y el manifiesto de instalación. El botón **Eliminar club** solo aparece al administrador.

**Doble verificación:** primero aceptar un cuadro de confirmación y luego escribir exactamente el nombre del club.

**Importante:** la acción es una eliminación lógica: el club desaparece de la app para todos y se bloquean operaciones posteriores, pero los documentos permanecen en Firestore. Para borrado físico completo de subcolecciones (incluidos diarios privados), es necesario un proceso administrativo de eliminación recursiva mediante un backend confiable.

1. En Firebase > Firestore Database > Reglas, reemplazar por el archivo firestore.rules y publicar.
2. En GitHub, subir y reemplazar index.html, app.js, manifest.webmanifest, sw.js y demás archivos de este paquete, manteniendo la carpeta icons.
3. Recargar con Ctrl+F5, probar con un club de prueba y dos usuarios.
4. Si ya instalaste la PWA, puede ser necesario cerrar y reabrirla para actualizar el nombre.

No borrar el proyecto Firebase ni otros clubes.
