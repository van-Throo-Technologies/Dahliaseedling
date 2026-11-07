# Photo formats: how each is handled

This note records what the photo pipeline supports, how each format is handled, and what was and was not tested. It is for the founder's review before any deployment.

## What is supported

| Format                            | Private capture                      | Preview                                                                                                                                 | Public copy                           |
| --------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| JPEG, PNG, WebP                   | yes, uploaded unchanged              | shown by the browser, straight after selection                                                                                          | yes, WebP built by `sharp`            |
| HEIC, HEIF (iPhone, some Android) | yes, uploaded unchanged              | the browser's own preview where it can show the photo; otherwise a plain message until saving, then the owner's preview from the server | yes, decoded on the server, then WebP |
| Video (MP4, MOV, WebM)            | yes                                  | the browser plays it                                                                                                                    | no, not in this build                 |
| Anything else                     | refused at selection, with a message | none                                                                                                                                    | none                                  |

A file with no declared type (some Android and Windows setups do this for HEIC) is identified from its name.

## Where each step happens

- **Publication** (the public copy) is converted on the server. The server controls the output: metadata removal, orientation, size and storage all happen in one place, under the grower's own session.
- **Before saving**, a HEIC or HEIF photo is previewed with the browser's own image display. If the browser cannot show it, the page says that the photo can be saved and that its preview appears after saving. No decoder runs in the browser.
- **The preview of a saved HEIC or HEIF photo** is made on the server, by an owner-only route, `/media/[id]/preview`. It uses the same pipeline as a public copy, so the preview is upright and free of metadata.
- **Nothing is decoded in the browser.** The browser does not load a decoder, so no WebAssembly is needed and the Content Security Policy is unchanged.

## The preview route

- The media row is read with the caller's own session. RLS decides who can see it, exactly as for the original.
- Anyone else, and anyone signed out, gets a 404, the same response as for a missing photograph.
- Only HEIC and HEIF photographs have this route. Other photographs keep their existing address.
- The response is a WebP with no metadata. It is cached only by the owner's own browser (`Cache-Control: private, no-cache`, with `Vary: Cookie`). The ETag comes from the stored path, so a repeat request is answered with a 304, and nothing is decoded again.
- Nothing is kept on the server, and no cache is shared between accounts.
- A photograph that cannot be decoded, or declares a size over the limit, gets a 422 and the page says "Preview not available in this browser". Saving and publishing are unaffected.

## Rules that protect the photographs

- **Originals stay private.** The uploaded file, including HEIC, is stored in the private bucket and is never made public. The public copy is a separate WebP.
- **Metadata is removed.** The copy and the preview are built from the pixels, with no EXIF, XMP or colour profile. A test checks that no EXIF or orientation tag survives.
- **Orientation is applied** before tags are dropped, so the copy and the preview are upright.
- **Size is checked before decoding.** The HEIF container's declared size is read first. A file that declares no size, or more than 50 megapixels, is refused before any large buffer is made.
- **The file size limit** of 15 MB for a photograph is enforced in the browser and in the database.
- **The `no-store` rule** for `/media/[id]` is kept. The preview route sets its own owner-only policy.

## Measurements

These were taken on a development machine with photograph-like test images, encoded as HEIC with macOS. Each size ran in its own process.

| Megapixels | HEIC file | Decode   | Public copy (sharp) | Peak memory |
| ---------- | --------- | -------- | ------------------- | ----------- |
| 12.2       | 4.2 MB    | 892 ms   | 157 ms              | 312 MB      |
| 24         | 4.0 MB    | 922 ms   | 145 ms              | 511 MB      |
| 48         | 7.9 MB    | 1,911 ms | 199 ms              | 556 MB      |

Peak memory includes the Node process. The decoded pixels match the source: a standard deviation of 30.4 against 30.5 for the 24-megapixel image.

The platform documents 2 GB of memory and a 300-second duration for Hobby functions, and a 4.5 MB body limit for function requests ([Vercel Functions limitations](https://vercel.com/docs/functions/limitations)). Uploads go directly to storage, so the body limit does not apply to publication or preview.

**The 50-megapixel limit** is provisional. It covers the current iPhone main camera (about 48.8 megapixels). The measured peak at 48 megapixels is 556 MB, well inside 2 GB. Before public launch, the production build must be measured on the deployment platform itself, at 48 megapixels and at the limit.

## Limits and what was not tested

- **No physical device was tested.** No iPhone, Android phone, Safari on iOS, or Chrome on Android was available. Desktop Chromium and macOS-generated HEIC files were used. See `docs/mobile-photo-device-checklist.md`.
- **Safari on iOS** is expected to show HEIC natively in the browser. The preview route does not depend on that.
- **Chrome on Android** is expected not to show HEIC, which is why the server preview exists. Android was not tested.
- **The platform measurement** at the limit is not done yet.
- **Licence.** The server decoder is `heic-decode` 2.1.0 (ISC), which wraps `libheif-js` (LGPL-3.0). It runs only on the server and is never sent to a browser. The server already uses libvips under LGPL-3.0-or-later through `sharp`. Counsel should confirm the server-side obligations before public launch, and the HEVC patent position.
- **Video** is not processed in this change.
