"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirecionar diretamente para o dashboard sem verificação de autenticação
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-32 bg-gray-200 dark:bg-gray-800 rounded-md mb-4"></div>
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
      </div>
    </div>
  );
}
