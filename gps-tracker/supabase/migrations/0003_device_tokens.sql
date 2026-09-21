-- RPC para generar un dispositivo con su token.
-- El token en texto plano SOLO se devuelve una vez, en el resultado de esta
-- función. En la tabla `devices` solo se guarda su hash (sha256). Si el
-- dueño pierde el token, no hay forma de recuperarlo: hay que revocar el
-- dispositivo y crear uno nuevo (igual que una API key normal).
create or replace function create_device(
  p_vehicle_id uuid,
  p_type text,
  p_external_id text default null
)
returns table (device_id uuid, device_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_token text;
  v_token_hash text;
  v_device_id uuid;
begin
  select owner_id into v_owner from vehicles where id = p_vehicle_id;

  if v_owner is null then
    raise exception 'vehicle_not_found';
  end if;

  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'not_authorized';
  end if;

  if p_type not in ('phone', 'hardware') then
    raise exception 'invalid_type';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into devices (vehicle_id, type, external_id, token_hash)
  values (p_vehicle_id, p_type, p_external_id, v_token_hash)
  returning id into v_device_id;

  return query select v_device_id, v_token;
end;
$$;

grant execute on function create_device(uuid, text, text) to authenticated;
