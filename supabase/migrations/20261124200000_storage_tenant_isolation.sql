-- ESTADO: PENDIENTE DE APLICAR (24 nov. 2026). Aplicar solo junto con el cambio de
-- admin.jsx que sube las fotos a `<restaurant_id>/<archivo>`: con el panel actual,
-- que sube sin carpeta, estas políticas rechazarían todas las subidas.

-- Fotos de platos y de personal: cada restaurante solo escribe en su carpeta.
--
-- Las políticas anteriores dejaban a CUALQUIER usuario autenticado subir,
-- reemplazar o borrar archivos de los buckets menu-images y staff-avatars, sin
-- mirar de qué restaurante eran: el admin de un restaurante podía borrar las fotos
-- de la carta de otro. Ahora el primer segmento de la ruta tiene que ser el
-- restaurante del usuario (el panel sube a `<restaurant_id>/<archivo>`).
-- La lectura sigue siendo pública: la carta del cliente carga las fotos sin sesión.
-- Al aplicar esta migración ambos buckets estaban vacíos, no hay archivos que migrar.

drop policy if exists auth_upload_menu_images   on storage.objects;
drop policy if exists auth_update_menu_images   on storage.objects;
drop policy if exists auth_delete_menu_images   on storage.objects;
drop policy if exists auth_upload_staff_avatars on storage.objects;
drop policy if exists auth_update_staff_avatars on storage.objects;
drop policy if exists auth_delete_staff_avatars on storage.objects;

create policy auth_upload_menu_images on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images'
              and (storage.foldername(name))[1] = public.get_user_restaurant_id());
create policy auth_update_menu_images on storage.objects for update to authenticated
  using (bucket_id = 'menu-images'
         and (storage.foldername(name))[1] = public.get_user_restaurant_id())
  with check (bucket_id = 'menu-images'
              and (storage.foldername(name))[1] = public.get_user_restaurant_id());
create policy auth_delete_menu_images on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images'
         and (storage.foldername(name))[1] = public.get_user_restaurant_id());

create policy auth_upload_staff_avatars on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-avatars'
              and (storage.foldername(name))[1] = public.get_user_restaurant_id());
create policy auth_update_staff_avatars on storage.objects for update to authenticated
  using (bucket_id = 'staff-avatars'
         and (storage.foldername(name))[1] = public.get_user_restaurant_id())
  with check (bucket_id = 'staff-avatars'
              and (storage.foldername(name))[1] = public.get_user_restaurant_id());
create policy auth_delete_staff_avatars on storage.objects for delete to authenticated
  using (bucket_id = 'staff-avatars'
         and (storage.foldername(name))[1] = public.get_user_restaurant_id());
