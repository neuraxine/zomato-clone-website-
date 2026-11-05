"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavourite } from "@/lib/catalog/actions";
import { cn } from "@/lib/utils";

export function FavouriteButton({ restaurantId, name, initial, className }: { restaurantId: string; name: string; initial: boolean; className?: string }) {
  const [fav, setFav] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !fav;
        setFav(next); // optimistic
        start(async () => {
          const res = await toggleFavourite(restaurantId);
          if (!res.ok) {
            setFav(!next);
            if (res.error === "login") {
              toast("Sign in to save favourites");
              router.push(`/login?next=${encodeURIComponent(pathname)}`);
            } else toast.error(res.error);
            return;
          }
          toast.success(res.favourite ? `Added ${name} to favourites` : `Removed from favourites`);
        });
      }}
      className={cn("flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50 focus-visible:ring-2 focus-visible:ring-white", className)}
    >
      <Heart className={cn("size-5", fav && "fill-rose-500 text-rose-500")} aria-hidden />
    </button>
  );
}
