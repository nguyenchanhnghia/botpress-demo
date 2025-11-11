'use client';

import React, { useEffect, useState } from 'react';

interface TypewriterProps {
  texts: string[];                 // List of phrases to display
  typingSpeed?: number;            // ms per character while typing
  deletingSpeed?: number;          // ms per character while deleting
  pauseTime?: number;              // ms to wait after a phrase is complete
  loop?: boolean;                  // Whether to loop phrases infinitely
  startDelay?: number;             // Initial delay before typing starts
  children: (value: string) => React.ReactNode; // Render-prop: how to render the text
}

/**
 * Generic typewriter component that only handles text animation.
 * Rendering is controlled by the caller via a render-prop.
 *
 * You can use it for:
 *  - Inline text: <Typewriter>{txt => <span>{txt}</span>}</Typewriter>
 *  - Input placeholder: <Typewriter>{txt => <input placeholder={txt} />}</Typewriter>
 */
const Typewriter: React.FC<TypewriterProps> = ({
  texts,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseTime = 1500,
  loop = true,
  startDelay = 400,
  children,
}) => {
  const [displayText, setDisplayText] = useState('');
  const [index, setIndex] = useState(0);        // index in texts[]
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [showCaret, setShowCaret] = useState(true);

  // Typing / deleting effect
  useEffect(() => {
    if (hasFinished || !texts || texts.length === 0) return;

    // Delay before first typing
    if (!hasStarted) {
      const startTimer = setTimeout(() => setHasStarted(true), startDelay);
      return () => clearTimeout(startTimer);
    }

    const current = texts[index];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText.length < current.length) {
      // Typing forward
      timeout = setTimeout(
        () => setDisplayText(current.slice(0, displayText.length + 1)),
        typingSpeed
      );
    } else if (!isDeleting && displayText.length === current.length) {
      // Completed phrase, wait then start deleting
      timeout = setTimeout(() => {
        if (!loop && index === texts.length - 1) {
          // Last phrase and no loop: stop deleting, mark finished
          setHasFinished(true);
        } else {
          setIsDeleting(true);
        }
      }, pauseTime);
    } else if (isDeleting && displayText.length > 0) {
      // Deleting
      timeout = setTimeout(
        () => setDisplayText(current.slice(0, displayText.length - 1)),
        deletingSpeed
      );
    } else if (isDeleting && displayText.length === 0) {
      // Move to next phrase
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setIndex(prev => (prev + 1) % texts.length);
      }, 300);
    }

    return () => clearTimeout(timeout);
  }, [
    displayText,
    isDeleting,
    index,
    texts,
    typingSpeed,
    deletingSpeed,
    pauseTime,
    loop,
    hasStarted,
    hasFinished,
    startDelay,
  ]);

  // Blinking caret effect: toggles every 600ms while not finished
  useEffect(() => {
    if (hasFinished) {
      setShowCaret(false);
      return;
    }

    const caretTimer = setInterval(() => {
      setShowCaret(prev => !prev);
    }, 600);

    return () => clearInterval(caretTimer);
  }, [hasFinished]);

  const value = displayText + (showCaret ? '|' : '');

  // Safety: if no texts, render empty
  if (!texts || texts.length === 0) {
    return <>{children('')}</>;
  }


  return <>{children(value)}</>;
};

export default Typewriter;