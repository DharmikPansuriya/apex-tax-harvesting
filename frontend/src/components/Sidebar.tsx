"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  FileText,
  TrendingDown,
  Upload,
  Menu,
  X,
  LogOut,
  User,
  ArrowLeftRight,
  Play,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const getNavigation = (isWealthManager: boolean) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Holdings", href: "/holdings", icon: User },
    { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "TLH Analysis", href: "/tlh", icon: TrendingDown },
    { name: "TLH Executions", href: "/tlh-executions", icon: Play },
    { name: "CSV Upload", href: "/upload", icon: Upload },
  ];

  if (isWealthManager) {
    baseNavigation.splice(1, 0, {
      name: "Clients",
      href: "/clients",
      icon: Building2,
    });
  }

  return baseNavigation;
};

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { user, userProfile, wealthManager, logout } = useAuth();

  const isWealthManager =
    userProfile?.client_type === "wealth_manager" ||
    userProfile?.client_type === "financial_advisor";
  const navigation = getNavigation(isWealthManager);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-white shadow-md"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:inset-0
      `}
      >
        <div className="flex items-center justify-center h-16 px-4 border-b border-gray-700">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-2">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <h1 className="text-xl font-bold">APEX</h1>
          </div>
        </div>

        {/* User Info */}
        {user && wealthManager && (
          <div className="px-4 py-4 border-b border-gray-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-300" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-gray-400">
                  {userProfile?.firm_name ||
                    wealthManager?.firm_name ||
                    "APEX User"}
                </p>
              </div>
            </div>
          </div>
        )}

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors
                      ${
                        isActive
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }
                    `}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
