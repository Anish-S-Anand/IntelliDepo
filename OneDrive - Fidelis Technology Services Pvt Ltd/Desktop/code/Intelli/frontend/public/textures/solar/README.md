INTELLI solar texture drop zone

Place authored PBR textures here using this exact structure:

textures/
  solar/
    stream/
      stream_albedo.webp
      stream_normal.webp
      stream_roughness.webp
      stream_displacement.webp
      stream_emissive.webp
    depot/
      depot_albedo.webp
      depot_normal.webp
      depot_roughness.webp
      depot_displacement.webp
      depot_emissive.webp
    cafe/
      cafe_albedo.webp
      cafe_normal.webp
      cafe_roughness.webp
      cafe_displacement.webp
      cafe_emissive.webp
    recruit/
      recruit_albedo.webp
      recruit_normal.webp
      recruit_roughness.webp
      recruit_displacement.webp
      recruit_emissive.webp

Recommended export:
- format: `webp` or `png`
- resolution: `2048x2048` minimum, `4096x4096` preferred, `8192x8192` if you truly have authored assets and still get acceptable load times
- color maps:
  - albedo
  - emissive
- data maps:
  - normal
  - roughness
  - displacement

The scene already falls back to procedural materials if these files are missing.

Current orbiting variants:
- `stream`
- `depot`
- `cafe`
- `recruit`

`INTELLI` is the central sun and does not use this folder structure.

For the most realistic Earth-style `recruit` planet, use these real files first:
- `recruit_albedo.jpg`
  Suggested source: NASA Blue Marble / Earth day map at 4K or 8K
- `recruit_clouds.jpg`
  Suggested source: Earth cloud map
- `recruit_normal.jpg`
  Suggested source: Earth normal map
- `recruit_specular.jpg`
  Suggested source: Earth specular or water mask

The loader now accepts `.webp`, `.png`, `.jpg`, and `.jpeg`, so you do not need to convert the downloaded Earth files before testing them.

Suggested target quality:
- use `4096x4096` for all four variant albedo maps
- use `2048x2048` to `4096x4096` for normal / roughness / displacement
- only use `8192x8192` if you are optimizing with compression and testing on high-end machines
