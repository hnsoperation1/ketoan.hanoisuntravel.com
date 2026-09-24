function getInitials(value: string): string {
  const name = value.includes('@') ? value.split('@')[0] : value.trim()
  const parts = name.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({ email, name, avatarUrl, className = 'w-8 h-8 text-xs' }: { email: string; name?: string | null; avatarUrl?: string | null; className?: string }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name || email} className={`${className} rounded-full object-cover flex-shrink-0`} />
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white`}
      style={{ background: 'linear-gradient(135deg, #0e6a95, #052f43)' }}
    >
      {getInitials(name || email)}
    </div>
  )
}
