// SF Symbols 느낌의 얇은 라인 아이콘. 전부 currentColor 를 따릅니다.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function Check({ size = 16, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.4} {...rest}>
      <path d="M4.5 12.6 9.4 17.5 19.5 7" />
    </svg>
  )
}

export function ChevronLeft({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  )
}

export function ChevronRight({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function ArrowDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 4.5v15M5.5 13l6.5 6.5L18.5 13" />
    </svg>
  )
}

export function Teleport({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 3.5v6M12 20.5v-3" />
      <path d="M4.6 7.8 12 11.6l7.4-3.8L12 4z" />
      <path d="M4.6 12.4 12 16.2l7.4-3.8" />
    </svg>
  )
}

export function Discord({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.63 5.4A17.4 17.4 0 0 0 15.4 4.1a12.4 12.4 0 0 0-.55 1.13 16.1 16.1 0 0 0-4.72 0A11.7 11.7 0 0 0 9.58 4.1 17.5 17.5 0 0 0 5.35 5.4C2.67 9.36 1.95 13.22 2.31 17.02a17.6 17.6 0 0 0 5.3 2.67c.43-.58.81-1.2 1.13-1.85a11.4 11.4 0 0 1-1.78-.85l.44-.34a12.6 12.6 0 0 0 10.7 0l.44.34c-.57.33-1.16.62-1.78.86.33.64.71 1.26 1.13 1.84a17.5 17.5 0 0 0 5.31-2.67c.42-4.4-.72-8.23-3.57-11.62ZM9.35 14.7c-1.05 0-1.92-.96-1.92-2.13s.85-2.14 1.92-2.14 1.94.96 1.92 2.14c0 1.17-.85 2.13-1.92 2.13Zm5.3 0c-1.05 0-1.91-.96-1.91-2.13s.84-2.14 1.91-2.14 1.94.96 1.92 2.14c0 1.17-.84 2.13-1.92 2.13Z" />
    </svg>
  )
}

export function Link({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M10 13.5a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 1 0-5.66-5.66l-1.3 1.3" />
      <path d="M14 10.5a4 4 0 0 0-5.66 0L5.5 13.33a4 4 0 0 0 5.66 5.66l1.3-1.3" />
    </svg>
  )
}

export function Vote({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M4 14.5 12 4l3.5 3.5L7.5 18H4z" />
      <path d="M3 21h18" />
    </svg>
  )
}

export function Close({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function Expand({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2}>
      <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
    </svg>
  )
}

export function Photo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={1.4}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 4.5-4.5L13 17M13 15l3-3 4 4" />
    </svg>
  )
}

export function Video({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={1.4}>
      <rect x="2" y="5.5" width="15" height="13" rx="2.5" />
      <path d="M17 9.5l5-2.5v10l-5-2.5" />
    </svg>
  )
}

export function PlayCircle({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={1.6}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M10 8.5l6 3.5-6 3.5z" strokeWidth={1.4} fill="currentColor" stroke="none" />
    </svg>
  )
}
