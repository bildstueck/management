import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Image
            src="/brand/bildstueck-mark.png"
            alt="bildstueck"
            width={689}
            height={416}
            priority
            className="h-8 w-auto"
          />
          <CardDescription className="mt-2">Melde dich mit deinem Team-Account an.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
        </CardContent>
      </Card>
    </div>
  );
}
