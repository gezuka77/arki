const paths = {
  cat: (
    <>
      <path d="M4 10V3l5 4h6l5-4v7c4 12-20 12-16 0Z" />
      <path d="M8 12h.01M16 12h.01M10 16h4" />
    </>
  ),
  transport: (
    <>
      <path d="m4 9 2-6h12l2 6v11h-3v-3H7v3H4V9Zm0 0h16M7 13h1m8 0h1" />
    </>
  ),
  health: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />,
  leisure: (
    <>
      <path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />
    </>
  ),
  gift: (
    <>
      <path d="M3 9h18v4H3V9Zm2 4v8h14v-8M12 9v12" />
      <path d="M12 9C1 9 5-1 12 9c7-10 11 0 0 0Z" />
    </>
  ),
  home: <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" />,
  education: (
    <>
      <path d="m2 8 10-5 10 5-10 5-10-5Zm4 3v7l6 3 6-3v-7M22 8v10" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  map: (
    <>
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" />
      <path d="M9 3v16m6-14v16" />
    </>
  ),
  basket: (
    <>
      <path d="m8 9 4-6 4 6M3 9h18l-2 11H5L3 9Z" />
      <path d="M9 13v3m6-3v3" />
    </>
  ),
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2-3-2Z" />
      <path d="M9 9h6m-6 4h6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-7" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  grocery: (
    <>
      <path d="M12 8c-6-4-11 2-7 9 2 4 4 4 7 3 3 1 5 1 7-3 4-7-1-13-7-9Z" />
      <path d="M12 8V5m0 0c1-3 4-3 5-2-1 3-3 3-5 2Z" />
    </>
  ),
  nonFood: (
    <>
      <path d="M9 3h6v4l3 4v10H6V11l3-4V3Z" />
      <path d="M9 7h6M6 13h12m-9 4h6" />
    </>
  ),
  restaurant: (
    <>
      <path d="M5 3v7m3-7v7M2 3v5a3 3 0 0 0 6 0M5 11v10M19 3c-4 3-5 6-5 9h5m0-9v18" />
    </>
  ),
  cafeteria: (
    <>
      <path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm12 1h2a3 3 0 1 1 0 6h-2M7 3v2m5-2v2" />
    </>
  ),
  clothing: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z" />,
  dog: (
    <>
      <ellipse cx="5" cy="10" rx="2" ry="3" />
      <ellipse cx="10" cy="5" rx="2" ry="3" />
      <ellipse cx="16" cy="6" rx="2" ry="3" />
      <ellipse cx="20" cy="12" rx="2" ry="3" />
      <path d="M7 18c0-3 3-7 5-7s6 5 6 8c0 4-4 1-6 1s-5 2-5-2Z" />
    </>
  ),
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />,
  check: <path d="m5 12 4 4L19 6" />,
};
export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name === "dining" ? "restaurant" : name] || paths.receipt}
    </svg>
  );
}
