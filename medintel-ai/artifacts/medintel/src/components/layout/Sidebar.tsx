import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquare, FileText, BarChart2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded bg-primary">
          <Activity className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-sidebar-foreground tracking-wide">MedIntel AI</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Clinical Intelligence</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-2 font-medium">Platform</div>
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="text-[10px] text-muted-foreground">
          <span className="text-primary font-mono">●</span> Multi-Agent RAG Pipeline
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">LangGraph · FAISS · BM25</div>
      </div>
    </aside>
  );
}
