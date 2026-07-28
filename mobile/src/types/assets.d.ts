/**
 * Metro resolves static image imports to an opaque asset reference, which the
 * <Image> `source` prop accepts directly.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}
