import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// Sem rotas prefixadas por idioma (/en/..., /pt-BR/...) — projeto pessoal,
// sem necessidade de SEO multi-idioma. O idioma escolhido fica salvo num
// cookie (ver actions/setLocale.ts) e é lido aqui a cada request.
export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_COOKIE = "locale";

function isSupportedLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
