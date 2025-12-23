import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HandshakeIcon, Clock, Gavel, MousePointer, ChevronRight, ChevronLeft, X, CheckCircle } from "lucide-react";

const OTB_TUTORIAL_COMPLETED_KEY = "otb_tutorial_completed";

interface TutorialStep {
  title: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
  tip?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Pre-Game Handshake",
    icon: <HandshakeIcon className="h-8 w-8 text-primary" />,
    description: "In OTB (Over-the-Board) chess, players traditionally shake hands before the game begins.",
    details: [
      "Click the handshake button before making your first move",
      "Your opponent will also offer a handshake",
      "If your opponent calls the arbiter, you'll receive a time penalty",
      "Continued refusal may result in a forced forfeit"
    ],
    tip: "Always offer the handshake first to show good sportsmanship!"
  },
  {
    title: "Manual Clock",
    icon: <Clock className="h-8 w-8 text-primary" />,
    description: "Unlike online chess, OTB players must manually press the clock after making a move.",
    details: [
      "After moving a piece, click the clock to end your turn",
      "Your time only stops when you press the clock",
      "Forgetting to press the clock keeps your timer running",
      "The clock button appears next to the timers"
    ],
    tip: "Get into the habit of Move → Clock for every turn!"
  },
  {
    title: "Touch-Move Rule",
    icon: <MousePointer className="h-8 w-8 text-primary" />,
    description: "In tournament play, once you touch a piece, you must move it if it has legal moves.",
    details: [
      "Clicking a piece 'touches' it in OTB mode",
      "If that piece has legal moves, you must move it",
      "This prevents players from testing moves by touching pieces",
      "Think before you click!"
    ],
    tip: "Plan your move mentally before selecting a piece."
  },
  {
    title: "Calling the Arbiter",
    icon: <Gavel className="h-8 w-8 text-primary" />,
    description: "If you believe your opponent made an illegal move or violated rules, you can call the arbiter.",
    details: [
      "Click the 'Call Arbiter' button to raise a dispute",
      "Choose the type of claim (illegal move, unsportsmanlike conduct, etc.)",
      "The arbiter will review and make a ruling",
      "False claims result in a time penalty for you"
    ],
    tip: "Only call the arbiter when you're confident about the violation."
  }
];

interface OTBTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function OTBTutorial({ open, onOpenChange, onComplete }: OTBTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(OTB_TUTORIAL_COMPLETED_KEY, "true");
    setCompleted(true);
    onComplete?.();
    setTimeout(() => {
      onOpenChange(false);
      setCurrentStep(0);
      setCompleted(false);
    }, 1500);
  };

  const handleSkip = () => {
    localStorage.setItem(OTB_TUTORIAL_COMPLETED_KEY, "true");
    onOpenChange(false);
    setCurrentStep(0);
    onComplete?.();
  };

  if (completed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold">You're Ready!</h2>
            <p className="text-muted-foreground text-center">
              Good luck in your OTB training. Remember: Handshake, Move, Clock!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              OTB Mode Tutorial
              <Badge variant="outline" className="ml-2">
                {currentStep + 1} / {tutorialSteps.length}
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription>
            Learn the unique features of Over-the-Board chess simulation
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  {step.icon}
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                  <ul className="space-y-2 mt-4">
                    {step.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {step.tip && (
                    <div className="mt-4 p-3 bg-amber-500/10 rounded-md border border-amber-500/20">
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        <strong>Pro Tip:</strong> {step.tip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center gap-1 py-2">
          {tutorialSteps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentStep 
                  ? "w-6 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              data-testid={`tutorial-dot-${idx}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            data-testid="button-skip-tutorial"
          >
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
              data-testid="button-tutorial-previous"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              data-testid="button-tutorial-next"
            >
              {isLastStep ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Got It!
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useOTBTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(OTB_TUTORIAL_COMPLETED_KEY);
    setHasSeenTutorial(completed === "true");
  }, []);

  const triggerTutorial = () => {
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  };

  const resetTutorial = () => {
    localStorage.removeItem(OTB_TUTORIAL_COMPLETED_KEY);
    setHasSeenTutorial(false);
  };

  const openTutorial = () => {
    setShowTutorial(true);
  };

  const markComplete = () => {
    setHasSeenTutorial(true);
    setShowTutorial(false);
  };

  return {
    showTutorial,
    setShowTutorial,
    hasSeenTutorial,
    triggerTutorial,
    resetTutorial,
    openTutorial,
    markComplete
  };
}

export { OTB_TUTORIAL_COMPLETED_KEY };
