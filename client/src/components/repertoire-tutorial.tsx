import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Book, Plus, Play, Calendar, Brain, CheckCircle, ChevronRight, ChevronLeft, X } from "lucide-react";

const REPERTOIRE_TUTORIAL_COMPLETED_KEY = "repertoire_tutorial_completed";

interface TutorialStep {
  title: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
  tip?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "What is a Repertoire?",
    icon: <Book className="h-8 w-8 text-primary" />,
    description: "A repertoire is your personal collection of opening moves that you want to master and play consistently.",
    details: [
      "Think of it as your playbook of preferred opening lines",
      "You can create separate repertoires for White and Black",
      "Each repertoire focuses on specific openings you want to learn",
      "The trainer helps you memorize and practice these lines"
    ],
    tip: "Start with one repertoire per color and expand as you improve!"
  },
  {
    title: "Creating a Repertoire",
    icon: <Plus className="h-8 w-8 text-primary" />,
    description: "Click the 'New Repertoire' button to create your first opening repertoire.",
    details: [
      "Give your repertoire a descriptive name (e.g., 'Sicilian Defense')",
      "Choose your playing color - White or Black",
      "Optionally select a starting opening from the Lichess database",
      "The database contains thousands of named openings with ECO codes"
    ],
    tip: "Use ECO filters (A-E) to narrow down openings by category."
  },
  {
    title: "Adding Lines",
    icon: <Brain className="h-8 w-8 text-primary" />,
    description: "After creating a repertoire, you'll add specific move sequences called 'lines' to practice.",
    details: [
      "Each line is a sequence of moves from the opening position",
      "You can add multiple variations within the same repertoire",
      "Lines are stored with their starting position (FEN)",
      "The trainer will quiz you on the correct responses"
    ],
    tip: "Focus on your most common opponent responses first."
  },
  {
    title: "Training Mode",
    icon: <Play className="h-8 w-8 text-primary" />,
    description: "Click 'Start Training' on any repertoire to begin practicing your opening moves.",
    details: [
      "The board shows a position from your repertoire",
      "Play your prepared response for that position",
      "Correct moves earn positive feedback and progress",
      "Wrong moves show the correct answer so you can learn"
    ],
    tip: "Regular short practice sessions are more effective than long cramming!"
  },
  {
    title: "Spaced Repetition",
    icon: <Calendar className="h-8 w-8 text-primary" />,
    description: "The trainer uses spaced repetition to optimize your learning and memory retention.",
    details: [
      "Lines you get right appear less frequently",
      "Lines you struggle with come up more often",
      "This scientifically-proven method improves long-term memory",
      "Check the 'Include in review' box to add lines to game reviews"
    ],
    tip: "Practice daily for just 5-10 minutes to see the best results!"
  }
];

interface RepertoireTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function RepertoireTutorial({ open, onOpenChange, onComplete }: RepertoireTutorialProps) {
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
    localStorage.setItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY, "true");
    setCompleted(true);
    onComplete?.();
    setTimeout(() => {
      onOpenChange(false);
      setCurrentStep(0);
      setCompleted(false);
    }, 1500);
  };

  const handleSkip = () => {
    localStorage.setItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY, "true");
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
            <h2 className="text-xl font-semibold">Ready to Build Your Repertoire!</h2>
            <p className="text-muted-foreground text-center">
              Start by creating your first repertoire and adding opening lines to practice.
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
              Repertoire Trainer Tutorial
              <Badge variant="outline" className="ml-2">
                {currentStep + 1} / {tutorialSteps.length}
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription>
            Learn how to build and practice your opening repertoire
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
              data-testid={`repertoire-tutorial-dot-${idx}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            data-testid="button-skip-repertoire-tutorial"
          >
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
              data-testid="button-repertoire-tutorial-previous"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              data-testid="button-repertoire-tutorial-next"
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

export function useRepertoireTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY);
    setHasSeenTutorial(completed === "true");
  }, []);

  const triggerTutorial = () => {
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  };

  const resetTutorial = () => {
    localStorage.removeItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY);
    setHasSeenTutorial(false);
  };

  const openTutorial = () => {
    setShowTutorial(true);
  };

  const markComplete = () => {
    localStorage.setItem(REPERTOIRE_TUTORIAL_COMPLETED_KEY, "true");
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

export { REPERTOIRE_TUTORIAL_COMPLETED_KEY };
