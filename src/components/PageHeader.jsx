import React from 'react';

export default function PageHeader({
  eyebrow,
  title,
  description,
  className = '',
  align = 'center',
}) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`${alignClass} ${className}`}>
      {eyebrow && <p className="pe-eyebrow">{eyebrow}</p>}
      <h1 className="pe-title mt-1">{title}</h1>
      {description && (
        <p
          className={`pe-body mt-2 max-w-2xl ${
            align === 'center' ? 'mx-auto' : ''
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
