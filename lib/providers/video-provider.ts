import { getRuntimeMode, type RuntimeMode } from "./runtime.ts";

export type ClipTaskInput = {
  recordingTitle: string;
  ipName: string;
  sourcePlatform: string;
};

export type VideoProvider = {
  createClipTask: (input: ClipTaskInput) => Promise<{ taskId: string }>;
  completeClipTask: (taskId: string) => Promise<{ outputCount: number }>;
  createDownloadToken: (claimId: string) => Promise<{ token: string; expiresAt: string }>;
};

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createMockVideoProvider(): VideoProvider {
  return {
    async createClipTask(input) {
      return {
        taskId: `mock-clip-${slug(input.recordingTitle)}-${slug(input.ipName)}-${slug(input.sourcePlatform)}`
      };
    },
    async completeClipTask() {
      return { outputCount: 3 };
    },
    async createDownloadToken(claimId) {
      return {
        token: `mock-download-${claimId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    }
  };
}

export function createLocalVideoProvider(): VideoProvider {
  return {
    async createClipTask(input) {
      return {
        taskId: `local-clip-${slug(input.recordingTitle)}-${slug(input.ipName)}-${slug(input.sourcePlatform)}`
      };
    },
    async completeClipTask() {
      return { outputCount: 3 };
    },
    async createDownloadToken(claimId) {
      return {
        token: `local-download-${claimId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    }
  };
}

export function createVideoProvider(mode: RuntimeMode = getRuntimeMode()): VideoProvider {
  return mode === "real" ? createLocalVideoProvider() : createMockVideoProvider();
}

export const videoProvider = createVideoProvider();
