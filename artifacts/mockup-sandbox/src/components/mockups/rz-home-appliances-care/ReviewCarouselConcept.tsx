import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck, Star } from 'lucide-react';
import './_group.css';

const reviews = [
  {
    id: 'sample-1',
    rating: 5,
    message: 'They diagnosed the refrigerator quickly, explained the repair clearly, and had it cooling again the same day.',
    name: 'Customer A',
    appliance: 'Refrigerator',
  },
  {
    id: 'sample-2',
    rating: 5,
    message: 'Professional service from the first call. The technician arrived on time and took care to keep the work area clean.',
    name: 'Customer B',
    appliance: 'Washing machine',
  },
  {
    id: 'sample-3',
    rating: 5,
    message: 'The issue was fixed without replacing parts that were still working. I appreciated the honest advice.',
    name: 'Customer C',
    appliance: 'Microwave',
  },
  {
    id: 'sample-4',
    rating: 5,
    message: 'Our washer had a persistent drainage problem. The repair was careful and the price was explained before work began.',
    name: 'Customer D',
    appliance: 'Washing machine',
  },
  {
    id: 'sample-5',
    rating: 5,
    message: 'Quick, courteous, and easy to coordinate. The refrigerator has been running smoothly since the visit.',
    name: 'Customer E',
    appliance: 'Refrigerator',
  },
  {
    id: 'sample-6',
    rating: 5,
    message: 'Clear communication, careful troubleshooting, and a repair that held up. I would recommend the team to a neighbor.',
    name: 'Customer F',
    appliance: 'Dishwasher',
  },
];

function getVisibleCount() {
  if (window.matchMedia('(min-width: 1024px)').matches) return 3;
  if (window.matchMedia('(min-width: 768px)').matches) return 2;
  return 1;
}

export function ReviewCarouselConcept() {
  const [visibleCount, setVisibleCount] = useState(getVisibleCount);
  const [activePage, setActivePage] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => {
    const result: typeof reviews[] = [];
    for (let index = 0; index < reviews.length; index += visibleCount) {
      result.push(reviews.slice(index, index + visibleCount));
    }
    return result;
  }, [visibleCount]);
  const paginationPages = useMemo(() => {
    const dotLimit = visibleCount === 1 ? 3 : visibleCount === 2 ? 5 : 7;
    if (pages.length <= dotLimit) return Array.from({ length: pages.length }, (_, index) => index);
    const firstPage = Math.max(0, Math.min(activePage - Math.floor(dotLimit / 2), pages.length - dotLimit));
    return Array.from({ length: dotLimit }, (_, index) => firstPage + index);
  }, [activePage, pages.length, visibleCount]);

  useEffect(() => {
    const handleResize = () => setVisibleCount(getVisibleCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0, behavior: 'auto' });
    setActivePage(0);
  }, [visibleCount]);

  const goToPage = (page: number) => {
    trackRef.current?.scrollTo({
      left: page * (trackRef.current?.clientWidth ?? 0),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    setActivePage(page);
  };

  return (
    <section className="min-h-screen bg-[hsl(215_48%_14%)] px-5 py-16 text-[hsl(210_40%_98%)] sm:px-8 sm:py-20">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[hsl(184_85%_64%)]">REAL WORDS FROM REAL HOMES</p>
            <h2 className="mt-4 max-w-[12ch] text-[clamp(2.7rem,5.3vw,4.8rem)] font-extrabold leading-[0.94] tracking-[-0.075em]">What Our Customers Say</h2>
          </div>
          <p className="max-w-[21rem] text-[0.92rem] leading-[1.7] text-[hsl(215_24%_76%)]">The best measure of a careful repair is how it feels after we leave.</p>
        </div>
        <div className="mt-10 min-w-0">
          <div
            aria-label="Customer reviews"
            aria-roledescription="carousel"
            className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth motion-reduce:scroll-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={(event) => {
              const width = event.currentTarget.clientWidth;
              if (width) setActivePage(Math.min(pages.length - 1, Math.round(event.currentTarget.scrollLeft / width)));
            }}
            ref={trackRef}
            role="region"
            tabIndex={pages.length > 1 ? 0 : undefined}
          >
            {pages.map((page, pageIndex) => (
              <div aria-label={`Review group ${pageIndex + 1} of ${pages.length}`} aria-roledescription="slide" className="w-full min-w-0 shrink-0 snap-start" key={pageIndex}>
                <div className="grid h-full grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {page.map((review) => (
                    <article className="flex min-h-[18rem] min-w-0 flex-col rounded-[1.7rem] border border-[hsl(215_25%_30%)] bg-[hsl(215_42%_19%)] p-5 transition-colors duration-200 hover:border-[hsl(184_85%_64%/0.58)] sm:p-6" key={review.id}>
                      <div className="flex items-center justify-between gap-3">
                        <span aria-label={`${review.rating} out of 5 stars`} className="inline-flex gap-0.5 text-[hsl(39_86%_60%)]">
                          {[1, 2, 3, 4, 5].map((value) => <Star aria-hidden="true" className={`size-4 ${value <= review.rating ? 'fill-current' : 'text-[hsl(215_25%_36%)]'}`} key={value} />)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(174_54%_28%)] px-2.5 py-1.5 text-[0.62rem] font-extrabold text-[hsl(174_54%_86%)]">
                          <ShieldCheck aria-hidden="true" className="size-3.5" /> Verified Customer
                        </span>
                      </div>
                      <blockquote className="mt-5 break-words text-[0.96rem] font-semibold leading-[1.6] text-[hsl(210_40%_98%)]">“{review.message}”</blockquote>
                      <div className="mt-auto border-t border-[hsl(215_25%_30%)] pt-4">
                        <p className="text-[0.78rem] font-extrabold text-[hsl(184_85%_72%)]">{review.name}</p>
                        <p className="mt-1 text-[0.72rem] text-[hsl(215_24%_72%)]">{review.appliance}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {pages.length > 1 ? (
            <div className="mt-6 flex items-center justify-between gap-4">
              <p aria-live="polite" className="text-xs font-semibold text-[hsl(215_24%_76%)]">
                Showing {activePage * visibleCount + 1}–{Math.min((activePage + 1) * visibleCount, reviews.length)} of {reviews.length}
              </p>
              <div aria-label="Customer reviews pagination" className="flex items-center gap-2" role="group">
                <button aria-label="Previous reviews" className="flex size-10 items-center justify-center rounded-full border border-[hsl(215_25%_36%)] text-[hsl(210_40%_98%)] transition hover:border-[hsl(184_85%_64%)] hover:text-[hsl(184_85%_72%)] disabled:opacity-40" disabled={activePage === 0} onClick={() => goToPage(Math.max(0, activePage - 1))} type="button">
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </button>
                <div className="flex items-center gap-1.5">
                  {paginationPages.map((pageIndex) => (
                    <button
                      aria-current={activePage === pageIndex ? 'page' : undefined}
                      aria-label={`Show reviews ${pageIndex * visibleCount + 1}–${Math.min((pageIndex + 1) * visibleCount, reviews.length)}`}
                      className={`min-h-10 min-w-10 rounded-full p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] ${activePage === pageIndex ? 'bg-[hsl(184_85%_64%)]' : 'hover:bg-white/10'}`}
                      key={pageIndex}
                      onClick={() => goToPage(pageIndex)}
                      type="button"
                    >
                      <span aria-hidden="true" className={`mx-auto block size-2 rounded-full ${activePage === pageIndex ? 'bg-[hsl(215_74%_20%)]' : 'bg-[hsl(215_24%_58%)]'}`} />
                    </button>
                  ))}
                </div>
                <button aria-label="Next reviews" className="flex size-10 items-center justify-center rounded-full border border-[hsl(215_25%_36%)] text-[hsl(210_40%_98%)] transition hover:border-[hsl(184_85%_64%)] hover:text-[hsl(184_85%_72%)] disabled:opacity-40" disabled={activePage === pages.length - 1} onClick={() => goToPage(Math.min(pages.length - 1, activePage + 1))} type="button">
                  <ChevronRight aria-hidden="true" className="size-5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <a className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-[hsl(184_85%_64%)] px-4 text-[0.78rem] font-extrabold text-[hsl(184_85%_78%)] transition hover:bg-[hsl(184_85%_64%)] hover:text-[hsl(215_74%_20%)]" href="#">
          View All Reviews
        </a>
      </div>
    </section>
  );
}