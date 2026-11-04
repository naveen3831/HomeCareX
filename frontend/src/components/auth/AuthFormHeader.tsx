import React from 'react';
import { Link } from 'react-router-dom';

interface AuthFormHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

export const AuthFormHeader: React.FC<AuthFormHeaderProps> = ({
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`text-center mb-4 sm:mb-6 ${className}`}>
      {/* Centered Brand Logo */}
      <Link
        to="/"
        className="inline-block transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#4338ca] rounded-xl"
        aria-label="HomeCareX Home"
      >
        <img
          src="/logo.png"
          alt="HomeCareX"
          className="h-7 sm:h-8 md:h-9 w-auto mx-auto object-contain"
        />
      </Link>

      <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mt-2.5 sm:mt-3.5 tracking-tight">
        {title}
      </h1>

      {subtitle && (
        <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-1.5 leading-relaxed max-w-sm mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default AuthFormHeader;
