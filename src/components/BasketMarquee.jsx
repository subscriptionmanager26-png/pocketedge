import React from 'react';
import LandingBasketCard from './LandingBasketCard';

export default function BasketMarquee({ baskets }) {
  const track = [...baskets, ...baskets];

  return (
    <div className="relative overflow-hidden group">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-[#F7F7F5] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-[#F7F7F5] to-transparent z-10" />

      <div className="flex w-max items-stretch animate-basket-marquee group-hover:[animation-play-state:paused]">
        {track.map((basket, index) => (
          <div key={`${basket.id}-${index}`} className="flex px-2.5 sm:px-3">
            <LandingBasketCard basket={basket} />
          </div>
        ))}
      </div>
    </div>
  );
}
