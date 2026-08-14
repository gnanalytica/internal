import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acme — Docs & Tasks",
  description: "A combined Notion + Linear workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      {/*
        Opt the whole app out of the static shell. Every route below this point
        resolves the signed-in user and their active workspace before it can
        render anything, so there is no shell worth prerendering — an empty
        fallback keeps the request-time behaviour we had under
        `dynamic = "force-dynamic"`. The caching wins come from `use cache` in
        the data layer, not from PPR.
        See: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md
        ("Opting out of the static shell").
      */}
      <Suspense fallback={null}>
        <body className="min-h-full">
          <TooltipProvider delay={300}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </body>
      </Suspense>
    </html>
  );
}
