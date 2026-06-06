'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { IconMoon, IconGrid, IconChat, IconSettings, IconBook } from '@/components/icons';

const navItems = [
  {
    href: '/chat',
    label: '会话',
    Icon: IconChat,
  },
  {
    href: '/',
    label: '生成',
    Icon: IconMoon,
  },
  {
    href: '/presets',
    label: '预设库',
    Icon: IconGrid,
  },
  {
    href: '/instructions',
    label: '指令库',
    Icon: IconBook,
  },
  {
    href: '/settings',
    label: '设置',
    Icon: IconSettings,
  },
];

export default function Nav() {
  const pathname = usePathname();

  // Don't show nav on detail pages (they have their own back button) or chat page (has its own input bar)
  const isDetailPage = pathname.match(/^\/presets\/[^/]+$/) || pathname.match(/^\/instructions\/[^/]+$/);
  const isChatPage = pathname.startsWith('/chat');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 lg:w-52 bg-card border-r border-border flex-col z-40">
        <div className="p-4 lg:px-5 lg:py-6">
          <h1 className="hidden lg:block text-lg font-semibold text-primary">JAI Assistant</h1>
          <span className="lg:hidden text-primary font-bold text-xl">J</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-2 lg:px-3 py-2">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <item.Icon className={cn('w-5 h-5', isActive && 'stroke-[2]')} />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      {!isDetailPage && !isChatPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50">
          <div className="flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-lg transition-all min-w-[48px] min-h-[44px] justify-center',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <item.Icon className={cn('w-5 h-5', isActive && 'stroke-[2]')} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
