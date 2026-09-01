import React from 'react';

type Props = React.SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: Props) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function UndoIcon(props: Props) {
  return <Svg {...props}><path d="M3 8h11a5 5 0 0 1 0 10H8" /><path d="M7 4 3 8l4 4" /></Svg>;
}

export function ChevronDownIcon(props: Props) {
  return <Svg strokeWidth={2.4} {...props}><path d="M6 9l6 6 6-6" /></Svg>;
}

export function ChevronRightIcon(props: Props) {
  return <Svg strokeWidth={2.4} {...props}><path d="M9 18l6-6-6-6" /></Svg>;
}

export function ChevronLeftIcon(props: Props) {
  return <Svg strokeWidth={2.4} {...props}><path d="M15 18l-6-6 6-6" /></Svg>;
}

export function CloseIcon(props: Props) {
  return <Svg strokeWidth={2.2} {...props}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

export function MoreIcon({ size = 18, ...rest }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

export function SlidersIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Svg>
  );
}

export function SignOutIcon(props: Props) {
  return <Svg {...props}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M9 8l-4 4 4 4M5 12h9" /></Svg>;
}

export function DownloadIcon(props: Props) {
  return <Svg {...props}><path d="M12 3v12M7 11l5 4 5-4M4 19h16" /></Svg>;
}

export function UploadIcon(props: Props) {
  return <Svg {...props}><path d="M12 15V3M7 7l5-4 5 4M4 19h16" /></Svg>;
}

export function ArchiveIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </Svg>
  );
}

export function ArchiveRestoreIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v11a2 2 0 0 0 2 2h5" />
      <path d="M20 9v4" />
      <path d="M12 12v9" />
      <path d="m9 18 3-3 3 3" />
    </Svg>
  );
}

export function PauseIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </Svg>
  );
}

export function TrashIcon(props: Props) {
  return <Svg {...props}><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" /></Svg>;
}

export function CopyIcon(props: Props) {
  return <Svg {...props}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Svg>;
}

export function BellIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function ExpandAllIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 7l4-4 4 4M8 17l4 4 4-4" />
    </Svg>
  );
}

export function CollapseAllIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 4l4 4 4-4M8 20l4-4 4 4" />
    </Svg>
  );
}

export function CarouselIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="6" y="5" width="12" height="14" rx="2" />
      <path d="M3 8v8M21 8v8" />
    </Svg>
  );
}

export function GridIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function CheckIcon(props: Props) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="M5 12l5 5L20 7" />
    </Svg>
  );
}

export function ListIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </Svg>
  );
}

export function PivotIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 8h16M8 4v16" />
      <rect x="8" y="8" width="12" height="12" rx="1" />
    </Svg>
  );
}

export function RoomyIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h10M7 14h6" />
    </Svg>
  );
}

export function CompactIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="4" rx="1" />
      <rect x="4" y="10" width="16" height="4" rx="1" />
      <rect x="4" y="16" width="16" height="4" rx="1" />
    </Svg>
  );
}

export function MonthColumnsIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="5" height="14" rx="1" />
      <rect x="10" y="5" width="5" height="14" rx="1" />
      <rect x="17" y="5" width="5" height="14" rx="1" />
    </Svg>
  );
}

export function FutureMonthsIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4M12 14h4" />
    </Svg>
  );
}

export function HideFutureIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </Svg>
  );
}

export function PencilIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </Svg>
  );
}

export function CloudIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M7 18h10a4 4 0 0 0 .5-7.97 5.5 5.5 0 0 0-10.6-1.7A4.5 4.5 0 0 0 7 18z" />
    </Svg>
  );
}

export function LockIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function UnlockIcon(props: Props) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.65-2.55" />
    </Svg>
  );
}

export function WarningIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.2v.1" />
    </Svg>
  );
}
