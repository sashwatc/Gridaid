import React from "react";
import TopNav from "@/components/gridaid/TopNav";
import Footer from "@/components/gridaid/Footer";

export default function PageShell({ children, wide = false }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className={`mx-auto w-full flex-1 px-4 py-10 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}