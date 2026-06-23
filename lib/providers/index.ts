import { createAuthProvider, type AuthProviderAdapter, type SessionStorageLike } from "./auth-provider.ts";
import { createPaymentProvider, type PaymentProvider } from "./payment-provider.ts";
import { createPlatformDataProvider, type PlatformDataProvider } from "./platform-data-provider.ts";
import { getRuntimeMode, type RuntimeMode } from "./runtime.ts";
import { createVideoProvider, type VideoProvider } from "./video-provider.ts";

export type ProviderAdapters = {
  auth: AuthProviderAdapter;
  platformData: PlatformDataProvider;
  video: VideoProvider;
  payment: PaymentProvider;
};

export function createProviderAdapters(
  mode: RuntimeMode = getRuntimeMode(),
  storage?: SessionStorageLike | null
): ProviderAdapters {
  return {
    auth: createAuthProvider(mode, storage),
    platformData: createPlatformDataProvider(mode),
    video: createVideoProvider(mode),
    payment: createPaymentProvider(mode)
  };
}

export const providers = createProviderAdapters();
