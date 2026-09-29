import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ReviewCarouselProps<T> = {
  items: readonly T[];
  ariaLabel: string;
  renderItem: (item: T) => ReactNode;
  testId?: string;
};

const MAX_VISIBLE_PAGINATION_DOTS = 7;

function getVisibleCardCount() {
  if (window.matchMedia('(min-width: 1024px)').matches) return 3;
  if (window.matchMedia('(min-width: 768px)').matches) return 2;
  return 1;
}

export function ReviewCarousel<T>({ items, ariaLabel, renderItem, testId }: ReviewCarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [cardsPerPage, setCardsPerPage] = useState(() => (
    typeof window === 'undefined' ? 1 : getVisibleCardCount()
  ));
  const previousCardsPerPage = useRef(cardsPerPage);
  const [activePage, setActivePage] = useState(0);

  const pages = useMemo(() => {
    const groups: T[][] = [];
    for (let index = 0; index < items.length; index += cardsPerPage) {
      groups.push(items.slice(index, index + cardsPerPage));
    }
    return groups;
  }, [cardsPerPage, items]);

  const paginationPages = useMemo(() => {
    const dotLimit = cardsPerPage === 1 ? 3 : cardsPerPage === 2 ? 5 : MAX_VISIBLE_PAGINATION_DOTS;
    if (pages.length <= dotLimit) {
      return Array.from({ length: pages.length }, (_, index) => index);
    }

    const firstPage = Math.max(
      0,
      Math.min(activePage - Math.floor(dotLimit / 2), pages.length - dotLimit),
    );
    return Array.from({ length: dotLimit }, (_, index) => firstPage + index);
  }, [activePage, cardsPerPage, pages.length]);

  useEffect(() => {
    const tabletQuery = window.matchMedia('(min-width: 768px)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const updateCardCount = () => {
      setCardsPerPage(desktopQuery.matches ? 3 : tabletQuery.matches ? 2 : 1);
    };

    tabletQuery.addEventListener('change', updateCardCount);
    desktopQuery.addEventListener('change', updateCardCount);
    updateCardCount();
    return () => {
      tabletQuery.removeEventListener('change', updateCardCount);
      desktopQuery.removeEventListener('change', updateCardCount);
    };
  }, []);

  useEffect(() => {
    const breakpointChanged = previousCardsPerPage.current !== cardsPerPage;
    previousCardsPerPage.current = cardsPerPage;
    if (breakpointChanged) {
      setActivePage(0);
      trackRef.current?.scrollTo({ left: 0, behavior: 'auto' });
      return;
    }
    if (pages.length > 0 && activePage >= pages.length) {
      const lastPage = pages.length - 1;
      setActivePage(lastPage);
      trackRef.current?.scrollTo({ left: lastPage * (trackRef.current?.clientWidth ?? 0), behavior: 'auto' });
    }
  }, [activePage, cardsPerPage, pages.length]);

  const goToPage = (page: number) => {
    const track = trackRef.current;
    if (!track || pages.length <= 1) return;

    const boundedPage = Math.max(0, Math.min(page, pages.length - 1));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({
      left: boundedPage * track.clientWidth,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (pages.length <= 1) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToPage(activePage - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToPage(activePage + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      goToPage(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goToPage(pages.length - 1);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="min-w-0" data-testid={testId}>
      <div
        aria-label={ariaLabel}
        aria-roledescription="carousel"
        className="overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)]"
        onKeyDown={handleKeyDown}
        role="region"
        tabIndex={pages.length > 1 ? 0 : undefined}
      >
        <div
          aria-live="off"
          className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth motion-reduce:scroll-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const track = event.currentTarget;
            if (!track.clientWidth) return;
            const nextPage = Math.max(0, Math.min(
              pages.length - 1,
              Math.round(track.scrollLeft / track.clientWidth),
            ));
            setActivePage((currentPage) => currentPage === nextPage ? currentPage : nextPage);
          }}
          ref={trackRef}
        >
          {pages.map((page, pageIndex) => {
            const start = pageIndex * cardsPerPage + 1;
            const end = Math.min(start + page.length - 1, items.length);
            const gridColumns = page.length === 1
              ? 'grid-cols-1'
              : page.length === 2
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

            return (
              <div
                aria-label={`Reviews ${start} to ${end} of ${items.length}`}
                aria-roledescription="slide"
                className="w-full min-w-0 shrink-0 snap-start px-0.5"
                key={pageIndex}
                role="group"
              >
                <div className={`grid h-full min-w-0 items-stretch gap-4 ${gridColumns}`}>
                  {page.map((item, itemIndex) => (
                    <div className="min-w-0" key={start + itemIndex}>
                      {renderItem(item)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pages.length > 1 ? (
        <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p aria-live="polite" aria-atomic="true" className="text-center text-xs font-semibold text-[hsl(215_24%_76%)] sm:text-left">
            Showing {activePage * cardsPerPage + 1}–{Math.min((activePage + 1) * cardsPerPage, items.length)} of {items.length}
          </p>
          <nav aria-label={`${ariaLabel} pagination`} className="flex max-w-full items-center gap-1">
            <button
              aria-label="Previous reviews"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[hsl(215_25%_36%)] text-[hsl(210_40%_98%)] transition-colors hover:border-[hsl(184_85%_64%)] hover:text-[hsl(184_85%_72%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activePage === 0}
              onClick={() => goToPage(activePage - 1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <div className="flex items-center">
              {paginationPages.map((pageIndex) => (
                <button
                  aria-current={activePage === pageIndex ? 'page' : undefined}
                  aria-label={`Show review group ${pageIndex + 1} of ${pages.length}`}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] sm:size-10 ${activePage === pageIndex ? 'bg-[hsl(184_85%_64%)]' : 'hover:bg-white/10'}`}
                  key={pageIndex}
                  onClick={() => goToPage(pageIndex)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`block size-2 rounded-full ${activePage === pageIndex ? 'bg-[hsl(215_74%_20%)]' : 'bg-[hsl(215_24%_58%)]'}`}
                  />
                </button>
              ))}
            </div>
            <button
              aria-label="Next reviews"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[hsl(215_25%_36%)] text-[hsl(210_40%_98%)] transition-colors hover:border-[hsl(184_85%_64%)] hover:text-[hsl(184_85%_72%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(184_85%_64%)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activePage === pages.length - 1}
              onClick={() => goToPage(activePage + 1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}