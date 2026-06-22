"use client";

import { useEffect } from "react";
import { getDeviceContext, reportClientIssue } from "@/lib/client-observability";

export function ClientObservability() {
  useEffect(() => {
    let mounted = true;

    void getDeviceContext().then((device) => {
      if (!mounted) return;

      if (!window.sessionStorage.getItem("clip-partner-device-observed")) {
        window.sessionStorage.setItem("clip-partner-device-observed", "1");
        void reportClientIssue("app_loaded", "Client app loaded", {
          severity: "info",
          device
        });
      }

      if (device.riskTags.length > 0 && !window.sessionStorage.getItem("clip-partner-device-risk-observed")) {
        window.sessionStorage.setItem("clip-partner-device-risk-observed", "1");
        void reportClientIssue("device_issue", "Common problem device context detected", {
          severity: "warn",
          device,
          details: {
            riskTags: device.riskTags
          }
        });
      }
    });

    const onError = (event: ErrorEvent) => {
      void reportClientIssue("client_error", event.message || "Unhandled client error", {
        severity: "error",
        details: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        }
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unknown rejection");
      void reportClientIssue("unhandled_rejection", reason, {
        severity: "error"
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      mounted = false;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
