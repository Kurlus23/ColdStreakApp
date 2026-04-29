import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
} from "@revenuecat/purchases-capacitor";

export const PRO_ENTITLEMENT_ID = "pro";

export const RC_PACKAGE_IDS = {
  monthly: "$rc_monthly",
  annual: "$rc_annual",
  lifetime: "$rc_lifetime",
} as const;

export type IAPPlan = keyof typeof RC_PACKAGE_IDS;

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
