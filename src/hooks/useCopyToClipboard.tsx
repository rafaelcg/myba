import { useState } from 'react';

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      // Reset previous states
      setError(null);
      setIsCopied(false);

      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Copy command was unsuccessful');
        }
      }

      setIsCopied(true);
      
      // Reset copied state after 3 seconds
      setTimeout(() => setIsCopied(false), 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy');
      setTimeout(() => setError(null), 3000);
    }
  };

  return { copyToClipboard, isCopied, error };
}