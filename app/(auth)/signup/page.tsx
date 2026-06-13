'use client';

import { useState, useCallback, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { IconNetwork, IconEye, IconEyeOff } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/* ── Types ────────────────────────────────────────────────── */
interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type PageState = 'form' | 'confirm_email';

interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof SignupFormData, string>>;
}

/* ── Validation ──────────────────────────────────────────── */
function validateSignupForm(data: SignupFormData): ValidationResult {
  const errors: Partial<Record<keyof SignupFormData, string>> = {};

  /* Full Name */
  const trimmedName = data.fullName.trim();
  if (!trimmedName) {
    errors.fullName = 'Full name is required';
  } else if (trimmedName.length < 2) {
    errors.fullName = 'Name must be at least 2 characters';
  }

  /* Email */
  const trimmedEmail = data.email.trim();
  if (!trimmedEmail) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address';
  }

  /* Password */
  if (!data.password) {
    errors.password = 'Password is required';
  } else if (data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  /* Confirm Password */
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/* ── Signup Page ──────────────────────────────────────────── */
export default function SignupPage() {
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [pageState, setPageState] = useState<PageState>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  /* ── Field change handler ───────────────────────────── */
  const handleChange = useCallback(
    (field: keyof SignupFormData) => (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      /* Clear field error when user starts typing */
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
      if (submitError) {
        setSubmitError(null);
      }
    },
    [errors, submitError],
  );

  /* ── Submit handler (real Supabase auth) ──────────── */
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);

      /* 1. Validate */
      const validation = validateSignupForm(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      /* 2. Authenticate via Supabase */
      setIsSubmitting(true);

      try {
        const supabase = await createClient();

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (authError) {
          setSubmitError(authError.message);
          return;
        }

        if (!authData.user) {
          setSubmitError('Failed to create account. Please try again.');
          return;
        }

        /* 3. Auto-create a team for the new user */
        try {
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .insert({
              name: `${formData.fullName.split(' ')[0]}'s Team`,
              description: '',
              created_by: authData.user.id,
            })
            .select()
            .single();

          if (!teamError && teamData) {
            // Add user as admin member of the team
            await supabase.from('team_members').insert({
              team_id: teamData.id,
              user_id: authData.user.id,
              role: 'admin',
            });

            sessionStorage.setItem('onboarding-team', JSON.stringify({
              id: teamData.id,
              name: teamData.name,
            }));
          }
        } catch {
          // Non-critical - team creation may fail
        }

        /* 4. Store user info for onboarding */
        const userInfo = { fullName: formData.fullName, email: formData.email };
        sessionStorage.setItem('onboarding-user', JSON.stringify(userInfo));

        /* 5. Check if session exists (auto-login) or email confirmation is needed */
        if (authData.session) {
          // Force cookie flush so the middleware sees the session
          await supabase.auth.getSession();
          toast.success('Account created successfully!');
          // Use full-page navigation so middleware can read fresh cookies
          window.location.href = '/onboarding';
        } else {
          // No session → email confirmation required
          setRegisteredEmail(formData.email);
          setPageState('confirm_email');
        }
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData],
  );

  /* ── Render ─────────────────────────────────────────── */
  if (pageState === 'confirm_email') {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center space-y-2 pb-4 text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
            <IconNetwork className="size-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            We sent a verification link to<br />
            <span className="font-medium text-foreground">{registeredEmail}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to verify your account, then sign in to continue.
          </p>

          <div className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
            <p>Didn&apos;t receive the email?</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-left">
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email</li>
              <li>Try signing up again with the same email</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button render={<Link href="/login" />}>
              Go to Sign In
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPageState('form')}
            >
              Use a different email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="items-center space-y-1 pb-4 text-center">
        {/* Branding */}
        <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-sm">
          <IconNetwork className="size-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Nexus<span className="text-muted-foreground">CRM</span>
        </CardTitle>
        <CardDescription className="text-sm">
          Create your account to get started
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Global submission error */}
          {submitError && (
            <div
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {submitError}
            </div>
          )}

          {/* Full Name Field */}
          <div className="space-y-2">
            <Label htmlFor="signup-fullname">Full Name</Label>
            <Input
              id="signup-fullname"
              type="text"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={handleChange('fullName')}
              disabled={isSubmitting}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'fullname-error' : undefined}
              autoComplete="name"
              autoFocus
            />
            {errors.fullName && (
              <p id="fullname-error" className="text-xs font-medium text-destructive">
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={handleChange('email')}
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              autoComplete="email"
            />
            {errors.email && (
              <p id="email-error" className="text-xs font-medium text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword1 ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange('password')}
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword1((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword1 ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword1 ? (
                  <IconEyeOff className="size-4" />
                ) : (
                  <IconEye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs font-medium text-destructive">
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="signup-confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="signup-confirm-password"
                type={showPassword2 ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                disabled={isSubmitting}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword ? 'confirm-password-error' : undefined
                }
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword2((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword2 ? 'Hide confirm password' : 'Show confirm password'}
                tabIndex={-1}
              >
                {showPassword2 ? (
                  <IconEyeOff className="size-4" />
                ) : (
                  <IconEye className="size-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p
                id="confirm-password-error"
                className="text-xs font-medium text-destructive"
              >
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="size-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </Button>

          {/* Sign-in link */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign In
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
