import Image, { type ImageProps } from "next/image";

/**
 * next/image wrapper. Remote Supabase images are resized/optimised by Next; the dev/test local-storage URLs
 * (relative /api/files/…) are served as-is.
 */
export function SiteImage({ src, alt, ...props }: Omit<ImageProps, "src" | "alt"> & { src: string; alt: string }) {
  return <Image src={src} alt={alt} unoptimized={src.startsWith("/")} {...props} />;
}
