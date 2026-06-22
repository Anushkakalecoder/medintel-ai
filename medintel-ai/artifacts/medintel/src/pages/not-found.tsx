import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">404 — Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
        <Link href="/">
          <a className="text-sm text-primary hover:underline">Return to Dashboard</a>
        </Link>
      </div>
    </div>
  );
}
