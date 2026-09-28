-- =====================================================================
-- Ejecutar DESPUÉS de crear los dos usuarios en Authentication > Users.
-- Cambia los emails y nombres por los vuestros.
-- =====================================================================

-- Tú: apuntas jornadas y ves los cobros
update public.profiles set role = 'asistente', name = 'Iván'
where email = 'TU_EMAIL@ejemplo.com';

-- Presti (editor): ve proyectos, tareas y tus días trabajados (sin importes)
update public.profiles set role = 'editor', name = 'Presti'
where email = 'EMAIL_DE_PRESTI@ejemplo.com';

-- Comprobación: deben salir dos filas con su rol correcto
select email, name, role from public.profiles;
