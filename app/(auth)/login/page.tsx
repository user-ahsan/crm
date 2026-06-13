'use client';

import { useState, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconNetwork } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/* ── Validation ──────────────────────────────────────────── */
interface LoginFormData {
  email: string;
  password: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof LoginFormData, string>>;
}

function validateLoginForm(data: LoginFormData): ValidationResult {
  const errors: Partial<Record<keyof LoginFormData, string>> = {};

  if (!data.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (!data.password) {
    errors.password = 'Password is required';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/* ── Login Page ──────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ── Field change handler ───────────────────────────── */
  const handleChange = useCallback(
    (field: keyof LoginFormData) => (e: ChangeEvent<HTMLInputElement>) => {
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

  /* ── Submit handler (simulated auth) ────────────────── */
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);

      /* 1. Validate */
      const validation = validateLoginForm(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      /* 2. Simulate network request */
      setIsSubmitting(true);

      try {
        // Simulate auth delay
        await new Promise((resolve) => setTimeout(resolve, 1200));

        /* 3. Show success toast */
        toast.success('Welcome to NexusCRM!', {
          description: 'You have been signed in successfully.',
        });

        /* 4. Redirect to dashboard */
        router.push('/dashboard');
      } catch {
        setSubmitError('An unexpected error occurred. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, router],
  );

  /* ── Render ─────────────────────────────────────────── */
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
          Sign in to your account to continue
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

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={handleChange('email')}
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              autoComplete="email"
              autoFocus
            />
            {errors.email && (
              <p id="email-error" className="text-xs font-medium text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange('password')}
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              autoComplete="current-password"
            />
            {errors.password && (
              <p id="password-error" className="text-xs font-medium text-destructive">
                {errors.password}
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
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
