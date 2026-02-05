import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, className = '', ...props }: ButtonProps) {
    return (
        <button
            className={`w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export function ButtonOutline({ children, className = '', ...props }: ButtonProps) {
    return (
        <button
            className={`w-full px-4 py-1.5 backdrop-blur-xl border-1 border-gray-300/80 bg-transparent text-gray-700 rounded-full shadow-none hover:bg-gradient-to-r hover:from-blue-400/90 hover:to-purple-400/90 hover:text-white hover:border-white/80 hover:cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none text-sm font-medium text-center ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}