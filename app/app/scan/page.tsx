import { getLocale } from "next-intl/server";
import ScanCard from "../../components/ScanCard";
import type { Locale } from "../../i18n/request";

export default async function ScanPage() {
  const locale = await getLocale();
  return <ScanCard locale={locale as Locale} />;
}
