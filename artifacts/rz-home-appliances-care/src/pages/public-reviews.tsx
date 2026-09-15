import { useGetPublicReviews, getGetPublicReviewsQueryKey } from '@workspace/api-client-react';
import { ArrowLeft, CheckCircle2, House, LoaderCircle, Star } from 'lucide-react';
import { useLocation } from 'wouter';

function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path === '/' ? '/' : path}`;
}

export function PublicReviewsPage() {
  const [, setLocation] = useLocation();
  const reviewsQuery = useGetPublicReviews(
    { limit: 100 },
    { query: { queryKey: getGetPublicReviewsQueryKey({ limit: 100 }), retry: false } },
  );

  return (
    <main className="min-h-[100dvh] bg-[hsl(210_40%_98%)] px-5 py-6 text-[hsl(215_32%_14%)] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="flex items-center justify-between gap-4 border-b border-[hsl(215_35%_86%)] pb-6">
          <a className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]" href={appPath('/')}>
            <span className="flex size-10 items-center justify-center rounded-[0.9rem] bg-[hsl(215_82%_38%)] text-white"><House aria-hidden="true" className="size-5" /></span>
            <span>
              <span className="block text-[0.92rem] font-extrabold text-[hsl(215_32%_19%)]">RZ Home Appliances</span>
              <span className="mt-0.5 block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[hsl(215_20%_48%)]">Care customer stories</span>
            </span>
          </a>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[hsl(215_35%_82%)] bg-white px-4 text-[0.78rem] font-extrabold text-[hsl(215_74%_28%)] transition hover:border-[hsl(199_82%_52%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(211_100%_73%)]" onClick={() => setLocation('/')} type="button">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to home
          </button>
        </header>

        <section aria-labelledby="all-reviews-heading" className="py-14 sm:py-20">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(188_75%_43%)]">REAL WORDS FROM REAL HOMES</p>
          <h1 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,6vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.075em] text-[hsl(215_74%_28%)]" id="all-reviews-heading">What Our Customers Say</h1>
          <p className="mt-5 max-w-[38rem] text-[0.98rem] leading-[1.75] text-[hsl(215_20%_45%)]">Feedback from customers who trusted RZ Home Appliances Care with the appliances their homes rely on every day.</p>

          <div aria-live="polite" className="mt-12">
            {reviewsQuery.isPending ? (
              <div className="flex min-h-56 items-center justify-center rounded-[1.6rem] border border-[hsl(215_35%_86%)] bg-white"><LoaderCircle aria-hidden="true" className="size-6 animate-spin text-[hsl(199_82%_43%)]" /></div>
            ) : reviewsQuery.isError ? (
              <div className="rounded-[1.6rem] border border-[hsl(4_62%_78%)] bg-[hsl(4_80%_97%)] p-7 text-sm font-semibold text-[hsl(4_62%_40%)]" role="alert">Reviews are unavailable right now. Please check back soon.</div>
            ) : reviewsQuery.data.length === 0 ? (
              <div className="rounded-[1.6rem] border border-[hsl(215_35%_86%)] bg-white p-10 text-center text-[0.95rem] font-semibold text-[hsl(215_20%_48%)]">Our customer reviews will appear here soon.</div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {reviewsQuery.data.map((review) => (
                  <article className="rounded-[1.7rem] border border-[hsl(215_35%_86%)] bg-white p-6 shadow-[0_18px_48px_-38px_hsl(215_53%_23%/0.5)] sm:p-7" key={review.reviewId}>
                    <div className="flex items-center justify-between gap-4">
                      <div aria-label={`${review.rating} out of 5 stars`} className="flex gap-1 text-[hsl(39_92%_53%)]">
                        {[1, 2, 3, 4, 5].map((star) => <Star aria-hidden="true" className={`size-4 ${star <= review.rating ? 'fill-current' : 'text-[hsl(215_35%_86%)]'}`} key={star} />)}
                      </div>
                      {review.isVerified ? <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(151_55%_92%)] px-2.5 py-1 text-[0.64rem] font-extrabold uppercase tracking-[0.08em] text-[hsl(150_55%_28%)]"><CheckCircle2 className="size-3.5" /> Verified Customer</span> : null}
                    </div>
                    <blockquote className="mt-6 text-[1.05rem] font-semibold leading-[1.65] text-[hsl(215_32%_22%)]">“{review.reviewMessage}”</blockquote>
                    <footer className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[hsl(215_35%_91%)] pt-5 text-[0.76rem] font-bold text-[hsl(215_20%_48%)]">
                      <span className="text-[hsl(215_74%_28%)]">{review.customerLabel}</span>
                      {review.applianceType ? <><span aria-hidden="true">·</span><span>{review.applianceType}</span></> : null}
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}