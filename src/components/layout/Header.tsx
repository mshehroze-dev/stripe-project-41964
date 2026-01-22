
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export const Header: React.FC = () => {  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActivePath = (path: string) => location.pathname === path;
  return (
    <header className="bg-white shadow-sm z-100">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-100">
        <div className="flex h-16 justify-between z-100">
          <div className="flex">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-gray-900">Stripe project</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8 z-100">
              <Link
                to="/"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium hover:border-gray-300 ${
                  isActivePath('/')
                    ? 'border-indigo-500 text-gray-900'
                    : 'border-transparent text-gray-900'
                }`}
              >
                Home
              </Link>              <Link
                to="/billing"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium hover:border-gray-300 ${
                  isActivePath('/billing')
                    ? 'border-indigo-500 text-gray-900'
                    : 'border-transparent text-gray-900'
                }`}
              >
                Billing
              </Link>
              <Link
                to="/checkout"
                className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium hover:border-gray-300 ${
                  isActivePath('/checkout')
                    ? 'border-indigo-500 text-gray-900'
                    : 'border-transparent text-gray-900'
                }`}
              >
                Upgrade
              </Link>            </div>
          </div>          <div className="-mr-2 flex items-center sm:hidden z-100">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="sm:hidden z-100">
          <div className="space-y-1 pb-3 pt-2">
            <Link
              to="/"
              className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 ${
                isActivePath('/')
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600'
              }`}
            >
              Home
            </Link>            <Link
              to="/billing"
              className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 ${
                isActivePath('/billing')
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600'
              }`}
            >
              Billing
            </Link>
            <Link
              to="/checkout"
              className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 ${
                isActivePath('/checkout')
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600'
              }`}
            >
              Upgrade
            </Link>          </div>        </div>
      )}
    </header>
  )
}
