import { MisuraForm } from "@/components/dashboard/misura-form";

export default function NuovaMisuraPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Nuova misura</h1>
      <p className="mb-6 text-sm text-slate-400">
        Inserisci una misura non ancora coperta dal monitoraggio automatico.
      </p>
      <MisuraForm />
    </div>
  );
}
