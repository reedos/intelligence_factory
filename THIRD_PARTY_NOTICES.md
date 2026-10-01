# Third-party material

The Intelligence Factory is a personal educational project. This file lists the material in it that did not originate
in the project, where each piece came from, and the terms it carries, as recorded on 09/27/2026 from the repository,
its history and the licensors' own pages. It is an inventory, not a legal opinion.

The MIT license in [`LICENSE`](LICENSE) covers the project's own original code and text. It does not cover the items
below, which keep their own terms, and it is not a grant of any rights in the hero images (see *Images*).

## Code shipped in the site

The production build bundles three open-source packages.

| Package | Version | License | Copyright |
|---|---|---|---|
| [three](https://github.com/mrdoob/three.js) (core and the `three/addons` controls and post-processing passes) | 0.183.2 | MIT | © 2010–2026 three.js authors |
| [us-atlas](https://github.com/topojson/us-atlas) (`states-10m.json`) | 3.0.1 | ISC | © 2013–2019 Michael Bostock |
| [topojson-client](https://github.com/topojson/topojson-client) | 3.1.0 | ISC | © 2012–2019 Michael Bostock |

Their license texts are reproduced at the end of this file. Build and test tools (Vite, Vitest, TypeScript, Playwright,
`@types/three`) do not ship with the site; each carries its own license in `node_modules`.

## Fonts

Loaded from Google Fonts at page load; no font files are stored in this repository or the build.

| Family | Designer | License |
|---|---|---|
| Barlow Condensed | Jeremy Tribby | [SIL Open Font License 1.1](https://github.com/jpt/barlow/blob/main/OFL.txt) |
| Manrope | Mikhail Sharanda | [SIL Open Font License 1.1](https://github.com/googlefonts/manrope/blob/master/OFL.txt) |
| IBM Plex Mono | IBM Corp. ("Plex" is a Reserved Font Name) | [SIL Open Font License 1.1](https://github.com/IBM/plex/blob/master/LICENSE.txt) |

## Data

- **U.S. state outlines**: U.S. Census Bureau cartographic boundaries, as packaged by us-atlas (above).
- **State and national grid carbon intensity**: U.S. Energy Information Administration, *State Electricity Profiles*,
  2024 data (released 11/10/2025), and U.S. EPA *eGRID 2022*. EIA asks that reuse acknowledge the source and its
  publication date; this line and the per-figure citations do so.
- **Real AI campuses** (status, power, dates): Epoch AI, *Frontier Data Centers* and *Largest AI data centers*, cited
  page by page. Epoch AI states its data is free to use, distribute and reproduce provided the source and authors are
  credited. Credit: Epoch AI, "AI data centers", published online at epoch.ai, retrieved from
  <https://epoch.ai/data/ai-data-centers> (checked 09/27/2026).
- **Everything else**: facts and figures from the public sources listed on the site's Evidence page, each linked from
  the figure it supports. The site paraphrases what it uses and links to the original; it does not reproduce sources'
  text, images or diagrams. A search on 09/27/2026 of the card, glossary and diagram text for passages copied from
  sources found only short, marked quotations.

## Images and 3D models

- **3D scenes and diagrams**: a mix of procedural geometry and this project's own modeled geometry, both its own
  work. Most of the scene in `src/scenes/` is built by code at runtime from the model's numbers. Twenty-five pieces of
  hardware (`public/models/*.glb`: racks, trays, compute chips, campus buildings and vehicles, the optical and
  co-packaged-optics modules, and more) were instead modeled by hand in Blender from this project's own `.blend`
  files (`tools/blender/`) and exported to glTF/GLB by this project's own build scripts (`tools/blender/build-*.py`),
  then loaded into the scene alongside the procedural geometry. No CAD files, vendor models or textures were
  imported from outside the project. All of it, procedural and modeled alike, is schematic, not a vendor's own
  drawing.
- **Hero images** (`public/hero/campus*.webp`): generated with OpenAI's image-generation tool, run on 09/27/2026 by
  another AI agent working on this project, from a written brief (`design/hero/BRIEF.md`) and a render of this site's
  own 3D campus as the layout reference (`design/hero/reference-campus.png`). The tool did not disclose which model
  version it used. Two of six outputs were chosen, upscaled and encoded for the site. The page captions the image as an
  illustration drawn by an image model. **The rights status of these images is unresolved**: it depends on the terms of
  the OpenAI product and plan used, which have not been recorded. This project makes no ownership claim over them.

## License texts

### three (MIT)

```
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### us-atlas (ISC)

```
Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

### topojson-client (ISC)

```
Copyright 2012-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```
