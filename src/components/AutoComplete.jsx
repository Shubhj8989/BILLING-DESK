import React, { useState, useEffect, useRef } from 'react';

export default function AutoComplete({
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder = '',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setFiltered([]);
      return;
    }
    const valUpper = value.toUpperCase();
    const matches = suggestions.filter(item => 
      item.name.toUpperCase().includes(valUpper) ||
      (item.barcode && item.barcode.toUpperCase().includes(valUpper))
    ).slice(0, 8); // Max 8 suggestions
    setFiltered(matches);
  }, [value, suggestions]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && filtered[activeIndex]) {
        e.preventDefault();
        onSelect(filtered[activeIndex]);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && filtered.length > 0 && (
        <div className="autocomplete-suggestions" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          zIndex: 1000,
          boxShadow: 'var(--shadow-md)',
          maxHeight: '200px',
          overflowY: 'auto',
          textAlign: 'left'
        }}>
          {filtered.map((item, index) => (
            <div
              key={item.id || index}
              onClick={() => {
                onSelect(item);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === activeIndex ? 'var(--primary-light)' : 'transparent',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '12px'
              }}
            >
              <div style={{ fontWeight: '600' }}>{item.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Rate: ₹{item.rate} (GST: {item.gst}%) {item.barcode ? `| Barcode: ${item.barcode}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
