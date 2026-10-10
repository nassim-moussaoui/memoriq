import { LogBox, Platform } from "react-native";
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
  if (__DEV__) {
    // Benign: after a Fast Refresh the native side still emits log events
    // for a moment while the JS listener is being re-registered.
    LogBox.ignoreLogs(["Sending `Purchases-LogHandlerEvent` with no listeners registered"]);
  }
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
 * What a subscription purchase led to. "unlocked" is the normal case;
 * "notEntitled" means Apple charged but RevenueCat granted no "premium"
 * entitlement (the product is not attached to it in the dashboard), which
 * must never end in silence.
 */
export type PurchaseOutcome = "unlocked" | "cancelled" | "notEntitled";

/** Buys a subscription package; throws on a real failure. */
export async function buyPackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    if (customerInfo.entitlements.active[ENTITLEMENT] !== undefined) return "unlocked";
    if (__DEV__) {
      console.warn(
        `[purchases] bought "${productIdentifier}" but "${ENTITLEMENT}" is not active. ` +
          `Active entitlements: [${Object.keys(customerInfo.entitlements.active).join(", ")}]. ` +
          `Attach this product to the "${ENTITLEMENT}" entitlement in RevenueCat, then restore.`
      );
    }
    return "notEntitled";
  } catch (error) {
    if (isCancelled(error)) return "cancelled";
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
