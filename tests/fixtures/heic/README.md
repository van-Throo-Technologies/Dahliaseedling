# HEIC test fixtures

Generated with macOS `sips` (Apple's HEIC encoder) from synthetic images. They contain no photograph and no location data.

- `portrait-rotated.heic`: a 400 × 200 image with an orientation of 6 (a quarter turn). Upright it is 200 × 400, with red on the top half and blue on the bottom half.
- `landscape-phone.heic`: a flat 4032 × 3024 image, the size of a 12-megapixel phone photograph.

These fixtures do not prove compatibility with any phone. They prove that the decoder and the publishing path handle an Apple-encoded HEIC file. Real device testing is a separate step.
