import { useState, type FormEvent } from 'react';
import { useAdminAuthLogin } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, House, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useLocation } from 'wouter';

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return 'We could not verify those credentials. Check them and try again.';
}

function BrandMark() {
  return (
    <span aria-hidden="true" className="relative flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-[hsl(210_40%_98%)] shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]">
      <House className="size-5 stroke-[1.8]" />
      <span className="absolute -bottom-0.5 -right-0.5 flex size-[1.05rem] items-center justify-center rounded-full border-2 border-[hsl(210_40%_98%)] bg-[hsl(199_82%_62%)]">
        <ShieldCheck className="size-[0.65rem] stroke-[2.4] text-[hsl(215_74%_28%)]" />
      </span>
    </span>
  );
}

export function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const login = useAdminAuthLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    if (!username.trim() || !password) {
      setMessage('Enter your username and password to continue.');
      return;
    }

    login.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: () => setLocation('/admin/dashboard'),
        onError: (error) => setMessage(getErrorMessage(error)),
      },
    );
  };

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_97%)] px-4 py-5 text-[hsl(215_32%_14%)] sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-[1180px] items-stretch overflow-hidden rounded-[2rem] border border-[hsl(215_35%_84%/0.9)] bg-[hsl(204_100%_99%)] shadow-[0_32px_80px_-48px_hsl(215_53%_23%/0.65)] lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative hidden overflow-hidden bg-[hsl(215_48%_14%)] p-10 text-[hsl(210_40%_98%)] lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-24 size-[26rem] rounded-full border-[3rem] border-[hsl(199_82%_62%/0.1)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-[hsl(184_85%_64%/0.08)] blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-[0.9rem] bg-[hsl(199_82%_62%)] text-[hsl(215_74%_20%)]">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-[0.9rem] font-extrabold tracking-[-0.02em]">RZ Home Appliances</p>
                <p className="mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[hsl(215_24%_72%)]">Operations desk</p>
              </div>
            </div>
            <p className="mt-24 max-w-[12ch] text-[clamp(2.8rem,4vw,4.8rem)] font-extrabold leading-[0.92] tracking-[-0.08em]">
              Keep every request moving.
            </p>
            <p className="mt-7 max-w-[25rem] text-[0.93rem] leading-[1.75] text-[hsl(215_24%_75%)]">
              A private workspace for the team reviewing customer repair and contact requests.
            </p>
          </div>
          <div className="relative border-t border-[hsl(215_25%_31%)] pt-5 text-[0.73rem] font-semibold uppercase tracking-[0.16em] text-[hsl(184_85%_68%)]">
            <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-[hsl(184_85%_64%)]" /> Protected staff access</span>
          </div>
        </aside>

        <section className="flex flex-col p-6 sm:p-10 lg:p-12 xl:p-16" aria-labelledby="admin-login-heading">
          <header className="flex items-center justify-between gap-4">
            <a aria-label="RZ Home Appliances Care home" className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4" data-testid="link-admin-brand-home" href={appPath('/')}>
              <BrandMark />
              <span>
                <span className="block text-[0.93rem] font-extrabold tracking-[-0.02em] text-[hsl(215_32%_19%)] group-hover:text-[hsl(215_82%_38%)]">RZ Home Appliances</span>
                <span className="mt-0.5 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care</span>
              </span>
            </a>
            <a className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-[0.78rem] font-bold text-[hsl(215_74%_28%)] transition hover:text-[hsl(215_82%_38%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4" data-testid="link-admin-back-home" href={appPath('/')}>
              <ArrowLeft aria-hidden="true" className="size-4" /> Home
            </a>
          </header>

          <div className="my-auto w-full max-w-[30rem] py-12 lg:max-w-[31rem]">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">PRIVATE OPERATIONS</p>
            <h1 className="mt-4 text-[clamp(2.8rem,6vw,5rem)] font-extrabold leading-[0.93] tracking-[-0.08em] text-[hsl(215_32%_14%)]" id="admin-login-heading">Staff sign in</h1>
            <p className="mt-5 max-w-[27rem] text-[0.96rem] leading-[1.7] text-[hsl(215_20%_45%)]">Review customer requests, keep status current, and leave clear notes for the repair team.</p>

            <form className="mt-9 grid gap-5" noValidate onSubmit={handleSubmit}>
              <div>
                <label className="text-[0.82rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="admin-username">Username</label>
                <div className="relative mt-2">
                  <UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
                  <input autoComplete="username" className="min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] pl-11 pr-4 text-[0.95rem] outline-none transition focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]" data-testid="input-admin-username" id="admin-username" onChange={(event) => { setUsername(event.target.value); setMessage(''); }} required value={username} />
                </div>
              </div>
              <div>
                <label className="text-[0.82rem] font-extrabold text-[hsl(215_32%_28%)]" htmlFor="admin-password">Password</label>
                <div className="relative mt-2">
                  <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[hsl(215_20%_55%)]" />
                  <input autoComplete="current-password" className="min-h-14 w-full rounded-2xl border border-[hsl(215_35%_82%)] bg-[hsl(210_40%_99%)] pl-11 pr-12 text-[0.95rem] outline-none transition focus:border-[hsl(199_82%_52%)] focus:ring-2 focus:ring-[hsl(199_82%_62%/0.25)]" data-testid="input-admin-password" id="admin-password" onChange={(event) => { setPassword(event.target.value); setMessage(''); }} required type={showPassword ? 'text' : 'password'} value={password} />
                  <button aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-[hsl(215_74%_28%)] hover:bg-[hsl(199_82%_94%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]" data-testid="button-toggle-admin-password" onClick={() => setShowPassword((current) => !current)} type="button">
                    {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                  </button>
                </div>
              </div>
              {message ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[0.82rem] font-semibold leading-[1.5] text-red-700" data-testid="text-admin-login-error" role="alert">{message}</p> : null}
              <button className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[hsl(215_82%_38%)] px-6 text-[0.86rem] font-extrabold text-white shadow-[0_18px_28px_-18px_hsl(215_82%_30%/0.9)] transition hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70" data-testid="button-admin-sign-in" disabled={login.isPending} type="submit">
                {login.isPending ? 'Checking access...' : 'Enter operations desk'}
                {!login.isPending ? <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
              </button>
            </form>
          </div>
          <p className="text-[0.74rem] leading-[1.6] text-[hsl(215_20%_51%)]">This area is limited to authorized RZ Home Appliances Care staff.</p>
        </section>
      </div>
    </main>
  );
}