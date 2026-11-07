// The decoder ships without type declarations. This describes the part the application uses: decoding a HEIC or HEIF file into
// upright RGBA pixels, with the orientation already applied.
declare module "heic-decode" {
  export interface DecodedImage {
    readonly width: number;
    readonly height: number;
    /** RGBA, four bytes per pixel, row by row from the top left. */
    readonly data: Uint8ClampedArray;
  }

  export default function decode(options: {
    readonly buffer: ArrayBuffer | ArrayBufferView;
  }): Promise<DecodedImage>;
}
