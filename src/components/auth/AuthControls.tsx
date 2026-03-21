"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { api } from "../../../convex/_generated/api";

export default function AuthControls() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.app.currentViewer, isAuthenticated ? {} : "skip");
  const bootstrapViewer = useMutation(api.app.bootstrapViewer);
  const [, startTransition] = useTransition();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !viewer || bootstrapped) {
      return;
    }
    if (viewer.defaultOrgId && viewer.defaultProjectId) {
      setBootstrapped(true);
      return;
    }
    startTransition(() => {
      void bootstrapViewer({}).then(() => {
        setBootstrapped(true);
      });
    });
  }, [bootstrapped, bootstrapViewer, isAuthenticated, viewer]);

  if (isLoading) {
    return <div className="text-sm text-text-muted">Auth...</div>;
  }

  const isAccountActive = pathname?.startsWith("/account");
  const baseClass =
    "relative text-base font-medium tracking-wide transition-colors duration-200";

  if (!isAuthenticated) {
    return (
      <Link
        href={`/sign-in?redirect=${encodeURIComponent(pathname || "/")}`}
        className={clsx(
          baseClass,
          pathname?.startsWith("/sign-in")
            ? "text-text-primary"
            : "text-text-muted hover:text-text-secondary",
        )}
      >
        Sign In
        {pathname?.startsWith("/sign-in") ? (
          <motion.div
            layoutId="nav-dot"
            className="absolute -bottom-1.5 left-0 right-0 mx-auto h-1 w-1 rounded-full bg-accent"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href="/account"
      className={clsx(
        baseClass,
        isAccountActive ? "text-text-primary" : "text-text-muted hover:text-text-secondary",
      )}
    >
      Account
      {isAccountActive ? (
        <motion.div
          layoutId="nav-dot"
          className="absolute -bottom-1.5 left-0 right-0 mx-auto h-1 w-1 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      ) : null}
    </Link>
  );
}
