import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
} from "@revenuecat/purchases-capacitor";

export const PRO_ENTITLEMENT_ID = "pro";
export const VERIFIED_BUSINESS_ENTITLEMENT_ID = "verified_business";

export const RC_PACKAGE_IDS = {
  monthly: "$rc_monthly",
  annual: "$rc_annual",
  lifetime: "$rc_lifetime",
} as const;

export type IAPPlan = keyof typeof RC_PACKAGE_IDS;

// Verified Business Listing tiers (Apple-compliant alternative to the Stripe
// flow used on web). Each tier is its own subscription product because Apple
// IAP doesn't support per-quantity recurring purchases.
//
// Package identifiers must match the packages configured in the RevenueCat
// "verified_business" offering.
export const VERIFIED_BUSINESS_TIERS = [
  { tier: 1,  packageId: "verified_business_1",  productId: "coldstreak_verified_business_1",  priceLabel: "$29.99/mo",   description: "1 location" },
  { tier: 3,  packageId: "verified_business_3",  productId: "coldstreak_verified_business_3",  priceLabel: "$79.99/mo",   description: "Up to 3 locations" },
  { tier: 10, packageId: "verified_business_10", productId: "coldstreak_verified_business_10", priceLabel: "$129.99/mo",  description: "Up to 10 locations" },
] as const;

export type VerifiedBusinessTier = typeof VERIFIED_BUSINESS_TIERS[number]["tier"];

export function isIOSNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function isNativePlatform(): boolean {
  return isIOSNative() || isAndroidNative();
}

let configured = false;
let configuredAppUserId: string | null = null;

export async function initIAP(appUserId: string | null): Promise<void> {
  if (!isNativePlatform()) return;

  const iosKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined;
  const androidKey = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined;

  const apiKey = isIOSNative() ? iosKey : androidKey;
  if (!apiKey) {
    console.warn("[iap] Missing RevenueCat API key for platform", Capacitor.getPlatform());
    return;
  }

  const userId = appUserId ? appUserId.toLowerCase() : null;

  if (configured && configuredAppUserId === userId) return;

  try {
    if (!configured) {
      if (import.meta.env.DEV) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      }
      await Purchases.configure({ apiKey, appUserID: userId ?? undefined });
      configured = true;
      configuredAppUserId = userId;
    } else if (userId && userId !== configuredAppUserId) {
      await Purchases.logIn({ appUserID: userId });
      configuredAppUserId = userId;
    }
  } catch (err) {
    console.error("[iap] configure failed", err);
  }
}

export async function logoutIAP(): Promise<void> {
  if (!isNativePlatform() || !configured) return;
  try {
    await Purchases.logOut();
    configuredAppUserId = null;
  } catch (err) {
    console.error("[iap] logout failed", err);
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isNativePlatform()) return null;
  try {
    const result = await Purchases.getOfferings();
    return result.current ?? null;
  } catch (err) {
    console.error("[iap] getOfferings failed", err);
    return null;
  }
}

export async function getPackagesByPlan(): Promise<Partial<Record<IAPPlan, PurchasesPackage>>> {
  const offering = await getCurrentOffering();
  if (!offering) return {};
  const out: Partial<Record<IAPPlan, PurchasesPackage>> = {};
  for (const pkg of offering.availablePackages) {
    if (pkg.identifier === RC_PACKAGE_IDS.monthly) out.monthly = pkg;
    else if (pkg.identifier === RC_PACKAGE_IDS.annual) out.annual = pkg;
    else if (pkg.identifier === RC_PACKAGE_IDS.lifetime) out.lifetime = pkg;
  }
  return out;
}

// The Verified Business Listing tiers live in their own RevenueCat offering
// (not the default `current` one which serves Pro). We pull it by name.
export async function getVerifiedBusinessOffering(): Promise<PurchasesOffering | null> {
  if (!isNativePlatform()) return null;
  try {
    const result = await Purchases.getOfferings();
    return result.all?.["verified_business"] ?? null;
  } catch (err) {
    console.error("[iap] getVerifiedBusinessOffering failed", err);
    return null;
  }
}

export async function getVerifiedBusinessPackages(): Promise<Partial<Record<VerifiedBusinessTier, PurchasesPackage>>> {
  const offering = await getVerifiedBusinessOffering();
  if (!offering) return {};
  const out: Partial<Record<VerifiedBusinessTier, PurchasesPackage>> = {};
  for (const pkg of offering.availablePackages) {
    const match = VERIFIED_BUSINESS_TIERS.find((t) => t.packageId === pkg.identifier);
    if (match) out[match.tier] = pkg;
  }
  return out;
}

export interface PurchaseOutcome {
  success: boolean;
  cancelled?: boolean;
  alreadyPurchased?: boolean;
  isPro?: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

export async function purchasePlan(plan: IAPPlan): Promise<PurchaseOutcome> {
  if (!isNativePlatform()) {
    return { success: false, error: "In-app purchases are only available in the iOS app." };
  }

  try {
    const packages = await getPackagesByPlan();
    const target = packages[plan];
    if (!target) {
      return { success: false, error: `${plan} plan is not available right now.` };
    }

    const result = await Purchases.purchasePackage({ aPackage: target });
    const isPro = !!result.customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
    return { success: true, isPro, customerInfo: result.customerInfo };
  } catch (err: any) {
    if (err?.userCancelled || err?.code === "PURCHASE_CANCELLED") {
      return { success: false, cancelled: true };
    }
    if (err?.code === "PRODUCT_ALREADY_PURCHASED") {
      try {
        const restored = await Purchases.restorePurchases();
        const isPro = !!restored.customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
        return { success: true, alreadyPurchased: true, isPro, customerInfo: restored.customerInfo };
      } catch (restoreErr: any) {
        return { success: false, error: restoreErr?.message ?? "Already purchased — please use Restore Purchases." };
      }
    }
    console.error("[iap] purchase failed", err);
    return { success: false, error: err?.message ?? "Purchase failed. Please try again." };
  }
}

export async function restorePurchasesIAP(): Promise<PurchaseOutcome> {
  if (!isNativePlatform()) {
    return { success: false, error: "Restore is only available in the iOS app." };
  }
  try {
    const result = await Purchases.restorePurchases();
    const isPro = !!result.customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
    return { success: true, isPro, customerInfo: result.customerInfo };
  } catch (err: any) {
    console.error("[iap] restore failed", err);
    return { success: false, error: err?.message ?? "Restore failed." };
  }
}

export interface VerifiedBusinessPurchaseOutcome {
  success: boolean;
  cancelled?: boolean;
  alreadyPurchased?: boolean;
  hasEntitlement?: boolean;
  tier?: VerifiedBusinessTier;
  productIdentifier?: string;
  customerInfo?: CustomerInfo;
  error?: string;
}

export async function purchaseVerifiedBusinessTier(tier: VerifiedBusinessTier): Promise<VerifiedBusinessPurchaseOutcome> {
  if (!isNativePlatform()) {
    return { success: false, error: "In-app purchases are only available in the iOS app." };
  }
  try {
    const packages = await getVerifiedBusinessPackages();
    const target = packages[tier];
    if (!target) {
      return { success: false, error: `The ${tier === 1 ? "single-location" : `${tier}-location`} tier isn't available right now.` };
    }
    const result = await Purchases.purchasePackage({ aPackage: target });
    const ent = result.customerInfo?.entitlements?.active?.[VERIFIED_BUSINESS_ENTITLEMENT_ID];
    return {
      success: true,
      hasEntitlement: !!ent,
      tier,
      productIdentifier: ent?.productIdentifier,
      customerInfo: result.customerInfo,
    };
  } catch (err: any) {
    if (err?.userCancelled || err?.code === "PURCHASE_CANCELLED") {
      return { success: false, cancelled: true };
    }
    if (err?.code === "PRODUCT_ALREADY_PURCHASED") {
      try {
        const restored = await Purchases.restorePurchases();
        const ent = restored.customerInfo?.entitlements?.active?.[VERIFIED_BUSINESS_ENTITLEMENT_ID];
        return { success: true, alreadyPurchased: true, hasEntitlement: !!ent, tier, productIdentifier: ent?.productIdentifier, customerInfo: restored.customerInfo };
      } catch (restoreErr: any) {
        return { success: false, error: restoreErr?.message ?? "Already purchased — please use Restore Purchases." };
      }
    }
    console.error("[iap] purchaseVerifiedBusinessTier failed", err);
    return { success: false, error: err?.message ?? "Purchase failed. Please try again." };
  }
}

export function tierFromVerifiedBusinessProductId(productId: string | null | undefined): VerifiedBusinessTier | null {
  const pid = (productId ?? "").toLowerCase();
  for (const t of VERIFIED_BUSINESS_TIERS) {
    if (pid === t.productId.toLowerCase()) return t.tier;
  }
  // Fallback for products that include the tier number anywhere in the id
  for (const t of VERIFIED_BUSINESS_TIERS) {
    if (pid.endsWith(`_${t.tier}`) || pid.includes(`business_${t.tier}`)) return t.tier;
  }
  return null;
}

export async function getCustomerInfoIAP(): Promise<CustomerInfo | null> {
  if (!isNativePlatform()) return null;
  try {
    const result = await Purchases.getCustomerInfo();
    return result.customerInfo;
  } catch (err) {
    console.error("[iap] getCustomerInfo failed", err);
    return null;
  }
}

export function activeProPlanFromCustomerInfo(info: CustomerInfo | null): IAPPlan | null {
  if (!info) return null;
  const ent = info.entitlements?.active?.[PRO_ENTITLEMENT_ID];
  if (!ent) return null;
  const period = ent.periodType;
  const productId = (ent.productIdentifier ?? "").toLowerCase();
  if (productId.includes("lifetime") || period === "LIFETIME") return "lifetime";
  if (productId.includes("annual") || productId.includes("yearly")) return "annual";
  return "monthly";
}

export async function syncIAPToServer(email: string): Promise<{ ok: boolean; isPro?: boolean; planType?: string }> {
  if (!isNativePlatform()) return { ok: false };
  try {
    const info = await getCustomerInfoIAP();
    if (!info) return { ok: false };

    const ent = info.entitlements?.active?.[PRO_ENTITLEMENT_ID];
    const planType = activeProPlanFromCustomerInfo(info);

    const res = await fetch("/api/revenuecat/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.toLowerCase(),
        appUserId: info.originalAppUserId,
        isPro: !!ent,
        planType,
        productIdentifier: ent?.productIdentifier ?? null,
        expirationDate: ent?.expirationDate ?? null,
        originalPurchaseDate: ent?.originalPurchaseDate ?? null,
      }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, isPro: !!data.isPro, planType: data.planType };
  } catch (err) {
    console.error("[iap] syncIAPToServer failed", err);
    return { ok: false };
  }
}
