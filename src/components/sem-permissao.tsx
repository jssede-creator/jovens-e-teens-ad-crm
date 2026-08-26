import { ShieldAlert } from "lucide-react";

export function SemPermissao({
  mensagem = "Sua conta não tem permissão de liderança para ver esta área.",
}: {
  mensagem?: string;
}) {
  return (
    <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center">
      <ShieldAlert className="mx-auto h-5 w-5 text-jt-muted" aria-hidden />
      <p className="mt-3 text-sm text-jt-muted">{mensagem}</p>
    </div>
  );
}

export function PainelEstado({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-jt-line bg-jt-panel px-6 py-14 text-center text-sm text-jt-muted">
      {children}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <PainelEstado>{texto}</PainelEstado>;
}
