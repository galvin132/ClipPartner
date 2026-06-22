import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClientObservability } from "@/components/ClientObservability";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipPartner",
  description: "IP 直播切片授权分发与佣金结算平台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <ClientObservability />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
