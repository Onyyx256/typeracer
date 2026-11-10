"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ErrorMessage } from "@/app/components/error-message";
import { localeFromPathname } from "@/lib/i18n/config";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  const locale = localeFromPathname(usePathname());

  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorMessage locale={locale} retry={retry} />;
}
