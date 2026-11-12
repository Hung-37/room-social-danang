type Name =
  | 'search'
  | 'pin'
  | 'arrow'
  | 'bookmark'
  | 'heart'
  | 'message'
  | 'check'
  | 'close'
  | 'filter'
  | 'home'
  | 'share';
const paths: Record<Name, string> = {
  search: 'm21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  message: 'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4ZM8 10h8m-8 4h5',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  filter: 'M4 7h16M7 12h10M10 17h4',
  home: 'm3 11 9-8 9 8v10h-6v-7H9v7H3V11Z',
  share: 'M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8'
};
export default function Icon({ name, className = '' }: { name: Name; className?: string }) {
  return (
    <svg
      className={`ui-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
