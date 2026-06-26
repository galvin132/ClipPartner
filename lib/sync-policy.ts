import { getRuntimeMode, type RuntimeMode } from "./providers/runtime.ts";

export function shouldLoadLocalStateBeforeRemoteSync(mode: RuntimeMode = getRuntimeMode()) {
  return mode !== "real";
}

export function canPersistLocalState(mode: RuntimeMode = getRuntimeMode()) {
  return mode !== "real";
}

export function canUseLocalMutationFallback(mode: RuntimeMode = getRuntimeMode()) {
  return mode !== "real";
}
