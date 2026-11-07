# Mobile photo checklist: real devices

Use this list on real devices before any claim of Android or iPhone compatibility. Desktop Chromium and macOS-generated HEIC files are not evidence for a phone.

Record for each run: device model, operating system version, browser and version, the file's source (camera or gallery), its file size, and the result. Attach a screenshot for every failure.

## Prepare

1. Use a protected staging deployment, with an invited test account that is not the founder's. Do not create seedlings you do not intend to keep.
2. On iPhone, leave Settings, Camera, Formats on "High Efficiency" (HEIC), so the test covers real HEIC files. Repeat once on "Most Compatible" (JPEG).
3. On Android, note whether the camera saves HEIC or JPEG (in the camera settings, or by the file extension in the Gallery's details).

## iPhone, Safari

- [ ] Take a photograph with the camera from Capture. The preview shows the photograph, upright.
- [ ] Choose a HEIC photograph from the photo library. Note whether the browser shows the preview before saving. If it does not, the page says the preview appears after saving. Save it, then the owner sees the preview, upright.
- [ ] Choose a JPEG and a PNG from the library. Each previews upright.
- [ ] Save privately. The success message appears, and the observation shows the photograph.
- [ ] Share a HEIC photograph: make the seedling public, choose the photograph, publish. The Feed shows it, upright, from a public address.
- [ ] Check the public copy is WebP and that its address contains `public-media`, not `private-media`.
- [ ] Choose a video. The video is saved privately, and it is not offered for public sharing.
- [ ] Turn off the network, then try to save. The message says the photograph is not yet saved, and the photograph is still there to retry.
- [ ] Rotate the phone while previewing. The preview stays readable and nothing overflows horizontally.
- [ ] Do the same steps with a photograph over 15 MB. It is refused with a clear message.

## Android, Chrome

- [ ] Take a photograph with the camera. The preview shows it, upright.
- [ ] Choose a HEIC photograph from the gallery. Note whether its type is empty, octet-stream or image/heic. On Android Chrome the page should say that the photo can be saved and that its preview appears after saving. After saving, the owner's preview loads and is upright.
- [ ] Choose a JPEG, a PNG and a WebP. Each previews upright.
- [ ] Save privately. Then share one HEIC and one JPEG publicly. Both appear in the Feed.
- [ ] Choose a GIF. It is refused with a message that names the supported types.
- [ ] Check memory: open a 12-megapixel HEIC preview, then switch to another app and back. The page reloads cleanly or keeps its state.
- [ ] Repeat the photograph steps in Samsung Internet, if the grower will use it.

## Both platforms

- [ ] Metadata: the public copy has no location. Check by downloading the public copy from the Feed and inspecting it with a metadata tool.
- [ ] The private original keeps its own format. It is not visible from a public address.
- [ ] A visitor who is not signed in can read the public photograph, and cannot open the private original.
- [ ] Keyboard and screen reader: the preview and its status are announced, and the "Save privately" button is reachable.

## Record

| Device | System | Browser | Source | Format | Preview | Saved | Shared | Public copy upright | Notes |
| ------ | ------ | ------- | ------ | ------ | ------- | ----- | ------ | ------------------- | ----- |
|        |        |         |        |        |         |       |        |                     |       |
