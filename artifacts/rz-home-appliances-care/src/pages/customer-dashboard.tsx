import { useEffect, useRef, useState } from 'react';
import {
  useGetCustomerBookings,
  useAuthLogout,
  useAuthMe,
  useGetCustomerRepairRequests,
  getGetCustomerReviewEligibleQueryKey,
  useGetCustomerReviewEligible,
} from '@workspace/api-client-react';
import { ArrowRight, CalendarDays, Clock3, House, LoaderCircle, LogOut, X } from 'lucide-react';

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function getErrorMessage(
  error: unknown,
  fallback = 'We could not load your repair requests. Please try again.',
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 401
  ) {
    return 'Please sign in to view your repair requests.';
  }

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

function formatStatus(status: string): string {
  return status
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBookingDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T12:00:00`));
}

export function CustomerDashboardPage() {
  const authMeQuery = useAuthMe({
    query: {
      queryKey: ['auth-me'],
      retry: false,
    },
  });
  const requestsQuery = useGetCustomerRepairRequests({
    query: {
      queryKey: ['customer-repair-requests'],
      retry: false,
    },
  });
  const bookingsQuery = useGetCustomerBookings({
    query: {
      queryKey: ['customer-bookings'],
      retry: false,
    },
  });
  const reviewEligibleQuery = useGetCustomerReviewEligible({
    query: {
      queryKey: getGetCustomerReviewEligibleQueryKey(),
      enabled: authMeQuery.data?.authenticated === true,
      retry: false,
    },
  });
  const logout = useAuthLogout();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const cancelSignOutButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (
      getErrorStatus(requestsQuery.error) !== 401 &&
      getErrorStatus(bookingsQuery.error) !== 401 &&
      getErrorStatus(reviewEligibleQuery.error) !== 401 &&
      !(authMeQuery.isSuccess && !authMeQuery.data.authenticated)
    ) {
      return;
    }
    window.location.replace(appPath('/sign-in'));
  }, [
    authMeQuery.data,
    authMeQuery.isSuccess,
    bookingsQuery.error,
    reviewEligibleQuery.error,
    requestsQuery.error,
  ]);

  useEffect(() => {
    if (!isSignOutDialogOpen) return;

    cancelSignOutButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !logout.isPending) {
        setIsSignOutDialogOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSignOutDialogOpen, logout.isPending]);

  const confirmSignOut = () => {
    logout.mutate(undefined, {
      onSettled: () => window.location.replace(appPath('/')),
    });
  };

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-6 text-[hsl(215_32%_14%)] sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex flex-col gap-5 border-b border-[hsl(215_35%_86%)] py-2 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <a
              aria-label="RZ Home Appliances Care home"
              className="inline-flex w-fit items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-4"
              href={appPath('/')}
            >
              <span className="flex size-10 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white shadow-[0_8px_18px_-10px_hsl(215_82%_38%/0.9)]">
                <House aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block text-[0.92rem] font-extrabold tracking-[-0.02em] text-[hsl(215_32%_19%)]">RZ Home Appliances</span>
                <span className="mt-0.5 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care customer portal</span>
              </span>
            </a>
            {authMeQuery.data?.authenticated && authMeQuery.data.user ? (
              <a
                className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-[0.78rem] font-extrabold text-white shadow-[0_14px_24px_-18px_hsl(215_82%_30%/0.9)] transition hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2"
                href={appPath('/book-repair')}
              >
                Book a Repair
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              aria-label="Back to website and sign out"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:-translate-y-0.5 hover:border-[hsl(199_82%_52%)] hover:bg-[hsl(199_82%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={logout.isPending}
              onClick={() => setIsSignOutDialogOpen(true)}
              type="button"
            >
              Back to Website
            </button>
            <button
              aria-label="Sign out"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-4 text-[0.78rem] font-extrabold text-white shadow-[0_14px_24px_-18px_hsl(215_82%_30%/0.9)] transition hover:-translate-y-0.5 hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={logout.isPending}
              onClick={() => setIsSignOutDialogOpen(true)}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign Out
            </button>
          </div>
        </header>

        <section aria-labelledby="customer-dashboard-heading" className="pt-10 sm:pt-14">
          <p className="text-[clamp(1.55rem,3vw,2.35rem)] font-extrabold leading-[1.08] tracking-[-0.055em] text-[hsl(215_74%_28%)]">
              {authMeQuery.data?.user?.fullName?.trim()
              ? `Good to see you, ${authMeQuery.data.user.fullName.trim()}!`
              : 'Good to see you!'}
          </p>
          <p className="mt-2 text-[0.95rem] leading-[1.65] text-[hsl(215_20%_45%)]">
            Here’s an overview of your repair requests.
          </p>
          <h1
            className="mt-9 text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-[0.96] tracking-[-0.075em] text-[hsl(215_32%_14%)]"
            data-testid="heading-customer-dashboard"
            id="customer-dashboard-heading"
          >
            My Repair Requests
          </h1>
          <p className="mt-5 max-w-[38rem] text-[1rem] leading-[1.7] text-[hsl(215_20%_45%)]">
            Track and manage your submitted repair requests.
          </p>
        </section>

        <section aria-live="polite" className="mt-9 grid gap-5" data-testid="customer-repair-requests">
          {requestsQuery.isPending ? (
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-[hsl(215_35%_82%/0.8)] bg-white p-6 text-[0.9rem] font-semibold text-[hsl(215_20%_48%)]">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-[hsl(199_82%_43%)]" />
              Loading your repair requests...
            </div>
          ) : requestsQuery.isError ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-[0.9rem] font-semibold leading-[1.6] text-red-700" data-testid="customer-repair-requests-error">
              {getErrorMessage(requestsQuery.error)}
            </div>
          ) : requestsQuery.data.length === 0 ? (
            <div className="rounded-[1.5rem] border border-[hsl(215_35%_82%/0.8)] bg-white p-8 text-[0.98rem] font-semibold text-[hsl(215_20%_45%)]" data-testid="customer-repair-requests-empty">
              No repair requests found yet.
            </div>
          ) : (
            requestsQuery.data.map((request) => (
              <article
                className="rounded-[1.5rem] border border-[hsl(215_35%_82%/0.8)] bg-white p-6 shadow-[0_20px_45px_-34px_hsl(215_53%_23%/0.6)] sm:p-7"
                data-testid={`repair-request-${request.requestId}`}
                key={request.requestId}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_90%)] pb-5">
                  <div>
                    <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(215_20%_52%)]">
                      Request ID
                    </p>
                    <h2 className="mt-1 text-[1.05rem] font-extrabold text-[hsl(215_74%_28%)]">
                      {request.requestId}
                    </h2>
                  </div>
                  <span className="rounded-full bg-[hsl(199_82%_92%)] px-3 py-1.5 text-[0.72rem] font-extrabold text-[hsl(215_74%_28%)]">
                    {formatStatus(request.status)}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(215_20%_52%)]">
                    Appliance
                  </p>
                  <p className="mt-1 text-[1.1rem] font-extrabold text-[hsl(215_32%_19%)]">
                    {request.applianceType}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-[0.94rem] leading-[1.7] text-[hsl(215_20%_40%)]">
                    {request.problemDescription}
                  </p>
                </div>

                <dl className="mt-6 grid gap-4 border-t border-[hsl(215_35%_90%)] pt-5 text-[0.84rem] sm:grid-cols-3">
                  <div>
                    <dt className="font-extrabold uppercase tracking-[0.12em] text-[0.62rem] text-[hsl(215_20%_52%)]">Submitted</dt>
                    <dd className="mt-1 font-semibold text-[hsl(215_32%_28%)]">{formatSubmittedAt(request.createdAt)}</dd>
                  </div>
                  {request.preferredDate ? (
                    <div>
                      <dt className="flex items-center gap-1 font-extrabold uppercase tracking-[0.12em] text-[0.62rem] text-[hsl(215_20%_52%)]"><CalendarDays aria-hidden="true" className="size-3" /> Preferred date</dt>
                      <dd className="mt-1 font-semibold text-[hsl(215_32%_28%)]">{request.preferredDate}</dd>
                    </div>
                  ) : null}
                  {request.preferredTime ? (
                    <div>
                      <dt className="flex items-center gap-1 font-extrabold uppercase tracking-[0.12em] text-[0.62rem] text-[hsl(215_20%_52%)]"><Clock3 aria-hidden="true" className="size-3" /> Preferred time</dt>
                      <dd className="mt-1 font-semibold text-[hsl(215_32%_28%)]">{request.preferredTime}</dd>
                    </div>
                  ) : null}
                </dl>
                {request.status === 'completed' ? (() => {
                  const review = reviewEligibleQuery.data?.find((item) => item.sourceType === 'repair_request' && item.sourceId === request.requestId);
                  return review ? (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(215_35%_90%)] pt-5">
                      <p className="text-[0.78rem] font-semibold text-[hsl(215_20%_48%)]">{review.reviewSubmitted ? 'Your feedback is with our team.' : 'Had a completed repair? Tell us how it went.'}</p>
                      <a className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[0.78rem] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] ${review.reviewSubmitted ? 'border border-[hsl(215_35%_82%)] text-[hsl(215_20%_48%)]' : 'bg-[hsl(215_82%_38%)] text-white hover:bg-[hsl(215_82%_32%)]'}`} data-testid={`link-review-request-${request.requestId}`} href={`${appPath('/customer/review')}?requestId=${encodeURIComponent(request.requestId)}`}>
                        {review.reviewSubmitted ? 'Review Submitted' : 'Leave a Review'} <ArrowRight aria-hidden="true" className="size-4" />
                      </a>
                    </div>
                  ) : null;
                })() : null}
              </article>
            ))
          )}
        </section>

        <section aria-labelledby="customer-bookings-heading" className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(188_75%_43%)]">
                APPOINTMENTS
              </p>
              <h2
                className="mt-2 text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[0.98] tracking-[-0.065em] text-[hsl(215_32%_14%)]"
                id="customer-bookings-heading"
              >
                My Bookings
              </h2>
            </div>
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:-translate-y-0.5 hover:border-[hsl(199_82%_52%)] hover:bg-[hsl(199_82%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]"
              href={appPath('/book-repair')}
            >
              New booking
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </div>

          <div aria-live="polite" className="mt-7 grid gap-5" data-testid="customer-bookings">
            {bookingsQuery.isPending ? (
              <div className="flex items-center gap-3 rounded-[1.5rem] border border-[hsl(215_35%_82%/0.8)] bg-white p-6 text-[0.9rem] font-semibold text-[hsl(215_20%_48%)]">
                <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-[hsl(199_82%_43%)]" />
                Loading your bookings...
              </div>
            ) : bookingsQuery.isError ? (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-[0.9rem] font-semibold leading-[1.6] text-red-700">
                {getErrorMessage(bookingsQuery.error, 'We could not load your bookings. Please try again.')}
              </div>
            ) : bookingsQuery.data.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[hsl(215_35%_82%/0.8)] bg-white p-8 text-[0.98rem] font-semibold text-[hsl(215_20%_45%)]">
                No bookings found yet. Use Book a Repair when you are ready.
              </div>
            ) : (
              bookingsQuery.data.map((booking) => (
                <article
                  className="rounded-[1.5rem] border border-[hsl(215_35%_82%/0.8)] bg-white p-6 shadow-[0_20px_45px_-34px_hsl(215_53%_23%/0.6)] sm:p-7"
                  data-testid={`booking-${booking.bookingId}`}
                  key={booking.bookingId}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(215_35%_90%)] pb-5">
                    <div>
                      <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(215_20%_52%)]">
                        Booking ID
                      </p>
                      <h3 className="mt-1 text-[1.05rem] font-extrabold text-[hsl(215_74%_28%)]">
                        {booking.bookingId}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[hsl(199_82%_92%)] px-3 py-1.5 text-[0.72rem] font-extrabold text-[hsl(215_74%_28%)]">
                      {formatStatus(booking.status)}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(215_20%_52%)]">
                      Appliance / service
                    </p>
                    <p className="mt-1 text-[1.1rem] font-extrabold text-[hsl(215_32%_19%)]">
                      {booking.applianceType}
                    </p>
                    <p className="mt-4 whitespace-pre-wrap text-[0.94rem] leading-[1.7] text-[hsl(215_20%_40%)]">
                      {booking.problemDescription}
                    </p>
                  </div>

                  <dl className="mt-6 grid gap-4 border-t border-[hsl(215_35%_90%)] pt-5 text-[0.84rem] sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="font-extrabold uppercase tracking-[0.12em] text-[0.62rem] text-[hsl(215_20%_52%)]">Appointment</dt>
                      <dd className="mt-1 font-semibold text-[hsl(215_32%_28%)]">{formatBookingDate(booking.preferredDate)} · {booking.preferredTime}</dd>
                    </div>
                    <div>
                      <dt className="font-extrabold uppercase tracking-[0.12em] text-[0.62rem] text-[hsl(215_20%_52%)]">Submitted</dt>
                      <dd className="mt-1 font-semibold text-[hsl(215_32%_28%)]">{formatSubmittedAt(booking.createdAt)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-extrabold uppercase tracking-[0.12em] text-[0.62rem] text-[hsl(215_20%_52%)]">Service location</dt>
                      <dd className="mt-1 whitespace-pre-wrap font-semibold text-[hsl(215_32%_28%)]">{booking.address}</dd>
                    </div>
                  </dl>
                  {booking.additionalNotes ? (
                    <p className="mt-5 border-t border-[hsl(215_35%_90%)] pt-5 text-[0.84rem] leading-[1.6] text-[hsl(215_20%_45%)]">
                      <span className="font-extrabold text-[hsl(215_32%_28%)]">Additional notes: </span>
                      {booking.additionalNotes}
                    </p>
                  ) : null}
                  {booking.status === 'completed' ? (() => {
                    const review = reviewEligibleQuery.data?.find((item) => item.sourceType === 'booking' && item.sourceId === booking.bookingId);
                    return review ? (
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(215_35%_90%)] pt-5">
                        <p className="text-[0.78rem] font-semibold text-[hsl(215_20%_48%)]">{review.reviewSubmitted ? 'Your feedback is with our team.' : 'Had a completed booking? Tell us how it went.'}</p>
                        <a className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[0.78rem] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] ${review.reviewSubmitted ? 'border border-[hsl(215_35%_82%)] text-[hsl(215_20%_48%)]' : 'bg-[hsl(215_82%_38%)] text-white hover:bg-[hsl(215_82%_32%)]'}`} data-testid={`link-review-booking-${booking.bookingId}`} href={`${appPath('/customer/review')}?bookingId=${encodeURIComponent(booking.bookingId)}`}>
                          {review.reviewSubmitted ? 'Review Submitted' : 'Leave a Review'} <ArrowRight aria-hidden="true" className="size-4" />
                        </a>
                      </div>
                    ) : null;
                  })() : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {isSignOutDialogOpen ? (
        <div
          aria-labelledby="sign-out-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(215_32%_14%/0.48)] px-5 py-6 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-[26rem] rounded-[1.6rem] border border-[hsl(215_35%_82%)] bg-white p-6 shadow-[0_30px_80px_-28px_hsl(215_53%_23%/0.65)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-[hsl(188_75%_43%)]">Account</p>
                <h2 className="mt-2 text-[1.35rem] font-extrabold tracking-[-0.035em] text-[hsl(215_32%_14%)]" id="sign-out-dialog-title">
                  Sign out
                </h2>
              </div>
              <button
                aria-label="Close sign out confirmation"
                className="inline-flex size-9 items-center justify-center rounded-xl text-[hsl(215_20%_48%)] transition hover:bg-[hsl(210_40%_96%)] hover:text-[hsl(215_74%_28%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logout.isPending}
                onClick={() => setIsSignOutDialogOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <p className="mt-4 text-[0.95rem] leading-[1.65] text-[hsl(215_20%_42%)]">
              Are you sure you want to sign out?
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[hsl(215_35%_82%)] px-5 text-[0.82rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:bg-[hsl(210_40%_97%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logout.isPending}
                onClick={() => setIsSignOutDialogOpen(false)}
                ref={cancelSignOutButtonRef}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[hsl(215_82%_38%)] px-5 text-[0.82rem] font-extrabold text-white transition hover:bg-[hsl(215_82%_32%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logout.isPending}
                onClick={confirmSignOut}
                type="button"
              >
                {logout.isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                {logout.isPending ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}