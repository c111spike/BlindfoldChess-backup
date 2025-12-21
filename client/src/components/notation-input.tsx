import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowRight } from "lucide-react";

interface NotationInputProps {
  expectedNotation: string;
  onCorrect: () => void;
  onSkip?: () => void;
  moveNumber: number;
  isWhiteMove: boolean;
  disabled?: boolean;
}

const normalizeNotation = (input: string): string => {
  return input
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/x/gi, "x")
    .replace(/0-0-0/gi, "O-O-O")
    .replace(/0-0/gi, "O-O")
    .replace(/\+/g, "+")
    .replace(/#/g, "#");
};

const stripCheckSymbols = (notation: string): string => {
  return notation.replace(/[+#]$/, "");
};

export function NotationInput({
  expectedNotation,
  onCorrect,
  onSkip,
  moveNumber,
  isWhiteMove,
  disabled = false,
}: NotationInputProps) {
  const [input, setInput] = useState("");
  const [showFeedback, setShowFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled, expectedNotation]);

  useEffect(() => {
    setInput("");
    setShowFeedback(null);
    setAttempts(0);
  }, [expectedNotation]);

  const handleSubmit = () => {
    if (!input.trim()) return;

    const normalizedInput = normalizeNotation(input);
    const normalizedExpected = normalizeNotation(expectedNotation);
    const inputWithoutCheck = stripCheckSymbols(normalizedInput);
    const expectedWithoutCheck = stripCheckSymbols(normalizedExpected);

    if (
      normalizedInput === normalizedExpected ||
      inputWithoutCheck === expectedWithoutCheck
    ) {
      setShowFeedback("correct");
      setTimeout(() => {
        onCorrect();
        setInput("");
        setShowFeedback(null);
        setAttempts(0);
      }, 500);
    } else {
      setShowFeedback("incorrect");
      setAttempts((prev) => prev + 1);
      if (attempts >= 1) {
        setTimeout(() => {
          onCorrect();
          setInput("");
          setShowFeedback(null);
          setAttempts(0);
        }, 2000);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const movePrefix = isWhiteMove 
    ? `${moveNumber}.` 
    : `${moveNumber}...`;

  return (
    <div className="flex flex-col gap-2 p-3 bg-card border rounded-lg" data-testid="notation-input-container">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
          {movePrefix}
        </span>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (showFeedback === "incorrect") {
              setShowFeedback(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type your move..."
          className={`font-mono text-base ${
            showFeedback === "correct" 
              ? "border-green-500 bg-green-500/10" 
              : showFeedback === "incorrect" 
              ? "border-red-500 bg-red-500/10" 
              : ""
          }`}
          disabled={disabled}
          data-testid="notation-input"
        />
        <Button 
          size="icon" 
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          data-testid="notation-submit"
        >
          <Check className="h-4 w-4" />
        </Button>
        {onSkip && (
          <Button 
            size="icon" 
            variant="ghost"
            onClick={onSkip}
            disabled={disabled}
            data-testid="notation-skip"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showFeedback === "correct" && (
        <div className="flex items-center gap-2 text-green-600 text-sm" data-testid="notation-feedback-correct">
          <Check className="h-4 w-4" />
          <span>Correct!</span>
        </div>
      )}

      {showFeedback === "incorrect" && (
        <div className="flex items-center gap-2 text-red-600 text-sm" data-testid="notation-feedback-incorrect">
          <X className="h-4 w-4" />
          <span>
            Incorrect. {attempts >= 1 ? (
              <>Correct notation: <span className="font-mono font-bold">{expectedNotation}</span></>
            ) : (
              "Try again."
            )}
          </span>
        </div>
      )}
    </div>
  );
}
