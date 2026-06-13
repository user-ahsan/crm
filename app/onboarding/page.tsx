'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import OnboardingLayout from '@/components/common/OnboardingLayout';
import { cn } from '@/lib/utils';
import { teamService } from '@/services/team.service';
import {
  IconRocket,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconUsersGroup,
} from '@tabler/icons-react';

/* ── Types ─────────────────────────────────────────────────── */
interface OnboardingData {
  fullName: string;
  jobTitle: string;
  companyName: string;
  industry: string;
  companySize: string;
  goals: string[];
  inviteCode: string;
}

/* ── Constants ─────────────────────────────────────────────── */
const TOTAL_STEPS = 6;

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const GOAL_OPTIONS = [
  { value: 'track-leads', label: 'Track leads' },
  { value: 'manage-contacts', label: 'Manage contacts' },
  { value: 'monitor-pipeline', label: 'Monitor pipeline' },
  { value: 'schedule-meetings', label: 'Schedule meetings' },
  { value: 'track-tasks', label: 'Track tasks' },
] as const;

const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Manufacturing',
  'Retail',
  'Real Estate',
  'Other',
] as const;

const COMPANY_SIZE_OPTIONS = [
  '1-10',
  '11-50',
  '51-200',
  '201-1000',
  '1000+',
] as const;

/* ── Initial State ─────────────────────────────────────────── */
const INITIAL_FORM_DATA: OnboardingData = {
  fullName: '',
  jobTitle: '',
  companyName: '',
  industry: '',
  companySize: '',
  goals: [],
  inviteCode: '',
};

/* ── Validation ────────────────────────────────────────────── */
function validateStep(step: number, data: OnboardingData): string | null {
  switch (step) {
    case 1:
      if (!data.fullName.trim()) return 'Full name is required';
      return null;
    case 2:
      if (!data.companyName.trim()) return 'Company name is required';
      return null;
    case 3:
      if (data.goals.length === 0) return 'Select at least one goal';
      return null;
    default:
      return null;
  }
}

/* ── Onboarding Page ───────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();

  /* ── State ─────────────────────────────────────────────── */
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>(INITIAL_FORM_DATA);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── Pre-fill from signup data ─────────────────────────── */
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('onboarding-user');
      if (stored) {
        const parsed = JSON.parse(stored) as { fullName?: string; email?: string };
        if (parsed.fullName) {
          setFormData((prev) => ({ ...prev, fullName: parsed.fullName! }));
        }
      }
      const storedTeam = sessionStorage.getItem('onboarding-team');
      if (storedTeam) {
        const parsed = JSON.parse(storedTeam) as { id: string; name: string };
        if (parsed.name) {
          setFormData((prev) => ({ ...prev, companyName: parsed.name }));
        }
      }
      // Generate invite code once on mount
      setFormData((prev) => ({ ...prev, inviteCode: generateInviteCode() }));
    } catch {
      /* Silently ignore — sessionStorage may be empty or corrupted */
    }
  }, []);

  /* ── Field updater ─────────────────────────────────────── */
  const updateField = useCallback(
    <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setValidationError(null);
    },
    [],
  );

  /* ── Goal toggle ────────────────────────────────────────── */
  const toggleGoal = useCallback((goal: string) => {
    setFormData((prev) => {
      const exists = prev.goals.includes(goal);
      return {
        ...prev,
        goals: exists
          ? prev.goals.filter((g) => g !== goal)
          : [...prev.goals, goal],
      };
    });
    setValidationError(null);
  }, []);

  /* ── Navigation ─────────────────────────────────────────── */
  const error = useMemo(
    () => validateStep(currentStep, formData),
    [currentStep, formData],
  );

  const canGoNext = useMemo(() => {
    if (currentStep === 0) return true;
    if (currentStep === TOTAL_STEPS - 1) return false;
    if (currentStep === 4) return true; // invite step — auto-generated, always valid
    return error === null;
  }, [currentStep, error]);

  const handleNext = useCallback(() => {
    const err = validateStep(currentStep, formData);
    if (err) {
      setValidationError(err);
      return;
    }
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1);
      setValidationError(null);
    }
  }, [currentStep, formData]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setValidationError(null);
    }
  }, [currentStep]);

  const handleGoToDashboard = useCallback(async () => {
    setIsRedirecting(true);
    // Update team with onboarding data
    const storedTeam = sessionStorage.getItem('onboarding-team');
    if (storedTeam) {
      try {
        const parsed = JSON.parse(storedTeam) as { id: string };
        if (parsed.id && formData.companyName) {
          await teamService.update(parsed.id, {
            name: formData.companyName,
            description: `${formData.companyName} - ${formData.industry} ${formData.companySize ? `(${formData.companySize})` : ''}`,
          });
        }
      } catch {
        /* Silently ignore */
      }
    }
    // Clear onboarding data
    sessionStorage.removeItem('onboarding-user');
    sessionStorage.removeItem('onboarding-team');
    router.push('/dashboard');
  }, [router, formData]);

  /* ── Derived data for summary ───────────────────────────── */
  const selectedGoalLabels = useMemo(
    () =>
      formData.goals
        .map((g) => GOAL_OPTIONS.find((opt) => opt.value === g)?.label ?? g)
        .filter(Boolean),
    [formData.goals],
  );

  /* ── Render: Welcome Step ────────────────────────────────── */
  const renderWelcomeStep = () => (
    <div className="flex flex-col items-center text-center">
      {/* Gradient header area */}
      <div className="mb-8 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20">
        <IconRocket size={40} className="text-primary-foreground" stroke={1.5} />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Welcome to NexusCRM
      </h1>
      <p className="mt-3 max-w-md text-balance text-muted-foreground">
        Your unified sales and relationship management platform. Let us help you
        get set up in just a few steps so you can start managing leads, contacts,
        and your pipeline right away.
      </p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
        {[
          { title: 'Track Leads', desc: 'Capture and nurture leads from any source' },
          { title: 'Manage Contacts', desc: 'Keep your address book organized' },
          { title: 'Monitor Pipeline', desc: 'Visualize every deal in your funnel' },
          { title: 'Schedule & Track', desc: 'Meetings, tasks, and follow-ups' },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-xl border border-border/50 bg-white/60 p-3 dark:bg-zinc-900/40"
          >
            <IconCircleCheck
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              stroke={1.5}
            />
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Render: Profile Step ────────────────────────────────── */
  const renderProfileStep = () => (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Tell us about yourself</CardTitle>
        <CardDescription>
          We will use this information to personalise your experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            placeholder="e.g. John Doe"
            value={formData.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            aria-required="true"
            aria-invalid={validationError ? 'true' : undefined}
          />
        </div>

        {/* Job Title */}
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            placeholder="e.g. CEO, Sales Manager"
            value={formData.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
          />
        </div>
      </CardContent>
      {validationError && (
        <p className="px-6 pb-2 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      )}
    </Card>
  );

  /* ── Render: Company Step ────────────────────────────────── */
  const renderCompanyStep = () => (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Tell us about your company</CardTitle>
        <CardDescription>
          Help us tailor the experience to your organisation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Company name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder="e.g. Acme Inc"
            value={formData.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            aria-required="true"
            aria-invalid={validationError ? 'true' : undefined}
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select
            value={formData.industry || null}
            onValueChange={(v: string | null) => {
              if (v !== null) updateField('industry', v);
            }}
          >
            <SelectTrigger id="industry" className="w-full">
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((ind) => (
                <SelectItem key={ind} value={ind}>
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company Size */}
        <div className="space-y-2">
          <Label htmlFor="companySize">Company size</Label>
          <Select
            value={formData.companySize || null}
            onValueChange={(v: string | null) => {
              if (v !== null) updateField('companySize', v);
            }}
          >
            <SelectTrigger id="companySize" className="w-full">
              <SelectValue placeholder="Select company size" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size} employees
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      {validationError && (
        <p className="px-6 pb-2 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      )}
    </Card>
  );

  /* ── Render: Goals Step ──────────────────────────────────── */
  const renderGoalsStep = () => (
    <Card size="sm">
      <CardHeader>
        <CardTitle>What are your goals?</CardTitle>
        <CardDescription>
          Select all that apply. We will surface the most relevant features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {GOAL_OPTIONS.map((goal) => {
          const isSelected = formData.goals.includes(goal.value);
          return (
            <label
              key={goal.value}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50',
                isSelected
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/50',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleGoal(goal.value)}
                aria-label={goal.label}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {goal.label}
                </p>
              </div>
              {isSelected && (
                <IconCheck
                  size={18}
                  className="shrink-0 text-primary"
                  stroke={2.5}
                />
              )}
            </label>
          );
        })}
      </CardContent>
      {validationError && (
        <p className="px-6 pb-2 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      )}
    </Card>
  );

  /* ── Render: Invite Team Step ─────────────────────────────── */
  const renderInviteStep = () => {
    const inviteLink = `https://nexuscrm.app/join?code=${formData.inviteCode}`;

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback: select text manually
        const input = document.getElementById('invite-link-input') as HTMLInputElement;
        if (input) { input.select(); }
      }
    };

    return (
      <Card size="sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
            <IconUsersGroup size={28} className="text-primary" stroke={1.5} />
          </div>
          <CardTitle>Invite Your Team</CardTitle>
          <CardDescription>
            Share this invite link or code with your team members so they can join
            your workspace. You can always invite more people later from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Invite Code */}
          <div className="text-center">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              TEAM INVITE CODE
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl bg-muted/60 px-5 py-3">
              <span className="font-mono text-2xl font-bold tracking-[0.25em] text-foreground">
                {formData.inviteCode}
              </span>
            </div>
          </div>

          {/* Invite Link */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-link-input">Invite link</Label>
            <div className="flex gap-2">
              <Input
                id="invite-link-input"
                value={inviteLink}
                readOnly
                className="flex-1 font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <>
                    <IconCircleCheck size={14} className="text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <IconCopy size={14} />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">💡 Tips</p>
            <ul className="ml-4 list-disc space-y-0.5">
              <li>Share the invite link via email, Slack, or any messaging tool</li>
              <li>You can change team roles later in Settings → Team</li>
              <li>Invitations expire after 7 days for security</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  };

  /* ── Render: Complete Step ───────────────────────────────── */
  const renderCompleteStep = () => (
    <div className="flex flex-col items-center text-center">
      {/* Celebratory icon */}
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100 shadow-lg shadow-emerald-200/50 dark:bg-emerald-900/30 dark:shadow-emerald-900/20">
        <IconCheck
          size={44}
          className="text-emerald-600 dark:text-emerald-400"
          stroke={2}
        />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        You&apos;re all set!
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your CRM is configured and ready to go. Here is a quick recap of your
        setup.
      </p>

      {/* Summary card */}
      <Card size="sm" className="mt-6 w-full text-left">
        <CardHeader>
          <CardTitle className="text-base">Setup Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Profile */}
          <SummaryRow
            label="Name"
            value={formData.fullName || 'Not provided'}
          />
          <SummaryRow
            label="Job Title"
            value={formData.jobTitle || 'Not provided'}
          />
          <SeparatorLine />
          <SummaryRow
            label="Company"
            value={formData.companyName || 'Not provided'}
          />
          <SummaryRow
            label="Industry"
            value={formData.industry || 'Not provided'}
          />
          <SummaryRow
            label="Company Size"
            value={
              formData.companySize
                ? `${formData.companySize} employees`
                : 'Not provided'
            }
          />
          <SeparatorLine />
          <SummaryRow
            label="Goals"
            value={
              selectedGoalLabels.length > 0
                ? selectedGoalLabels.join(', ')
                : 'None selected'
            }
          />
        </CardContent>
      </Card>

      {/* Go to Dashboard */}
      <Button
        size="lg"
        className="mt-8 gap-2"
        onClick={handleGoToDashboard}
        disabled={isRedirecting}
      >
        {isRedirecting ? (
          'Redirecting…'
        ) : (
          <>
            Go to Dashboard
            <IconArrowRight size={18} />
          </>
        )}
      </Button>
    </div>
  );

  /* ── Main Render ──────────────────────────────────────────── */
  return (
    <OnboardingLayout currentStep={currentStep} totalSteps={TOTAL_STEPS}>
      {/* Step counter */}
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Step {currentStep + 1} of {TOTAL_STEPS}
      </p>

      {/* Step Content */}
      <div className="min-h-[320px]">
        {currentStep === 0 && renderWelcomeStep()}
        {currentStep === 1 && renderProfileStep()}
        {currentStep === 2 && renderCompanyStep()}
        {currentStep === 3 && renderGoalsStep()}
        {currentStep === 4 && renderInviteStep()}
        {currentStep === 5 && renderCompleteStep()}
      </div>

      {/* Navigation Buttons (not shown on complete step) */}
      {currentStep < TOTAL_STEPS - 1 && (
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="gap-1.5"
          >
            <IconArrowLeft size={16} />
            Back
          </Button>

          <div className="flex-1" />

          <Button
            onClick={handleNext}
            disabled={!canGoNext}
            className="gap-1.5"
          >
            {currentStep === 0 ? (
              <>
                Get Started
                <IconArrowRight size={16} />
              </>
            ) : (
              <>
                Next
                <IconArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      )}
    </OnboardingLayout>
  );
}

/* ── Helper: Summary Row ───────────────────────────────────── */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

/* ── Helper: Separator Line ────────────────────────────────── */
function SeparatorLine() {
  return <div className="h-px bg-border" />;
}
