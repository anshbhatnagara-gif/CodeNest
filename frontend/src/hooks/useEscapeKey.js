import { useEffect } from 'react';

/**
 * useEscapeKey
 * Reusable hook to handle Escape keypress for modal dialogs and overlays.
 *
 * @param {Function} onEscape - Callback invoked when Escape key is pressed
 * @param {boolean} isActive - Controls whether the event listener is attached
 */
export const useEscapeKey = (onEscape, isActive = true) => {
  useEffect(() => {
    if (!isActive || !onEscape) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, isActive]);
};

export default useEscapeKey;

