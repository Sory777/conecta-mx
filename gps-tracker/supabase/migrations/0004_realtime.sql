-- Publica la tabla vehicles para Supabase Realtime. El dashboard escucha
-- UPDATE en esta tabla (el trigger de positions la actualiza en cada
-- posición nueva) y así el mapa se mueve sin hacer polling.
alter publication supabase_realtime add table vehicles;
