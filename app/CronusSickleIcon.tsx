type CronusSickleIconProps = {
  size?: number;
  className?: string;
};

export function CronusSickleIcon({ size = 24, className = "" }: CronusSickleIconProps) {
  const classes = ["cronus-sickle-icon", className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="cronus-sickle-blade"
        d="M40 5.5C26.9 6.2 15.7 13.8 10.9 25.4 7.5 33.6 9.3 40 15.8 43.8c-2-5.5-1.2-10.9 2.2-16.1 5-7.7 12.6-12.3 22-13.5"
      />
      <path className="cronus-sickle-handle" d="m35.7 14.8-20.5 29" />
      <path className="cronus-sickle-binding" d="m29.5 23.6 6.2 4.2M12.8 41.8l5.1 3.5" />
    </svg>
  );
}
