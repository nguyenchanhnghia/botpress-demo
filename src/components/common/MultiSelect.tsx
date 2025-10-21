'use client';

import { useEffect, useRef, useState } from 'react';

interface MultiSelectProps {
    options: string[];
    value: string[];
    onChange: (selected: string[]) => void;
    disabled?: boolean;
}

export default function MultiSelect({
    options,
    value,
    onChange,
    disabled = false,
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        const newSelection = value.includes(option)
            ? value.filter((v) => v !== option)
            : [...value, option];
        onChange(newSelection);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* Input Box */}
            <div
                onClick={() => !disabled && setOpen(!open)}
                className={`w-full border px-3 py-2 rounded-md text-sm text-gray-800 bg-white shadow-sm cursor-pointer ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'hover:border-blue-500'
                    }`}
            >
                {value.length > 0 ? value.join(', ').toUpperCase() : 'Select roles...'}
            </div>

            {/* Dropdown List */}
            {open && (
                <div className="absolute z-10 mt-1 min-w-[6rem] w-auto bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto max-w-screen-sm">
                    {options.map((option) => (
                        <label
                            key={option}
                            className="flex items-center px-3 py-2 hover:bg-gray-100 text-sm cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={value.includes(option)}
                                onChange={() => toggleOption(option)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-800">{option}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}