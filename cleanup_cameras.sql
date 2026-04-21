DELETE FROM depot_cameras WHERE ctid NOT IN (SELECT min(ctid) FROM depot_cameras GROUP BY stream_url);
SELECT name, stream_url, status FROM depot_cameras ORDER BY name;
