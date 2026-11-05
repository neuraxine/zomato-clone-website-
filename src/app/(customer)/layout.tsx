import { UserRound } from "lucide-react";
import Link from "next/link";
import { CartBar } from "@/components/cart/cart-bar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TopNav } from "@/components/layout/top-nav";
import { LocationButton } from "@/components/location/location-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Logo } from "@/components/shared/logo";
import { getSessionUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [prefs, user] = await Promise.all([getPreferences(), getSessionUser()]);
  let saved: { id: string; label: string; custom_label: string | null; line1: string; flat: string | null; area: string | null; lat: number; lng: number }[] = [];
  if (user) {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase
      .from("addresses")
      .select("id, label, custom_label, line1, flat, area, lat, lng")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    saved = data ?? [];
  }
  const initials = (user?.profile.name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col" data-app="customer">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Logo className="hidden md:flex" />
          <LocationButton
            label={prefs.location.label}
            line={prefs.location.line}
            lat={prefs.location.lat}
            lng={prefs.location.lng}
            saved={saved}
          />
          <div className="ml-auto flex items-center gap-2">
            <TopNav app="customer" />
            {user ? <NotificationBell userId={user.id} pushEnabled={Boolean((user.profile.notification_prefs as { push?: boolean } | null)?.push)} /> : null}
            {user ? (
              <Link
                href="/account"
                aria-label="Your account"
                className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground md:hidden"
              >
                {initials || <UserRound className="size-5" aria-hidden />}
              </Link>
            ) : (
              <Link href="/login" className="rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-10">
        {children}
      </main>
      <CartBar />
      <BottomTabBar app="customer" />
    </div>
  );
}
