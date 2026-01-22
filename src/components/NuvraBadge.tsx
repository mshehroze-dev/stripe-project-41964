
import React, { useState } from 'react';

interface NuvraBadgeProps {
  onRemove?: () => void;
}

export const NuvraBadge: React.FC<NuvraBadgeProps> = ({ onRemove }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isHoveringClose, setIsHoveringClose] = useState(false);

  if (!isVisible) return null;

  const handleRemove = () => {
    setIsVisible(false);
    onRemove?.();
  };

  return (
    <div
      style={{
        width: '170px',
        height: '32px',
        borderRadius: '10px',
        opacity: 1,
        position: 'fixed',       // fixed to viewport
        bottom: '20px',          // distance from bottom
        right: '20px',           // distance from right
        padding: '4px 8px',
        gap: '10px',
        background: '#69EDBA40', // Figma color
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(105, 237, 186, 0.3)',
        boxSizing: 'border-box',
        zIndex: 1000,
      }}
    >
      {/* Logo + text */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        {/* Icon pill */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '999px',
            background:
              'linear-gradient(135deg, #69EDBA 0%, #8BF1E3 50%, #4F46E5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              fontFamily:
                'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              color: '#051016',
            }}
          >
            n
          </span>
        </div>

        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: '#051016',
            whiteSpace: 'nowrap',
          }}
        >
          Built with Nuvra
        </span>
      </div>

      {/* X button */}
      <button
        type="button"
        onClick={handleRemove}
        onMouseEnter={() => setIsHoveringClose(true)}
        onMouseLeave={() => setIsHoveringClose(false)}
        style={{
          background: isHoveringClose ? 'rgba(5, 16, 22, 0.06)' : 'transparent',
          border: 'none',
          color: '#051016',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 500,
          lineHeight: 1,
          padding: '2px 4px',
          borderRadius: '999px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '20px',
          minHeight: '20px',
          flexShrink: 0,
        }}
        aria-label="Remove Nuvra badge"
      >
        ×
      </button>
    </div>
  );
};

export default NuvraBadge;
