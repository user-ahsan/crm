'use client';

import { useState, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { IconNetwork, IconEye, IconEyeOff } from '@tabler/icons-react';
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
  const [showPassword, setShowPassword] = useState(false);

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

  /* ── Submit handler (real Supabase auth) ───────────── */
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

      /* 2. Authenticate via Supabase */
      setIsSubmitting(true);

      try {
        const supabase = await createClient();

        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          setSubmitError(error.message);
          return;
        }

        if (!data.user) {
          setSubmitError('Invalid credentials. Please try again.');
          return;
        }

        /* 3. Show success toast */
        toast.success('Welcome back!');

        /* 4. Redirect to dashboard */
        router.push('/dashboard');
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'An unexpected error occurred. Please try again.');
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
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange('password')}
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
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

          {/* Sign-up link */}
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
