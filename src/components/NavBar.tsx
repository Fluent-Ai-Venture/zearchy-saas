"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  // Redirect to dashboard if user is signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <nav className="flex justify-between items-center p-6">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">Zearchy</h1>
      </div>
      <div>
        {isLoaded && isSignedIn ? (
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        ) : (
          <div className="flex gap-4">
            <Link 
              href="/sign-in" 
              className="text-blue-600 hover:underline"
            >
              Sign In
            </Link>
            <Link 
              href="/sign-up" 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
