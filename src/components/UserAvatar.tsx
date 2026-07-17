function getInitials(email: string): string {
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/).filter(Boolean)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function UserAvatar({ email, className = 'w-8 h-8 text-xs' }: { email: string; className?: string }) {
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white`}
      style={{ background: 'linear-gradient(135deg, #0e6a95, #052f43)' }}
    >
      {getInitials(email)}
    </div>
  )
}
