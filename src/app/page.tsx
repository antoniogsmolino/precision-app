import { redirect } from "next/navigation";

// La landing pubblica "Finanza Agevolata Match" arriva in Fase 3.
// Per ora la root porta dritta al login del team MOLO.
export default function Home() {
  redirect("/login");
}
