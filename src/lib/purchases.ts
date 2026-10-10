import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";

import { useAppStore } from "@/lib/store";

/**
 * RevenueCat: the single source of truth for Premium. The store's isPremium
 * flag mirrors the "premium" entitlement (persisted, so the app stays
 * unlocked offline) and is refreshed by the SDK listener on every change.
 *
 * The API key is public by design. A "test_" key targets RevenueCat's Test
 * Store (simulated purchases, for development); the "appl_" key from the
 * RevenueCat iOS app goes in for real App Store purchases.
 */

export const ENTITLEMENT = "premium";
export const SADAQA_PRODUCT_ID = "com.nmoussaoui.memoriq.sadaqa.year";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configured = false;

function applyCustomerInfo(info: CustomerInfo) {
  useAppStore.getState().setPremium(info.entitlements.active[ENTITLEMENT] !== undefined);
}

/** Configures the SDK once at launch (no-op on web or without a key). */
export function initPurchases(): void {
  if (configured || !apiKey || Platform.OS === "web") return;
  try {
    // RevenueCat logs a cancelled purchase at error level, which raises the
    // red dev overlay for an outcome the app handles normally: in dev, show
    // its warnings and errors as warnings, drop the debug chatter, and stay
    // silent in production.
    Purchases.setLogHandler((level, message) => {
      if (__DEV__ && (level === LOG_LEVEL.WARN || level === LOG_LEVEL.ERROR)) {
        console.warn(`[RevenueCat] ${message}`);
      }
    });
    Purchases.configure({ apiKey });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    configured = true;
  } catch {
    // Native module missing (a build made before RevenueCat was added):
    // purchases stay off and the paywall says offers are unavailable,
    // instead of the app failing at launch.
    return;
  }
  Purchases.getCustomerInfo().then(applyCustomerInfo).catch(() => {});
}

export function purchasesAvailable(): boolean {
  return configured;
}

/**
 * Ties purchases to the Supabase account, so Premium follows the learner to
 * another device; signing out returns to an anonymous RevenueCat user.
 */
export async function linkPurchasesUser(userId: string | null): Promise<void> {
  if (!configured) return;
  try {
    if (userId) {
      const { customerInfo } = await Purchases.logIn(userId);
      applyCustomerInfo(customerInfo);
    } else if (!(await Purchases.isAnonymous())) {
      applyCustomerInfo(await Purchases.logOut());
    }
  } catch {
    // Linking retries on the next auth change; purchases still work.
  }
}

export type PaywallPackages = { monthly: PurchasesPackage | null; annual: PurchasesPackage | null };

/** The monthly and annual packages of the current offering. */
export async function loadPackages(): Promise<PaywallPackages> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  return { monthly: current?.monthly ?? null, annual: current?.annual ?? null };
}

/** The one-year gift product (a consumable, so it can be bought again). */
export async function loadSadaqaProduct(): Promise<PurchasesStoreProduct | null> {
  const [product] = await Purchases.getProducts(
    [SADAQA_PRODUCT_ID],
    PRODUCT_CATEGORY.NON_SUBSCRIPTION
  );
  return product ?? null;
}

function isCancelled(error: unknown): boolean {
  return (error as PurchasesError | undefined)?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

/**
 * Buys a subscription package. Resolves true when Premium is now active,
 * false when the learner cancelled; throws on a real failure.
 */
export async function buyPackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return customerInfo.entitlements.active[ENTITLEMENT] !== undefined;
  } catch (error) {
    if (isCancelled(error)) return false;
    throw error;
  }
}

/** Buys the Sadaqa gift. Resolves true once paid, false when cancelled. */
export async function buySadaqa(product: PurchasesStoreProduct): Promise<boolean> {
  try {
    await Purchases.purchaseStoreProduct(product);
    return true;
  } catch (error) {
    if (isCancelled(error)) return false;
    throw error;
  }
}

/** Restores previous purchases (required by Apple). True if Premium is back. */
export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  applyCustomerInfo(info);
  return info.entitlements.active[ENTITLEMENT] !== undefined;
}

/** Opens the system screen to change or cancel the subscription. */
export async function manageSubscription(): Promise<void> {
  await Purchases.showManageSubscriptions();
}
