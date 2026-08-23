import { MisuraForm } from "@/components/dashboard/misura-form";

export default function NuovaMisuraPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-1 text-lg font-semibold text-ink">Nuova misura</h1>
      <p className="mb-6 text-sm text-ink/40">
        Inserisci una misura non ancora coperta dal monitoraggio automatico.
      </p>
      <MisuraForm />
    </div>
  );
}
