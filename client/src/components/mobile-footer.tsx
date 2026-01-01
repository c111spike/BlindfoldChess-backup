import { Link } from "wouter";

export function MobileFooter() {
  return (
    <footer className="py-6 px-4 border-t bg-background min-h-[120px] shrink-0">
      <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm">
        <Link href="/privacy" className="text-muted-foreground hover:text-foreground min-h-[44px] flex items-center" data-testid="link-footer-privacy">
          Privacy
        </Link>
        <Link href="/terms" className="text-muted-foreground hover:text-foreground min-h-[44px] flex items-center" data-testid="link-footer-terms">
          Terms
        </Link>
        <Link href="/about" className="text-muted-foreground hover:text-foreground min-h-[44px] flex items-center" data-testid="link-footer-about">
          About
        </Link>
        <Link href="/contact" className="text-muted-foreground hover:text-foreground min-h-[44px] flex items-center" data-testid="link-footer-contact">
          Contact
        </Link>
      </div>
      <div className="flex justify-center items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>v1.0.0</span>
        <span>|</span>
        <span>Analysis by Stockfish</span>
      </div>
    </footer>
  );
}
