import React from 'react';

/** Single sticky layer for banner + nav so scroll content never slips between them. */
export default function StickyTopChrome({ banner, navigation }) {
  return (
    <div className="sticky top-0 z-50 w-full isolate bg-pe-canvas shadow-sm shadow-neutral-900/5">
      {banner}
      {navigation}
    </div>
  );
}
