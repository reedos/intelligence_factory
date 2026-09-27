# Hero image brief: The Intelligence Factory

The site is a public explainer of an AI data center campus (reedos.github.io/intelligence_factory). It needs one
hero image at the top of the home page, with a large headline set over it.

## Model

Use the highest-fidelity image model you have (GPT Image 2.5 or newer), at the highest quality setting.

## Reference

`C:\Users\reedo\projects\intelligence_factory\design\hero\reference-campus.png` is a render of the campus from the
site's own 3D engine. Use it as the layout and camera reference.

Keep from the reference:
- the camera angle, a high three-quarter aerial view
- the substation yard, with a 345 kV transmission line arriving from the left horizon
- two long data halls, lower right
- the generator yard beside the halls, the parking lot and the battery yard
- the farmland around the site

## Change

Make it a photorealistic, architecturally striking aerial photograph at blue hour:
- monolithic halls with ribbed pale-concrete and dark-glass facades, and rooftop dry coolers with faint warm lights
- a lit substation with steel gantries, and lattice towers carrying the line toward distant low hills
- service roads traced by thin amber lights, with a light haze over the site
- a deep indigo sky over a thin amber horizon
- physically accurate light and crisp detail

## Composition

Put the campus in the right two-thirds of the frame. Keep the left third calm, dark open ground or sky, because
the headline sits there.

## Deliver

Save everything to `C:\Users\reedo\projects\intelligence_factory\design\hero\incoming\`:
- four wide variants, 16:9 or 3:2, at the largest size the model offers: `hero-wide-1.png` to `hero-wide-4.png`
- two tall variants for phones, 9:16 or 2:3, with the campus in the upper half and dark ground below:
  `hero-tall-1.png` and `hero-tall-2.png`
- `notes.md`, with the model, the settings and the exact prompt you used

## Rules

- No text, logos, watermarks or brand names.
- No close-up people.
- Don't add buildings beyond what the reference shows.
- The site will caption it "Illustration".
- Don't edit anything else in the repo.
