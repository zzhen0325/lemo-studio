"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  User as UserIcon,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import SplitText from "@/components/ui/split-text";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AuthDialog } from "./auth/AuthDialog";
import { UserProfileDialog } from "./auth/UserProfileDialog";
import { userStore } from "@/lib/store/user-store";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { STUDIO_NAV_ITEMS, STUDIO_ROUTES } from "../_lib/navigation";

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const StudioSidebar = observer(function StudioSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const { setViewMode } = usePlaygroundStore();
  const prefetchRoute = useCallback((href: string) => {
    void router.prefetch(href);
  }, [router]);
  const navigateToTab = useCallback((href: string) => {
    if (href === STUDIO_ROUTES.playground) {
      setViewMode("home");
    }
    router.push(href);
  }, [router, setViewMode]);
  const currentUser = hasHydrated ? userStore.currentUser : null;

  useEffect(() => {
    setHasHydrated(true);
    void userStore.init();
  }, []);

  return (
    <header className="fixed top-2 px-10 left-0 right-0 h-14 z-50 flex items-center justify-between select-none">
      <div
        className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => {
          navigateToTab(STUDIO_ROUTES.playground);
        }}
      >
        <span className="text-white font-bold text-lg">LEMO STUDIO</span>
      </div>

      <nav className="flex items-center mx-auto space-x-1">
        {STUDIO_NAV_ITEMS.map((item) => {
          const isActive = isActivePath(pathname, item.href);

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => navigateToTab(item.href)}
              onMouseEnter={() => prefetchRoute(item.href)}
              onFocus={() => prefetchRoute(item.href)}
              className={cn(
                "px-4 h-10 flex items-center gap-2 transition-all relative group text-sm whitespace-nowrap",
                isActive ? "text-white font-medium" : "text-white/60 hover:text-white"
              )}
            >
              {/* <Icon className="w-4 h-4 opacity-80" /> */}
              <SplitText
                text={item.label}
                className="text-sm"
                delay={30}
                duration={0.5}
                animateOnHover
                tag="span"
              />
              {isActive ? (
                <span className="absolute bottom-1 left-4 right-4 h-[1px] bg-white/20 rounded-full" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center">
        {currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10 outline-none"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center overflow-hidden">
                  {currentUser.avatar ? (
                    <Image
                      src={currentUser.avatar}
                      alt={currentUser.name || 'User'}
                      width={20}
                      height={20}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-white">
                      {(currentUser.name || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs text-white/80">{currentUser.name || 'User'}</span>
                <ChevronDown className="w-3 h-3 text-white/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-black/90 border-white/10 backdrop-blur-xl text-white">
              <div className="px-2 py-1.5 text-xs text-white/50 font-medium">
                Signed in as <br />
                <span className="text-white font-bold truncate block">{currentUser.name || 'User'}</span>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />

              <DropdownMenuItem
                onClick={() => setProfileOpen(true)}
                className="cursor-pointer focus:bg-white/10 focus:text-white"
              >
                <UserIcon className="w-4 h-4 mr-2" />
                <span>Profile Settings</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-white/10" />

              <DropdownMenuItem
                onClick={() => userStore.logout()}
                className="cursor-pointer focus:bg-white/10 focus:text-red-400 text-red-400"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            onClick={() => setAuthOpen(true)}
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            Sign In
          </Button>
        )}
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
});
