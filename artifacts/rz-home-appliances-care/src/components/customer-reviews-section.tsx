import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Quote, ShieldCheck, Star } from 'lucide-react';
import './customer-reviews-section.css';

type PublicReview = {
  reviewId: string;
  rating: number;
  reviewMessage: string;
  customerLabel: string;
  applianceType: string | null;
  isVerified: boolean;
  isSample?: boolean;
};

// Display-only placeholders for the local design preview; never saved to the API.
const sampleReviews: PublicReview[] = [
  { reviewId: 'sample-1', rating: 5, customerLabel: 'Ananya R.', applianceType: 'Washing Machine Repair', isVerified: false, isSample: true, reviewMessage: 'The technician explained what was causing the noise and walked me through the repair options before starting. I appreciated the clear quote, the careful work and the time taken to check everything before leaving.' },
  { reviewId: 'sample-2', rating: 5, customerLabel: 'Rahul M.', applianceType: 'Refrigerator Repair', isVerified: false, isSample: true, reviewMessage: 'Easy to arrange a visit and straightforward communication throughout. The cooling issue was explained clearly, and the kitchen was left tidy after the work.' },
  { reviewId: 'sample-3', rating: 4, customerLabel: 'Priya S.', applianceType: 'AC Repair', isVerified: false, isSample: true, reviewMessage: 'The team kept me updated about the appointment and checked the airflow carefully. A helpful, practical explanation of what needed attention.' },
  { reviewId: 'sample-4', rating: 5, customerLabel: 'Arjun K.', applianceType: 'Micro Oven Repair', isVerified: false, isSample: true, reviewMessage: 'I had a few questions about the heating problem. They listened, explained the next steps in simple terms and checked the microwave with me after the repair.' },
  { reviewId: 'sample-5', rating: 4, customerLabel: 'Meera P.', applianceType: 'LED TV Repair', isVerified: false, isSample: true, reviewMessage: 'Clear advice about the display issue and the available repair options. It was reassuring to understand the cost before making a decision.' },
  { reviewId: 'sample-6', rating: 5, customerLabel: 'Vikram N.', applianceType: 'Washing Machine Repair', isVerified: false, isSample: true, reviewMessage: 'A convenient appointment and a careful check of the machine. The technician explained how to look after it and answered my questions without rushing.' },
];

function ReviewCard({ review }: { review: PublicReview }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const message = messageRef.current;
    if (!message) return;
    const measure = () => setTruncated(message.scrollHeight > message.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(message);
    return () => observer.disconnect();
  }, [review.reviewMessage]);

  return (
    <article className="rz-review-card" data-expanded={expanded} data-testid={`card-public-review-${review.reviewId}`}>
      <div className="rz-review-top">
        <span className="rz-review-stars" aria-label={`${review.rating} out of 5 stars`} data-testid={`stars-public-review-${review.reviewId}`}>
          {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={15} strokeWidth={1.6} className={value <= review.rating ? 'is-filled' : ''} aria-hidden="true" />)}
        </span>
        {review.isSample ? <span className="rz-review-sample">Sample review</span> : review.isVerified ? <span className="rz-review-verified"><ShieldCheck size={13} aria-hidden="true" /> Verified</span> : null}
      </div>
      <Quote className="rz-review-quote" size={24} strokeWidth={1.4} aria-hidden="true" />
      <blockquote className="rz-review-message"><p ref={messageRef} id={`review-message-${review.reviewId}`}>{review.reviewMessage}</p></blockquote>
      {truncated || expanded ? <button type="button" className="rz-review-read-more" aria-expanded={expanded} aria-controls={`review-message-${review.reviewId}`} onClick={() => setExpanded(!expanded)} aria-label={`${expanded ? 'Read less' : 'Read more'} of ${review.customerLabel}'s review`}>{expanded ? 'Read less' : 'Read more'}</button> : null}
      <footer className="rz-review-author">
        <span className="rz-review-avatar" aria-hidden="true">{review.customerLabel.trim().slice(0, 1).toUpperCase()}</span>
        <div><p className="rz-review-name" data-testid={`text-public-review-customer-${review.reviewId}`}>{review.customerLabel}</p><p className="rz-review-service">{review.applianceType ?? 'Appliance service'}</p></div>
      </footer>
    </article>
  );
}

export function CustomerReviewsSection() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sectionRef = useRef<HTMLDivElement>(null);
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    slidesToScroll: 'auto',
    containScroll: 'trimSnaps',
    watchDrag: (_api, event) => !(event.target instanceof Element && event.target.closest('button, a')),
  });
  const [gallery, setGallery] = useState({ selected: 0, pages: 1, perPage: 3, previous: false, next: false });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reviews?limit=6', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !Array.isArray(body)) throw new Error(body?.error || 'Reviews are unavailable right now.');
        if (!cancelled) setReviews(body);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Reviews are unavailable right now.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      section.dataset.visible = 'true';
      observer.disconnect();
    }, { threshold: 0.1 });
    section.dataset.animate = 'true';
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!api) return;
    const update = () => setGallery({
      selected: api.selectedScrollSnap(),
      pages: api.scrollSnapList().length,
      perPage: window.matchMedia('(min-width: 1024px)').matches ? 3 : window.matchMedia('(min-width: 640px)').matches ? 2 : 1,
      previous: api.canScrollPrev(),
      next: api.canScrollNext(),
    });
    update();
    api.on('select', update).on('reInit', update);
    return () => { api.off('select', update).off('reInit', update); };
  }, [api]);

  // Temporary reviews are restricted to development; production keeps approved API reviews.
  const placeholders = import.meta.env.DEV ? sampleReviews.slice(0, Math.max(0, 6 - reviews.length)) : [];
  const items = [...reviews, ...placeholders];
  const jumpTo = (page: number) => api?.scrollTo(page, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.key === 'ArrowRight' ? gallery.selected + 1 : event.key === 'ArrowLeft' ? gallery.selected - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? gallery.pages - 1 : null;
    if (target !== null && gallery.pages > 1) { event.preventDefault(); jumpTo(Math.max(0, Math.min(gallery.pages - 1, target))); }
  };
  const dotLimit = gallery.perPage === 1 ? 3 : gallery.perPage === 2 ? 5 : 7;
  const dotStart = Math.max(0, Math.min(gallery.selected - Math.floor(dotLimit / 2), gallery.pages - dotLimit));
  const dots = Array.from({ length: Math.min(dotLimit, gallery.pages) }, (_, index) => index + dotStart);
  const arrows = <>
    <button type="button" aria-label="Previous reviews" disabled={!gallery.previous} onClick={() => jumpTo(gallery.selected - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
    <button type="button" aria-label="Next reviews" disabled={!gallery.next} onClick={() => jumpTo(gallery.selected + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
  </>;

  return (
    <section className="rz-landing-theme rz-reviews" id="customer-reviews" aria-labelledby="customer-reviews-heading">
      <div className="rz-reviews-inner" ref={sectionRef}>
        <header className="rz-reviews-header">
          <div><p className="rz-reviews-eyebrow"><span aria-hidden="true" /> Customer stories</p><h2 id="customer-reviews-heading">What our<br /><span>customers</span> say.</h2><p className="rz-reviews-intro">A few words on service, care and repairs.</p></div>
          {gallery.pages > 1 ? <div className="rz-reviews-arrows rz-reviews-header-actions">{arrows}</div> : null}
        </header>
        {items.length > 0 ? <div className="rz-reviews-gallery" data-count={items.length} data-testid="carousel-public-reviews-home">
          <div className="rz-reviews-viewport" ref={viewportRef} role="region" aria-label="Customer reviews" aria-roledescription="carousel" tabIndex={gallery.pages > 1 ? 0 : undefined} onKeyDown={onKeyDown}>
            <div className="rz-reviews-track">{items.map((review) => <div className="rz-review-slide" key={review.reviewId}><ReviewCard review={review} /></div>)}</div>
          </div>
          {gallery.pages > 1 ? <div className="rz-reviews-pagination">
            <p className="rz-reviews-count" aria-live="polite" aria-atomic="true">{gallery.selected * gallery.perPage + 1}{gallery.perPage > 1 ? `–${Math.min((gallery.selected + 1) * gallery.perPage, items.length)}` : ''} / {items.length}</p>
            <div className="rz-reviews-dots" aria-label="Choose review page">{dots.map((page) => <button type="button" key={page} aria-label={`Show review group ${page + 1} of ${gallery.pages}`} aria-current={page === gallery.selected ? 'page' : undefined} onClick={() => jumpTo(page)}><span /></button>)}</div>
            <div className="rz-reviews-arrows rz-reviews-mobile-actions">{arrows}</div>
          </div> : null}
        </div> : loading ? <p className="rz-reviews-status" role="status">Loading customer reviews…</p> : error ? <p className="rz-reviews-status" role="alert">{error}</p> : <p className="rz-reviews-status">Customer reviews will appear here once available.</p>}
        {placeholders.length > 0 ? <p className="rz-reviews-preview-note">Sample reviews are shown for this design preview.</p> : reviews.length >= 6 ? <a className="rz-reviews-all" href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/reviews`}>View all reviews <ChevronRight size={16} aria-hidden="true" /></a> : null}
      </div>
    </section>
  );
}
