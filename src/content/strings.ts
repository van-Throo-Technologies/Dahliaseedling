/*
 * Application-facing copy, in one typed place.
 *
 * Components read text from here rather than hard-coding it, so a future translation layer
 * can replace this module without touching markup. Phase 0 ships English only.
 */
export const strings = {
  locale: "en",
  appName: "DahliaSeedling",
  description:
    "A community and continuation platform for genetically unique dahlias grown from seed.",
  home: {
    foundation: "Foundation in place.",
    note: "This page only proves that the app, the design tokens and the type load correctly.",
    statusAction: "Check app status",
  },
} as const;
