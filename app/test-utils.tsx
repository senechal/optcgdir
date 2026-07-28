import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import ptBR from "./messages/pt-BR.json";

// Wrapper único pra todo teste de componente: fornece o contexto do
// next-intl (useTranslations quebra sem provider) usando as mensagens
// reais de pt-BR, então os testes exercitam as chaves de tradução de
// verdade em vez de precisar mockar cada string.
export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="pt-BR" messages={ptBR}>
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

export { ptBR };
