"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bike, Building2, CreditCard, HandHeart, Loader2, Pencil, Receipt, ShoppingBag, Smartphone, UtensilsCrossed, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { VegDot } from "@/components/catalog/badges";
import { AddressPicker, CouponPicker, SchedulePicker, TipSelector } from "@/components/checkout/pickers";
import { CustomiseSheet } from "@/components/menu/customise-sheet";
import { QtyStepper } from "@/components/menu/qty-stepper";
import { BillBreakdown } from "@/components/orders/bill-breakdown";
import { usePayment } from "@/components/payments/use-payment";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodImage } from "@/components/shared/food-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getMenuItemForEdit } from "@/lib/catalog/actions";
import type { MenuItem } from "@/lib/catalog/menu-shared";
import { getCheckoutContext, getQuote, placeOrder } from "@/lib/checkout/actions";
import { cn, formatPaise } from "@/lib/utils";
import { useCart, useCartHydrated, type CartLine } from "./cart-store";
import { useCheckout, type PayMethod } from "./checkout-store";

const PAY_METHODS: { id: PayMethod; label: string; icon: typeof Smartphone; sub: string }[] = [
  { id: "upi", label: "UPI", icon: Smartphone, sub: "GPay, PhonePe, Paytm, BHIM" },
  { id: "card", label: "Credit / debit card", icon: CreditCard, sub: "Visa, Mastercard, RuPay" },
  { id: "netbanking", label: "Netbanking", icon: Building2, sub: "All major banks" },
  { id: "wallet_app", label: "Wallets", icon: Wallet, sub: "Paytm, Mobikwik, Amazon Pay" },
  { id: "cod", label: "Cash on delivery", icon: Bike, sub: "Pay the rider in cash or UPI" },
];

function Section({ title, icon: Icon, children, className }: { title?: string; icon?: typeof Receipt; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("space-y-3 p-4", className)}>
      {title ? (
        <h2 className="flex items-center gap-2 font-semibold">
          {Icon ? <Icon className="size-4 text-primary" /> : null} {title}
        </h2>
      ) : null}
      {children}
    </Card>
  );
}

export function CartView() {
  const router = useRouter();
  const hydrated = useCartHydrated();
  const cart = useCart();
  const co = useCheckout();
  const { pay, ui: paymentUi } = usePayment();
  const [placing, startPlacing] = useTransition();
  const [editing, setEditing] = useState<{ line: CartLine; item: MenuItem } | null>(null);
  const [placedId, setPlacedId] = useState<string | null>(null);

  const ctx = useQuery({ queryKey: ["checkout-context"], queryFn: () => getCheckoutContext(), enabled: hydrated });
  const addresses = useMemo(() => (ctx.data?.loggedIn ? ctx.data.addresses : []), [ctx.data]);

  // Default to the first saved address.
  useEffect(() => {
    if (!ctx.data?.loggedIn) return;
    if (!co.addressId || !addresses.some((a) => a.id === co.addressId)) co.set({ addressId: addresses[0]?.id ?? null });
  }, [ctx.data, addresses, co]);

  const quoteInput = useMemo(
    () =>
      cart.restaurant && cart.lines.length
        ? {
            restaurantId: cart.restaurant.id,
            lines: cart.lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, addonIds: l.addons.map((a) => a.id), qty: l.qty })),
            addressId: co.addressId,
            couponCode: co.couponCode,
            tipPaise: co.tipPaise,
            donationPaise: co.donationPaise,
            paymentMethod: co.paymentMethod,
            useWallet: co.useWallet,
            scheduledFor: co.scheduledFor,
          }
        : null,
    [cart.restaurant, cart.lines, co.addressId, co.couponCode, co.tipPaise, co.donationPaise, co.paymentMethod, co.useWallet, co.scheduledFor],
  );

  const quoteQ = useQuery({
    queryKey: ["quote", quoteInput],
    queryFn: async () => {
      const res = await getQuote(quoteInput!);
      if (!res.ok) throw new Error(res.error);
      return res.quote;
    },
    enabled: Boolean(quoteInput),
    placeholderData: (prev) => prev,
  });
  const quote = quoteQ.data;

  // Drop a coupon that no longer applies after cart changes (and tell the user once).
  const couponMsg = quote?.coupon.code && !quote.coupon.applied ? quote.coupon.message : null;
  useEffect(() => {
    if (couponMsg && co.couponCode) {
      toast.error(`${co.couponCode}: ${couponMsg}`);
      co.set({ couponCode: null });
    }
  }, [couponMsg, co]);

  if (!hydrated) return <Skeleton className="mx-auto h-96 max-w-4xl" />;
  if (placedId)
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground" role="status">
        <Loader2 className="size-8 animate-spin text-primary" /> Taking you to your order…
      </div>
    );
  if (!cart.lines.length || !cart.restaurant)
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add something delicious from a restaurant near you."
        action={
          <Button asChild>
            <Link href="/">Browse restaurants</Link>
          </Button>
        }
      />
    );

  const loggedIn = ctx.data?.loggedIn ?? false;
  const canPlace = loggedIn && quote?.ok && co.addressId && !quoteQ.isFetching && (quote.restaurantOpen || co.scheduledFor);

  async function edit(line: CartLine) {
    const item = await getMenuItemForEdit(line.itemId);
    if (!item) return void toast.error("This item is no longer available");
    setEditing({ line, item });
  }

  function place() {
    if (!quoteInput || !co.addressId) return;
    startPlacing(async () => {
      const res = await placeOrder({
        ...quoteInput,
        addressId: co.addressId!,
        cookingInstructions: co.cookingInstructions,
        noCutlery: co.noCutlery,
        deliveryInstructions: { avoidCalling: co.avoidCalling, leaveAtDoor: co.leaveAtDoor, directions: co.directions },
      });
      if (!res.ok) {
        toast.error(res.error);
        void quoteQ.refetch();
        return;
      }
      if (res.next === "pay") {
        const outcome = await pay(res.intent);
        if (!outcome.ok) {
          toast.error(outcome.error, { description: "Your cart is still here. You can try again." });
          return;
        }
      }
      setPlacedId(res.orderId);
      router.push(`/orders/${res.orderId}?placed=1`);
      cart.clear();
      co.resetForNewOrder();
    });
  }

  const payable = quote?.bill.payable_paise ?? 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 pb-28 lg:grid-cols-[1.4fr_1fr] lg:pb-0">
      <div className="space-y-4">
        <Section>
          <div className="flex items-center gap-3">
            <FoodImage src={cart.restaurant.image} alt="" name={cart.restaurant.name} sizes="48px" className="size-12 rounded-xl" emojiClassName="text-2xl" />
            <div>
              <h1 className="font-display text-xl font-bold">
                <Link href={`/restaurant/${cart.restaurant.slug}`} className="hover:underline">
                  {cart.restaurant.name}
                </Link>
              </h1>
              <p className="text-sm text-muted-foreground">
                {cart.restaurant.locality}
                {quote ? ` · ${co.scheduledFor ? "Scheduled" : `${quote.etaMinutes}–${quote.etaMinutes + 5} min`}` : ""}
              </p>
            </div>
          </div>
          <ul className="divide-y" aria-label="Items in your cart">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex items-start gap-3 py-3" data-testid="cart-line">
                <VegDot veg={l.isVeg} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.name}</p>
                  {l.variantName || l.addons.length ? <p className="text-xs text-muted-foreground">{[l.variantName, ...l.addons.map((a) => a.name)].filter(Boolean).join(", ")}</p> : null}
                  {l.variantName || l.addons.length ? (
                    <button type="button" onClick={() => edit(l)} className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
                      <Pencil className="size-3" /> Edit
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <QtyStepper qty={l.qty} size="sm" label={l.name} onInc={() => cart.setQty(l.key, l.qty + 1)} onDec={() => cart.setQty(l.key, l.qty - 1)} />
                  <span className="text-sm tabular-nums">{formatPaise(l.unitPrice * l.qty)}</span>
                </div>
              </li>
            ))}
            {quote?.lines.filter((l) => l.free).map((l) => (
              <li key={`free-${l.itemId}`} className="flex items-center gap-3 py-3 text-sm">
                <VegDot veg={l.isVeg} />
                <span className="flex-1">{l.name}</span>
                <span className="font-semibold text-success">FREE</span>
              </li>
            ))}
          </ul>
          <Link href={`/restaurant/${cart.restaurant.slug}`} className="text-sm font-semibold text-primary">
            + Add more items
          </Link>
          <Textarea
            value={co.cookingInstructions}
            onChange={(e) => co.set({ cookingInstructions: e.target.value.slice(0, 300) })}
            placeholder="Cooking instructions for the restaurant (e.g. less spicy, no onion)"
            aria-label="Cooking instructions"
            className="min-h-16"
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-muted-foreground" /> Don&apos;t send cutlery
            </span>
            <Switch checked={co.noCutlery} onCheckedChange={(v) => co.set({ noCutlery: v })} aria-label="Don't send cutlery" />
          </label>
        </Section>

        <Section>
          <CouponPicker
            coupons={quote?.coupons ?? []}
            applied={quote?.coupon.applied ? quote.coupon.code : null}
            message={quote?.coupon.message ?? null}
            loading={quoteQ.isFetching}
            onApply={(code) => co.set({ couponCode: code })}
            onRemove={() => co.set({ couponCode: null })}
          />
        </Section>

        <Section title="Delivery">
          {!loggedIn ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sign in to choose a delivery address and place your order.</p>
              <Button asChild className="w-full">
                <Link href="/login?next=/cart">Sign in to continue</Link>
              </Button>
            </div>
          ) : (
            <AddressPicker addresses={addresses} value={co.addressId} onChange={(id) => co.set({ addressId: id })} distanceKm={quote ? quote.distanceKm : null} />
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" aria-pressed={co.avoidCalling} onClick={() => co.set({ avoidCalling: !co.avoidCalling })} className={cn("rounded-full border bg-card px-3 py-1.5 text-sm", co.avoidCalling && "border-primary bg-secondary")}>
              Avoid calling
            </button>
            <button type="button" aria-pressed={co.leaveAtDoor} onClick={() => co.set({ leaveAtDoor: !co.leaveAtDoor })} className={cn("rounded-full border bg-card px-3 py-1.5 text-sm", co.leaveAtDoor && "border-primary bg-secondary")}>
              Leave at the door
            </button>
          </div>
          <Textarea value={co.directions} onChange={(e) => co.set({ directions: e.target.value.slice(0, 200) })} placeholder="Directions to reach (optional)" aria-label="Directions to reach" className="min-h-14" />
          <SchedulePicker value={co.scheduledFor} onChange={(v) => co.set({ scheduledFor: v })} restaurantOpen={quote?.restaurantOpen ?? true} />
        </Section>

        <Section title="Tip your delivery partner" icon={Bike}>
          <TipSelector value={co.tipPaise} onChange={(v) => co.set({ tipPaise: v })} />
        </Section>

        <Section>
          <label className="flex items-start justify-between gap-3">
            <span className="flex gap-2">
              <HandHeart className="mt-0.5 size-5 shrink-0 text-rose-500" />
              <span>
                <span className="block font-semibold">Donate to Feeding India</span>
                <span className="text-sm text-muted-foreground">Add {formatPaise(co.donationPaise || 300)} to help serve meals to people in need.</span>
              </span>
            </span>
            <Switch checked={co.donationPaise > 0} onCheckedChange={(v) => co.set({ donationPaise: v ? 300 : 0 })} aria-label="Donate to Feeding India" />
          </label>
          {co.donationPaise > 0 ? (
            <div className="flex gap-2">
              {[100, 200, 300, 500].map((p) => (
                <button key={p} type="button" onClick={() => co.set({ donationPaise: p })} className={cn("rounded-full border bg-card px-3 py-1 text-sm", co.donationPaise === p && "border-primary bg-secondary")}>
                  {formatPaise(p)}
                </button>
              ))}
            </div>
          ) : null}
        </Section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Section title="Bill details" icon={Receipt}>
          {quote ? (
            <div className={cn(quoteQ.isFetching && "opacity-60")}>
              <BillBreakdown bill={quote.bill} />
              {quote.bill.surge_fee_paise ? <p className="mt-2 text-xs text-muted-foreground">Includes a {formatPaise(quote.bill.surge_fee_paise)} surge fee (high demand).</p> : null}
              {quote.goldPartner && !quote.isGold ? (
                <Link href="/gold" className="mt-3 block rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  Gold members get free delivery and extra discounts here. Join Gold →
                </Link>
              ) : null}
            </div>
          ) : quoteQ.isError ? (
            <div className="space-y-2 text-sm">
              <p className="text-destructive">{(quoteQ.error as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => quoteQ.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
          )}
          {quote?.errors.length ? (
            <ul className="space-y-1 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {quote.errors.map((e) => (
                <li key={e} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {e}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="Pay with">
          {loggedIn && (quote?.walletBalancePaise ?? 0) > 0 ? (
            <label className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/40 p-3 text-sm">
              <span>
                <span className="block font-semibold">Use Thaali wallet</span>
                <span className="text-muted-foreground">Balance {formatPaise(quote?.walletBalancePaise ?? 0)}</span>
              </span>
              <Switch checked={co.useWallet} onCheckedChange={(v) => co.set({ useWallet: v })} aria-label="Use Thaali wallet" />
            </label>
          ) : null}
          <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
            {PAY_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={co.paymentMethod === m.id}
                onClick={() => co.set({ paymentMethod: m.id })}
                className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 text-left", co.paymentMethod === m.id && "border-primary bg-secondary/60")}
              >
                <m.icon className="size-5 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.sub}</span>
                </span>
                <span className={cn("size-4 rounded-full border-2", co.paymentMethod === m.id ? "border-[5px] border-primary" : "border-input")} />
              </button>
            ))}
          </div>
        </Section>

        <div className="fixed inset-x-0 bottom-[4.25rem] z-30 border-t bg-card p-3 md:bottom-0 lg:static lg:rounded-2xl lg:border">
          <Button size="lg" className="w-full" disabled={!canPlace || placing} onClick={place} data-testid="place-order">
            {placing ? <Loader2 className="animate-spin" /> : null}
            {!loggedIn
              ? "Sign in to place order"
              : !co.addressId
                ? "Add an address"
                : payable === 0 && quote
                  ? `Place order · paid by wallet`
                  : `${co.paymentMethod === "cod" ? "Place order" : "Pay"} ${quote ? formatPaise(payable) : ""}`}
          </Button>
        </div>
      </div>

      <CustomiseSheet
        item={editing?.item ?? null}
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ? { variantId: editing.line.variantId, addonIds: editing.line.addons.map((a) => a.id), qty: editing.line.qty } : undefined}
        vegOnly={false}
        submitLabel="Update item"
        onSubmit={(c) => {
          if (!editing) return;
          const it = editing.item;
          const addons = it.addon_groups.flatMap((g) => g.addons).filter((a) => c.addonIds.includes(a.id));
          const variant = it.item_variants.find((v) => v.id === c.variantId);
          cart.updateLine(editing.line.key, {
            itemId: it.id, name: it.name, isVeg: it.is_veg, imageUrl: it.image_url, variantId: variant?.id ?? null, variantName: variant?.name ?? null,
            addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price_paise })),
            unitPrice: (variant?.price_paise ?? it.price_paise) + addons.reduce((s, a) => s + a.price_paise, 0),
          });
          setEditing(null);
          toast.success("Item updated");
        }}
      />
      {paymentUi}
    </div>
  );
}
