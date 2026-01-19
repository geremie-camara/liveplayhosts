import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="w-full max-w-md p-4">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2">
            <img src="/logo.png" alt="LivePlay" className="h-10 w-auto" />
            <span className="text-2xl font-bold text-primary">Hosts</span>
          </a>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl",
              headerTitle: "text-primary",
              headerSubtitle: "text-gray-600",
              socialButtonsBlockButton: "border-gray-300 hover:bg-gray-50",
              formButtonPrimary: "bg-accent hover:bg-accent-600",
              footerActionLink: "text-accent hover:text-accent-600",
            },
          }}
        />
      </div>
    </div>
  );
}
