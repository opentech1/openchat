import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface TrueFocusProps {
  sentence?: string;
  manualMode?: boolean;
  blurAmount?: number;
  borderColor?: string;
  glowColor?: string;
  animationDuration?: number;
  pauseBetweenAnimations?: number;
}

interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TrueFocus: React.FC<TrueFocusProps> = ({
  sentence = 'True Focus',
  manualMode = false,
  blurAmount = 5,
  borderColor = 'white',
  glowColor = 'rgba(255, 255, 255, 0.6)',
  animationDuration = 0.5,
  pauseBetweenAnimations = 1
}) => {
  const prefersReducedMotion = useReducedMotion();
  const words = sentence.split(' ');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [lastActiveIndex, setLastActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focusRect, setFocusRect] = useState<FocusRect>({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    if (!manualMode && !prefersReducedMotion) {
      const interval = setInterval(
        () => {
          setCurrentIndex(prev => (prev + 1) % words.length);
        },
        (animationDuration + pauseBetweenAnimations) * 1000
      );

      return () => clearInterval(interval);
    }
  }, [manualMode, prefersReducedMotion, animationDuration, pauseBetweenAnimations, words.length]);

  useEffect(() => {
    if (currentIndex === null || currentIndex === -1) return;
    if (!wordRefs.current[currentIndex] || !containerRef.current) return;

    const parentRect = containerRef.current.getBoundingClientRect();
    const activeRect = wordRefs.current[currentIndex]!.getBoundingClientRect();

    setFocusRect({
      x: activeRect.left - parentRect.left,
      y: activeRect.top - parentRect.top,
      width: activeRect.width,
      height: activeRect.height
    });
  }, [currentIndex, words.length]);

  const handleMouseEnter = (index: number) => {
    if (manualMode) {
      setLastActiveIndex(index);
      setCurrentIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (manualMode) {
      setCurrentIndex(lastActiveIndex!);
    }
  };

  const handleFocus = (index: number) => {
    if (manualMode) {
      setLastActiveIndex(index);
      setCurrentIndex(index);
    }
  };

  const handleBlur = () => {
    if (manualMode) {
      setCurrentIndex(lastActiveIndex!);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (manualMode) {
        setLastActiveIndex(index);
        setCurrentIndex(index);
      }
    }
  };

  return (
    <div className="relative flex gap-4 justify-center items-center flex-wrap" ref={containerRef}>
      {words.map((word, index) => {
        const isActive = index === currentIndex;
        return (
          <span
            key={index}
            ref={el => {
              wordRefs.current[index] = el;
            }}
            className="relative text-[3rem] font-black cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded"
            style={
              {
                filter: manualMode
                  ? isActive
                    ? `blur(0px)`
                    : `blur(${blurAmount}px)`
                  : isActive
                    ? `blur(0px)`
                    : `blur(${blurAmount}px)`,
                transition: `filter ${animationDuration}s ease`
              } as React.CSSProperties
            }
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={manualMode ? 0 : -1}
            role="button"
            aria-label={`Focus word: ${word}`}
          >
            {word}
          </span>
        );
      })}

      <motion.div
        className="absolute top-0 left-0 pointer-events-none box-border border-0"
        animate={{
          x: focusRect.x,
          y: focusRect.y,
          width: focusRect.width,
          height: focusRect.height,
          opacity: currentIndex >= 0 ? 1 : 0
        }}
        transition={{
          duration: prefersReducedMotion ? 0 : animationDuration
        }}
        style={
          {
            '--border-color': borderColor,
            '--glow-color': glowColor
          } as React.CSSProperties
        }
      >
        <span
          className="absolute w-4 h-4 border-[3px] rounded-[3px] top-[-10px] left-[-10px] border-r-0 border-b-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 4px var(--border-color))'
          }}
        ></span>
        <span
          className="absolute w-4 h-4 border-[3px] rounded-[3px] top-[-10px] right-[-10px] border-l-0 border-b-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 4px var(--border-color))'
          }}
        ></span>
        <span
          className="absolute w-4 h-4 border-[3px] rounded-[3px] bottom-[-10px] left-[-10px] border-r-0 border-t-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 4px var(--border-color))'
          }}
        ></span>
        <span
          className="absolute w-4 h-4 border-[3px] rounded-[3px] bottom-[-10px] right-[-10px] border-l-0 border-t-0"
          style={{
            borderColor: 'var(--border-color)',
            filter: 'drop-shadow(0 0 4px var(--border-color))'
          }}
        ></span>
      </motion.div>
    </div>
  );
};

export default TrueFocus;
