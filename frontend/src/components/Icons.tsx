export function Icon({ children, size=20, viewBox="0 0 24 24" }: { children: React.ReactNode; size?: number; viewBox?: string }) {
  return <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
export const BuildingIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M8 19h1M12 19h1M3 21h18"/></Icon>;
export const UsersIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>;
export const HomeIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/></Icon>;
export const SearchIcon = ({size=20}:{size?:number}) => <Icon size={size}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>;
export const PlusIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M12 5v14M5 12h14"/></Icon>;
export const EditIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></Icon>;
export const TrashIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></Icon>;
export const EyeIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></Icon>;
export const EyeOffIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.6 10.6 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-3.1 4.1M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.1-.8"/></Icon>;
export const MailIcon = ({size=20}:{size?:number}) => <Icon size={size}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Icon>;
export const LockIcon = ({size=20}:{size?:number}) => <Icon size={size}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></Icon>;
export const ShieldIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></Icon>;
export const MenuIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M4 6h16M4 12h16M4 18h16"/></Icon>;
export const BellIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Icon>;
export const ChevronIcon = ({size=16}:{size?:number}) => <Icon size={size}><path d="m6 9 6 6 6-6"/></Icon>;
export const LayoutIcon = ({size=20}:{size?:number}) => <Icon size={size}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/></Icon>;
export const WalletIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 14h.01"/></Icon>;
export const WrenchIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M14.7 6.3a4.9 4.9 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a4.9 4.9 0 0 0 6.4-6.4l-3.1 3.1-3-3Z"/></Icon>;
export const FileIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></Icon>;
export const SettingsIcon = ({size=20}:{size?:number}) => <Icon size={size}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2A2 2 0 0 0 5.8 16l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a2 2 0 0 0-1.4-3.4h-.2a2 2 0 0 1 0-4h.2A2 2 0 0 0 3 2.4l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A2 2 0 0 0 9.2 1V.8a2 2 0 0 1 4 0V1a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1A2 2 0 0 0 20.8 8h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.4 3Z"/></Icon>;