# Local Chinese display fonts

Noto Serif SC, copyright the Noto Project Authors, distributed under the SIL Open Font License 1.1. The complete license is in `OFL.txt` beside these files.

These WOFF2 files are subsets of the official Noto Serif SC v36 fonts delivered by Google Fonts. They are hosted locally: visiting the game makes no requests to Google Fonts or another font provider.

- `noto-serif-sc-story.woff2`: regular weight, 1,118 Unicode characters occurring in the initial chapter UI, authored narrative, and narrative design document. Live text outside this set uses the platform's Chinese serif fallback.
- `noto-serif-sc-title.woff2`: medium weight, only the cover title `天台十句。`.

Original authoritative sources:

- Regular: `https://fonts.gstatic.com/s/notoserifsc/v36/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7SCqyWv.ttf`
- Medium: `https://fonts.gstatic.com/s/notoserifsc/v36/H4cyBXePl9DZ0Xe7gG9cyOj7uK2-n-D2rd4FY7SwqyWv.ttf`
- License: `https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt`

Reproduction: FontTools 4.60.1, Brotli 1.2.0, `pyftsubset --flavor=woff2 --layout-features='*' --name-IDs='*' --name-languages='*'`. Supply the deduplicated code points from `src/App.vue`, `src/domain.ts`, `../server/narrative.go`, and `../../docs/v2/NARRATIVE.md` as `--unicodes` for the story face; use `--text='天台十句。'` for the title. The subset does not rename the font family; use and redistribution remain covered by the bundled OFL.
