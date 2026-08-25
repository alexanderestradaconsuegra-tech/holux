# Migraciones

Aplicadas al proyecto Supabase `nlwrkumlrudfgsdnhfhw` y guardadas aquí para que
el esquema sea reproducible.

Dos de ellas cargan el restaurante `demo` (su carta, mesas, personal y el
servicio de ejemplo). No están en archivo porque son datos, no esquema: la
misma carga vive dentro de `reset_demo()`, que se puede correr desde el editor
SQL para devolver la demo a su estado inicial cuando un visitante la desordene.

    select reset_demo();
