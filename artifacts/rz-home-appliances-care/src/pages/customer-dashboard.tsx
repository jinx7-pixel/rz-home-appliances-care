import { useGetCustomerRepairRequests } from '@workspace/api-client-react';
import { CalendarDays, Clock3, LoaderCircle } from 'lucide-react';

function getErrorMessage(error: unknown): string {
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

  return 'We could not load your repair requests. Please try again.';
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

export function CustomerDashboardPage() {
  const requestsQuery = useGetCustomerRepairRequests({
    query: {
      queryKey: ['customer-repair-requests'],
      retry: false,
    },
  });

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-6 text-[hsl(215_32%_14%)] sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto w-full max-w-[980px]">
        <section aria-labelledby="customer-dashboard-heading" className="pt-12 sm:pt-16">
          <h1
            className="text-[clamp(2.7rem,6vw,5rem)] font-extrabold leading-[0.96] tracking-[-0.075em] text-[hsl(215_32%_14%)]"
            data-testid="heading-customer-dashboard"
            id="customer-dashboard-heading"
          >
            My Repair Requests
          </h1>
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
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}