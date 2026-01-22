
import { Link } from 'react-router-dom';import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[rgb(var(--c-bg))] text-[rgb(var(--c-fg))]">
      <nav className="bg-[rgb(var(--c-surface))] shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-[rgb(var(--c-fg))]">
                Stripe project
              </Link>
            </div>

            <div className="flex items-center space-x-4 z-100">                <>                  <Link
                    to="/billing"
                    className="text-[rgb(var(--c-fg))] hover:text-[rgb(var(--c-fg))] px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Billing
                  </Link>                </>            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>
      <Footer />
    </div>
  );
}
