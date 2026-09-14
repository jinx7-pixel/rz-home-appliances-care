import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  useAuthForgotPassword,
  useAuthLogin,
  useAuthLogout,
  useAuthResetPassword,
  useAuthSignup,
} from '@workspace/api-client-react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  House,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

type FieldErrors = Record<string, string | undefined>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
    ) {
      return (data as { error: string }).error;
    }
  }

  return fallback;
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-[hsl(210_40%_98%)] shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]"
    >
      <House className="size-[1.25rem] stroke-[1.8]" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-[1.05rem] items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]">
        <ShieldCheck className="size-[0.65rem] stroke-[2.4] text-[hsl(215_74%_28%)]" />
      </span>
    </span>
  );
}

function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-4 py-5 text-[hsl(215_32%_14%)] sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[760px] flex-col">
        <header className="flex items-center justify-between gap-5 pb-8">
          <a
            aria-label="RZ Home Appliances Care home"
            className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(210_40%_98%)]"
            href={appPath('/')}
          >
            <BrandMark />
            <span>
              <span className="block text-[0.95rem] font-extrabold tracking-[-0.02em] text-[hsl(215_32%_19%)] transition-colors group-hover:text-[hsl(215_82%_38%)] sm:text-[1.02rem]">
                RZ Home Appliances
              </span>
              <span className="mt-0.5 block text-[0.63rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">
                Care
              </span>
            </span>
          </a>
          <a
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[0.8rem] font-bold text-[hsl(215_74%_28%)] transition-colors hover:text-[hsl(215_82%_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4 focus-visible:ring-offset-[hsl(210_40%_98%)] sm:px-4 sm:text-[0.86rem]"
            href={appPath('/')}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to home
          </a>
        </header>

        <section className="flex flex-1 items-start justify-center">
          <div className="w-full rounded-[2rem] border border-[hsl(215_35%_82%/0.85)] bg-white p-6 shadow-[0_30px_70px_-45px_hsl(215_53%_23%/0.55)] sm:rounded-[2.5rem] sm:p-10 lg:p-12">
            <div className="mx-auto max-w-[34rem]">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">
                {eyebrow}
              </p>
              <h1 className="mt-4 text-[clamp(2.5rem,7vw,4.6rem)] font-extrabold leading-[0.96] tracking-[-0.075em] text-[hsl(215_32%_14%)]">
                {title}
              </h1>
              <p className="mt-5 text-[0.98rem] leading-[1.7] text-[hsl(215_20%_45%)]">
                {description}
              </p>
              <div className="mt-8">{children}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FormMessage({
  message,
  tone = 'error',
}: {
  message: string;
  tone?: 'error' | 'success';
}) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-[0.82rem] font-semibold leading-[1.5] ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {message}
    </p>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-2">
        <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
        <input
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-12 text-[0.95rem] text-[hsl(215_32%_19%)] outline-none transition placeholder:text-[hsl(215_20%_61%)] focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${error ? 'border-red-400 ring-2 ring-red-100' : 'border-[hsl(215_35%_82%)]'}`}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-[hsl(215_74%_28%)] transition-colors hover:bg-[hsl(199_82%_94%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {error ? <p className="mt-2 text-[0.78rem] font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Please enter your email address.';
  if (!emailPattern.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Please enter a password.';
  if (password.length < 8 || password.length > 128) return 'Use 8–128 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one uppercase letter, one lowercase letter, and one number.';
  }
  return undefined;
}

export function SignInPage() {
  const login = useAuthLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    if (!password) nextErrors.password = 'Please enter your password.';
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) return;

    login.mutate(
      { data: { email: email.trim(), password, rememberMe } },
      {
        onSuccess: () => {
          window.location.assign(appPath('/customer-dashboard'));
        },
        onError: (error) => {
          setMessage(getApiErrorMessage(error, 'Invalid email or password.'));
        },
      },
    );
  };

  return (
    <AuthShell
      description="Sign in to your RZ Home Appliances Care account."
      eyebrow="YOUR RZ ACCOUNT"
      title="Welcome back"
    >
      <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="signin-email">
            Email address
          </label>
          <div className="relative mt-2">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
            <input
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 text-[0.95rem] outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.email ? 'border-red-400 ring-2 ring-red-100' : 'border-[hsl(215_35%_82%)]'}`}
              id="signin-email"
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
                setMessage('');
              }}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          {errors.email ? <p className="mt-2 text-[0.78rem] font-semibold text-red-600">{errors.email}</p> : null}
        </div>
        <PasswordField
          autoComplete="current-password"
          error={errors.password}
          id="signin-password"
          label="Password"
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
            setMessage('');
          }}
          value={password}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-[0.82rem]">
          <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-[hsl(215_20%_45%)]">
            <input checked={rememberMe} className="size-4 accent-[hsl(215_82%_38%)]" onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
            Remember me
          </label>
          <a className="font-extrabold text-[hsl(215_82%_38%)] hover:text-[hsl(215_82%_28%)]" href={appPath('/forgot-password')}>
            Forgot password?
          </a>
        </div>
        {message ? <FormMessage message={message} /> : null}
        <button
          className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.88rem] font-extrabold text-white shadow-[0_18px_28px_-18px_hsl(215_82%_30%/0.9)] transition hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={login.isPending}
          type="submit"
        >
          {login.isPending ? 'Signing in...' : 'Sign in'}
          {!login.isPending ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
        </button>
      </form>
      <p className="mt-7 text-center text-[0.86rem] text-[hsl(215_20%_45%)]">
        Don&apos;t have an account?{' '}
        <a className="font-extrabold text-[hsl(215_82%_38%)]" href={appPath('/sign-up')}>
          Create an account
        </a>
      </p>
    </AuthShell>
  );
}

export function SignUpPage() {
  const signup = useAuthSignup();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.';
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    setMessage('');
    setSuccess(false);
    if (Object.keys(nextErrors).length > 0) return;

    signup.mutate(
      {
        data: {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        },
      },
      {
        onSuccess: () => setSuccess(true),
        onError: (error) => setMessage(getApiErrorMessage(error, 'We could not create your account. Please try again.')),
      },
    );
  };

  return (
    <AuthShell
      description="Create an account to use RZ Home Appliances Care services."
      eyebrow="GET STARTED"
      title="Create your account"
    >
      {success ? (
        <div className="grid gap-4">
          <FormMessage message="Your account was created. You can now sign in." tone="success" />
          <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[hsl(215_82%_38%)] px-5 text-[0.84rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)]" href={appPath('/sign-in')}>
            Continue to sign in <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      ) : (
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="signup-name">Full name</label>
            <div className="relative mt-2">
              <UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
              <input aria-invalid={Boolean(errors.fullName)} autoComplete="name" className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.fullName ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="signup-name" onChange={(event) => setFullName(event.target.value)} required value={fullName} />
            </div>
            {errors.fullName ? <p className="mt-2 text-[0.78rem] font-semibold text-red-600">{errors.fullName}</p> : null}
          </div>
          <div>
            <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="signup-email">Email address</label>
            <div className="relative mt-2">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
              <input aria-invalid={Boolean(errors.email)} autoComplete="email" className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${errors.email ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="signup-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </div>
            {errors.email ? <p className="mt-2 text-[0.78rem] font-semibold text-red-600">{errors.email}</p> : null}
          </div>
          <PasswordField autoComplete="new-password" error={errors.password} id="signup-password" label="Password" onChange={setPassword} value={password} />
          <PasswordField autoComplete="new-password" error={errors.confirmPassword} id="signup-confirm-password" label="Confirm password" onChange={setConfirmPassword} value={confirmPassword} />
          <p className="text-[0.78rem] leading-[1.5] text-[hsl(215_20%_50%)]">Use 8–128 characters with an uppercase letter, lowercase letter, and number.</p>
          {message ? <FormMessage message={message} /> : null}
          <button className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.88rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)] disabled:cursor-not-allowed disabled:opacity-70" disabled={signup.isPending} type="submit">
            {signup.isPending ? 'Creating account...' : 'Create account'}
            {!signup.isPending ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
          </button>
        </form>
      )}
      <p className="mt-7 text-center text-[0.86rem] text-[hsl(215_20%_45%)]">
        Already have an account? <a className="font-extrabold text-[hsl(215_82%_38%)]" href={appPath('/sign-in')}>Sign in</a>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const forgotPassword = useAuthForgotPassword();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError ?? '');
    setSuccess('');
    if (emailError) return;
    forgotPassword.mutate(
      { data: { email: email.trim() } },
      {
        onSuccess: (result) => setSuccess(result.message),
        onError: (requestError) => setError(getApiErrorMessage(requestError, 'Please try again later.')),
      },
    );
  };

  return (
    <AuthShell description="Enter your email and we will send a secure reset link if an account exists." eyebrow="PASSWORD RECOVERY" title="Reset your password">
      {success ? <FormMessage message={success} tone="success" /> : (
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="text-[0.86rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="forgot-email">Email address</label>
            <div className="relative mt-2">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
              <input aria-invalid={Boolean(error)} autoComplete="email" className={`min-h-14 w-full rounded-2xl border bg-[hsl(210_40%_99%)] pl-11 pr-4 outline-none focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)] ${error ? 'border-red-400' : 'border-[hsl(215_35%_82%)]'}`} id="forgot-email" onChange={(event) => { setEmail(event.target.value); setError(''); }} required type="email" value={email} />
            </div>
            {error ? <p className="mt-2 text-[0.78rem] font-semibold text-red-600">{error}</p> : null}
          </div>
          <button className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.88rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)] disabled:cursor-not-allowed disabled:opacity-70" disabled={forgotPassword.isPending} type="submit">
            {forgotPassword.isPending ? 'Sending...' : 'Send reset link'}
            {!forgotPassword.isPending ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
          </button>
        </form>
      )}
      <p className="mt-7 text-center text-[0.86rem] text-[hsl(215_20%_45%)]"><a className="font-extrabold text-[hsl(215_82%_38%)]" href={appPath('/sign-in')}>Back to sign in</a></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const resetPassword = useAuthResetPassword();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const token = new URLSearchParams(window.location.search).get('token') ?? '';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const passwordError = validatePassword(password);
    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    resetPassword.mutate(
      { data: { token, password, confirmPassword } },
      {
        onSuccess: (result) => setSuccess(result.message),
        onError: (requestError) => setError(getApiErrorMessage(requestError, 'This reset link is invalid or has expired.')),
      },
    );
  };

  return (
    <AuthShell description="Choose a new password for your RZ Home Appliances Care account." eyebrow="SECURE RESET" title="Set a new password">
      {success ? <div className="grid gap-4"><FormMessage message={success} tone="success" /><a className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[hsl(215_82%_38%)] px-5 text-[0.84rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)]" href={appPath('/sign-in')}>Continue to sign in</a></div> : (
        <form className="grid gap-5" onSubmit={handleSubmit} noValidate>
          <PasswordField autoComplete="new-password" error={error} id="reset-password" label="New password" onChange={(value) => { setPassword(value); setError(''); }} value={password} />
          <PasswordField autoComplete="new-password" error={undefined} id="reset-confirm-password" label="Confirm new password" onChange={(value) => { setConfirmPassword(value); setError(''); }} value={confirmPassword} />
          <p className="text-[0.78rem] leading-[1.5] text-[hsl(215_20%_50%)]">Use 8–128 characters with an uppercase letter, lowercase letter, and number.</p>
          <button className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.88rem] font-extrabold text-white hover:bg-[hsl(215_82%_32%)] disabled:cursor-not-allowed disabled:opacity-70" disabled={resetPassword.isPending} type="submit">
            {resetPassword.isPending ? 'Resetting...' : 'Reset password'}
            {!resetPassword.isPending ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export function LogoutPage() {
  const logout = useAuthLogout();
  const hasStarted = useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    logout.mutate(
      undefined,
      {
        onSettled: () => window.location.replace(appPath('/')),
      },
    );
  }, [logout]);

  return <main className="flex min-h-[100dvh] items-center justify-center bg-[hsl(210_40%_98%)] text-sm font-semibold text-[hsl(215_20%_45%)]">Signing out...</main>;
}

export function CustomerDashboardPlaceholder() {
  return <main aria-label="Customer Dashboard" className="min-h-[100dvh] bg-[hsl(210_40%_98%)]" data-testid="customer-dashboard-placeholder" />;
}