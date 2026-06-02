import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SearchableSelectOption {
  id: string;
  label: string;
  searchText?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minWidth?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  minWidth = 'min-w-[180px]',
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt => {
    const searchText = opt.searchText || opt.label;
    return searchText.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlighted index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].id);
          setIsOpen(false);
          setSearchTerm('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
      default:
        break;
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
    if (highlightedElement) {
      highlightedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  return (
    <div
      ref={containerRef}
      className={`relative ${minWidth} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Main trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300'
        }`}
      >
        <span className="text-slate-700 font-medium truncate">
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            className="max-h-48 overflow-y-auto scrollbar-hide"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    index === highlightedIndex
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : value === option.id
                      ? 'bg-slate-50 text-slate-900 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-slate-400">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
