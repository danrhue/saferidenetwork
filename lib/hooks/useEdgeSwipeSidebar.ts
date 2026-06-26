'use client';

import { useEffect } from 'react';

type UseEdgeSwipeSidebarOptions = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Only register gestures below this viewport width (default 1024). */
  maxWidth?: number;
  /** Pixels from left edge to start an open swipe (default 28). */
  edgeThreshold?: number;
  /** Minimum horizontal swipe distance to trigger (default 72). */
  swipeThreshold?: number;
};

/**
 * Opens the sidebar when the user swipes right from the left edge on mobile.
 * Closes it when swiping left while the drawer is open.
 */
export function useEdgeSwipeSidebar({
  isOpen,
  onOpen,
  onClose,
  maxWidth = 1024,
  edgeThreshold = 28,
  swipeThreshold = 72,
}: UseEdgeSwipeSidebarOptions) {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const isMobileViewport = () =>
      typeof window !== 'undefined' && window.innerWidth < maxWidth;

    const handleTouchStart = (event: TouchEvent) => {
      if (!isMobileViewport() || event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking || !isMobileViewport() || event.touches.length !== 1) return;

      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        return;
      }

      if (!isOpen && startX <= edgeThreshold && deltaX >= swipeThreshold) {
        onOpen();
        tracking = false;
        return;
      }

      if (isOpen && deltaX <= -swipeThreshold) {
        onClose();
        tracking = false;
      }
    };

    const handleTouchEnd = () => {
      tracking = false;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onOpen, onClose, maxWidth, edgeThreshold, swipeThreshold]);
}