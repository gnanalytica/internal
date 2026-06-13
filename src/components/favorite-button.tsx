"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/lib/actions";
import type { FavoriteKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  kind,
  targetId,
  initial,
}: {
  kind: FavoriteKind;
  targetId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !fav;
    setFav(next); // optimistic
    startTransition(async () => {
      const result = await toggleFavorite(kind, targetId);
      setFav(result);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={toggle}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      title={fav ? "Favorited" : "Add to favorites"}
    >
      <Star
        className={cn(
          "size-4",
          fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
