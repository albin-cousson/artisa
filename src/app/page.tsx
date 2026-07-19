import { Suspense } from "react";
import { CommunesMap } from "@/components/CommunesMap";
import { WelcomeModal } from "@/components/WelcomeModal";

export default function Home() {
  return (
    <main className="h-full w-full">
      <CommunesMap />
      <Suspense fallback={null}>
        <WelcomeModal />
      </Suspense>
    </main>
  );
}
