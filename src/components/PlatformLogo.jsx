function PlatformLogo({ className = "h-10 w-auto" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Platform Dashboard"
    >
      <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#platform-logo-gradient)" />
      <path
        d="M11 27V17.5L20 12l9 5.5V27"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M15 27v-6.5h10V27"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="16.2" r="1.6" fill="white" />
      <defs>
        <linearGradient id="platform-logo-gradient" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default PlatformLogo;
