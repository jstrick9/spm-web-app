import { useState } from 'react';
import { getConfig } from '../config';
import { STORAGE_KEYS } from '../constants/storageKeys';
import SafeImage from './SafeImage';
import ModalDialog from './ModalDialog';

interface WelcomeModalProps {
  onClose: () => void;
  isAdmin: boolean;
  isGuest?: boolean;
}

export function WelcomeModal({
  onClose,
  isAdmin,
  isGuest = false,
}: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const config = getConfig();

  const steps = [
    {
      icon: config.welcomeLogoUrl ? null : '👋',
      logoUrl: config.welcomeLogoUrl || null,
      title: config.welcomeTitle || 'Welcome to the Wedding Layout Planner',
      description: `Create beautiful, customized layouts for your special day at ${
        config.venueName || 'Seven Paths Manor'
      }. This tool makes it easy to design the perfect reception, ceremony, or event space.`,
    },
    {
      icon: '🪑',
      logoUrl: null,
      title: 'Add Tables & Fixtures',
      description:
        'Simply drag items from the sidebar onto your venue canvas. Click an item to select it, then click on the canvas to place it. Move items by dragging them to new positions.',
    },
    {
      icon: '👥',
      logoUrl: null,
      title: 'Manage Your Guest List',
      description:
        'Add guests and assign them to tables. Import your guest list from a CSV file for quick setup. Track seating capacity and ensure everyone has a spot.',
    },
    {
      icon: '💾',
      logoUrl: null,
      title: 'Save & Share Your Layout',
      description:
        'Save your layouts to continue later. Print your design or share it with your venue coordinator. Create multiple layouts to compare different arrangements.',
    },
    {
      icon: '✨',
      logoUrl: null,
      title: 'Available Features',
      description: 'Quick access to the tools available in your account.',
    },
  ];

  const featureItems =
    config.welcomeFeatures && config.welcomeFeatures.length > 0
      ? config.welcomeFeatures
      : ['Layout Design', 'Guest Management', 'Templates', 'Print & Share', 'Event Questions', 'Chat'];

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEYS.WELCOME_HIDDEN, 'true');
    }
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const current = steps[currentStep];

  return (
    <ModalDialog
      title={current.title}
      description={current.description}
      onClose={handleClose}
      className="max-w-2xl"
    >
      <div className="space-y-6">
        <div className="flex justify-center gap-2">
          {steps.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentStep(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-[#4A1942]'
                  : index < currentStep
                    ? 'w-2.5 bg-[#4A1942]/50'
                    : 'w-2.5 bg-gray-300'
              }`}
              aria-label={`Go to welcome step ${index + 1}`}
              aria-current={index === currentStep ? 'step' : undefined}
            />
          ))}
        </div>

        <div className="text-center">
          <div className="mb-6 flex justify-center">
            {current.logoUrl ? (
              <SafeImage
                src={current.logoUrl || undefined}
                alt="Welcome"
                className="w-20 h-20 object-contain mx-auto"
                fallback={<div className="text-5xl">{current.icon}</div>}
              />
            ) : (
              <div className="text-5xl">{current.icon}</div>
            )}
          </div>

          {currentStep === steps.length - 1 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {featureItems.map((feature) => (
                <div
                  key={feature}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
                >
                  • {feature}
                </div>
              ))}
            </div>
          )}

          {!isGuest && (
            <div className="mt-6 flex items-center justify-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
                />
                Don’t show this again
              </label>
            </div>
          )}

          {isGuest && (
            <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Sign in to save your preferences
            </div>
          )}

          {isAdmin && currentStep === steps.length - 1 && (
            <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-left text-sm text-blue-800">
              <strong>⚙️ Admin Tip:</strong> Access the Admin Panel from the header menu
              to customize venues, tables, fixtures, branding settings, and this welcome experience.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 text-sm font-medium text-white bg-[#4A1942] hover:bg-[#5b2352] rounded-lg"
            >
              {currentStep === steps.length - 1 ? "Let's Start!" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}