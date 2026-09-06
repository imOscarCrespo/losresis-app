-- Chat directo: alinea el gate del residente con el de Conexiones.
--
-- Problema: ensure_direct_group exigía `work_email` no vacío al emisor residente
-- y lanzaba 'caller_missing_work_email'. Ese check nunca se actualizó cuando
-- 20260608190000_social_access_includes_seasonal_r1.sql amplió el acceso social
-- a los R1 dentro de la ventana de gracia MIR
-- (resident_state = 'pending_corporate_email_seasonal'), que por definición aún
-- NO tienen email corporativo. Resultado: esos residentes veían perfiles en
-- RoomiesMIR / Conexiones pero al pulsar "Abrir chat" recibían el error crudo
-- 'caller_missing_work_email'.
--
-- Solución: usar el predicado canónico public.is_resident_connection_eligible,
-- que ya incluye 'active', 'pending_corporate_email_seasonal' y el caso legacy
-- (resident_state null + work_email). 'locked_missing_corporate_email' (gracia
-- expirada sin email) sigue bloqueado, ahora con el código
-- 'caller_not_social_eligible'.
--
-- No residentes (estudiantes, doctores, hosts) mantienen el comportamiento
-- anterior: el gate solo aplicaba —y sigue aplicando— a is_resident = true.
set check_function_bodies = off;

create or replace function public.ensure_direct_group(p_other_user_id uuid)
returns table(group_id uuid, group_name text, other_user_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
  DECLARE
    v_current_user_id uuid := auth.uid();
    v_pair_key text;
    v_group_id uuid;
    v_other_exists boolean;
    v_other_name text;
    v_current_is_resident boolean;
  BEGIN
    IF v_current_user_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_other_user_id IS NULL THEN
      RAISE EXCEPTION 'Other user is required';
    END IF;

    IF p_other_user_id = v_current_user_id THEN
      RAISE EXCEPTION 'Cannot create a direct chat with yourself';
    END IF;

    SELECT COALESCE(is_resident, false)
    INTO v_current_is_resident
    FROM public.users
    WHERE id = v_current_user_id;

    IF COALESCE(v_current_is_resident, false) = true
       AND public.is_resident_connection_eligible(v_current_user_id) = false THEN
      RAISE EXCEPTION 'caller_not_social_eligible'
        USING ERRCODE = 'P0001',
              HINT = 'Residents whose corporate email grace period expired must verify it to start a chat.';
    END IF;

    SELECT
      true,
      NULLIF(TRIM(CONCAT(COALESCE(name, ''), ' ', COALESCE(surname, ''))), '')
    INTO v_other_exists, v_other_name
    FROM public.users
    WHERE id = p_other_user_id;

    IF COALESCE(v_other_exists, false) = false THEN
      RAISE EXCEPTION 'Recipient not found';
    END IF;

    v_pair_key := CASE
      WHEN v_current_user_id::text < p_other_user_id::text
        THEN v_current_user_id::text || ':' || p_other_user_id::text
      ELSE p_other_user_id::text || ':' || v_current_user_id::text
    END;

    SELECT g.id
    INTO v_group_id
    FROM public.groups g
    WHERE g.kind = 'direct'
      AND g.direct_pair_key = v_pair_key
    LIMIT 1;

    IF v_group_id IS NULL THEN
      BEGIN
        INSERT INTO public.groups (
          user_type,
          speciality_id,
          city,
          name,
          description,
          member_count,
          is_active,
          kind,
          created_by_user_id,
          direct_pair_key
        )
        VALUES (
          'resident',
          NULL,
          NULL,
          'Chat directo',
          'Conversación privada entre dos usuarios',
          0,
          true,
          'direct',
          v_current_user_id,
          v_pair_key
        )
        RETURNING id INTO v_group_id;
      EXCEPTION WHEN unique_violation THEN
        SELECT g.id
        INTO v_group_id
        FROM public.groups g
        WHERE g.kind = 'direct'
          AND g.direct_pair_key = v_pair_key
        LIMIT 1;
      END;
    END IF;

    INSERT INTO public.group_members (group_id, user_id)
    VALUES
      (v_group_id, v_current_user_id),
      (v_group_id, p_other_user_id)
    ON CONFLICT ON CONSTRAINT group_members_group_id_user_id_key DO NOTHING;

    RETURN QUERY
    SELECT
      v_group_id,
      COALESCE(v_other_name, 'Chat directo'),
      p_other_user_id;
  END;
$function$;

grant execute on function public.ensure_direct_group(uuid) to anon, authenticated, service_role;
