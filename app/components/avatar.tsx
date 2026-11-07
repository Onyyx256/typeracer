type AvatarProps = {
  name: string;
  className?: string;
};

/** The user's initial on a colored disc, until profile photos exist (AUTH-04). */
export function Avatar({ name, className = "" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-accent font-display font-semibold text-on-accent uppercase ${className}`}
    >
      {name.charAt(0)}
    </span>
  );
}
