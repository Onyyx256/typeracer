import Image from "next/image";

type AvatarProps = {
  name: string;
  /** The profile photo (AUTH-04); without one, the initial on a coloured disc. */
  src?: string | null;
  className?: string;
};

/** Decorative: the name is always written next to it. */
export function Avatar({ name, src, className = "" }: AvatarProps) {
  if (src) {
    return (
      // Already a 256 px WebP, resized on upload, so Next has nothing to optimize.
      <Image
        src={src}
        alt=""
        width={256}
        height={256}
        unoptimized
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-accent font-display font-semibold text-on-accent uppercase ${className}`}
    >
      {name.charAt(0)}
    </span>
  );
}
