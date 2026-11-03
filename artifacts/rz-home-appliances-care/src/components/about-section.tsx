import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import controlBoard from '@/assets/about/control-board.jpeg';
import applianceDisassembly from '@/assets/about/appliance-disassembly.jpeg';
import frontLoadWasher from '@/assets/about/front-load-washer.jpeg';
import internalComponents from '@/assets/about/internal-components.jpeg';
import './about-section.css';

const photos = [
  { src: controlBoard, label: 'Control board close-up', alt: 'A green appliance circuit board with wiring and electronic components', width: 1280, height: 960 },
  { src: applianceDisassembly, label: 'During a repair', alt: 'A dismantled washing machine cabinet beside a front-load washing machine', width: 960, height: 1280 },
  { src: frontLoadWasher, label: 'Appliance care', alt: 'A black front-load washing machine in a home', width: 960, height: 1280 },
  { src: internalComponents, label: 'Inside the appliance', alt: 'An appliance control board and wiring inside an open white enclosure', width: 1280, height: 960 },
] as const;

function PhotoGallery() {
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    slidesToScroll: 'auto',
    containScroll: 'trimSnaps',
    breakpoints: { '(min-width: 1024px)': { active: false } },
  });
  const [gallery, setGallery] = useState({ selected: 0, pages: 4, perPage: 1, canPrevious: false, canNext: true });
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      const perPage = window.matchMedia('(min-width: 1024px)').matches ? 4
        : window.matchMedia('(min-width: 640px)').matches ? 2 : 1;
      setGallery({
        selected: api.selectedScrollSnap(),
        pages: api.scrollSnapList().length,
        perPage,
        canPrevious: api.canScrollPrev(),
        canNext: api.canScrollNext(),
      });
    };
    update();
    api.on('select', update).on('reInit', update);
    return () => { api.off('select', update).off('reInit', update); };
  }, [api]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activePhoto === null) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [activePhoto]);

  const jumpTo = (page: number) => api?.scrollTo(page, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const onGalleryKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (gallery.perPage === 4) return;
    const target = event.key === 'ArrowRight' ? gallery.selected + 1
      : event.key === 'ArrowLeft' ? gallery.selected - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? gallery.pages - 1 : null;
    if (target !== null) { event.preventDefault(); jumpTo(Math.max(0, Math.min(gallery.pages - 1, target))); }
  };
  const start = Math.min(gallery.selected * gallery.perPage + 1, photos.length);
  const end = Math.min(start + gallery.perPage - 1, photos.length);
  const changePhoto = (offset: number) => setActivePhoto((current) => current === null ? null : (current + offset + photos.length) % photos.length);

  return (
    <div className="rz-about-gallery" role="region" aria-label="RZ repair photo gallery" aria-roledescription={gallery.perPage < 4 ? 'carousel' : undefined}>
      <div className="rz-about-viewport" ref={viewportRef} onKeyDown={onGalleryKey}>
        <div className="rz-about-photo-track">
          {photos.map((photo, index) => (
            <figure className="rz-about-photo" key={photo.src}>
              <button type="button" className="rz-about-photo-open" onClick={() => setActivePhoto(index)} aria-label={`View photo ${index + 1}: ${photo.label}`}>
                <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" draggable={false} />
                <span className="rz-about-photo-expand" aria-hidden="true"><Expand size={15} /></span>
              </button>
              <figcaption>{photo.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="rz-about-gallery-controls">
        <span className="rz-about-photo-count" aria-live="polite" aria-atomic="true">{start}{end > start ? `–${end}` : ''} / {photos.length}</span>
        <div className="rz-about-gallery-dots" aria-label="Choose gallery page">
          {Array.from({ length: gallery.pages }, (_, page) => (
            <button type="button" key={page} aria-label={`Show photo${gallery.perPage === 2 ? 's' : ''} ${page * gallery.perPage + 1}${gallery.perPage === 2 ? ` and ${Math.min(page * gallery.perPage + 2, photos.length)}` : ''}`} aria-current={page === gallery.selected ? 'true' : undefined} onClick={() => jumpTo(page)}><span /></button>
          ))}
        </div>
        <div className="rz-about-gallery-arrows">
          <button type="button" aria-label="Previous gallery photos" disabled={!gallery.canPrevious} onClick={() => jumpTo(gallery.selected - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Next gallery photos" disabled={!gallery.canNext} onClick={() => jumpTo(gallery.selected + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>

      <dialog className="rz-about-lightbox" ref={dialogRef} aria-label="Repair photo viewer" onClose={() => setActivePhoto(null)} onClick={(event) => { if (event.target === event.currentTarget) setActivePhoto(null); }} onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changePhoto(event.key === 'ArrowLeft' ? -1 : 1); }
      }}>
        {activePhoto !== null && <>
          <div className="rz-about-lightbox-header"><span>{activePhoto + 1} / {photos.length} · {photos[activePhoto].label}</span><button type="button" aria-label="Close photo viewer" onClick={() => setActivePhoto(null)} autoFocus><X size={20} /></button></div>
          <img src={photos[activePhoto].src} alt={photos[activePhoto].alt} width={photos[activePhoto].width} height={photos[activePhoto].height} />
          <div className="rz-about-lightbox-controls"><button type="button" aria-label="Previous photo" onClick={() => changePhoto(-1)}><ChevronLeft size={20} /> Previous</button><button type="button" aria-label="Next photo" onClick={() => changePhoto(1)}>Next <ChevronRight size={20} /></button></div>
        </>}
      </dialog>
    </div>
  );
}

export function AboutSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section id="about" className="rz-landing-theme rz-about" aria-labelledby="about-heading">
      <div className="rz-about-panel">
        <div className="rz-about-copy">
          <p className="rz-about-eyebrow" data-testid="text-about-eyebrow"><span aria-hidden="true" /> About RZ</p>
          <h2 id="about-heading" data-testid="heading-about">Real work.<br /><span>Reliable care.</span></h2>
          <p className="rz-about-intro" data-testid="text-about-intro">RZ Fixer brings dependable appliance repairs to Bengaluru, led by Siddiq Basha.</p>
          <div className="rz-about-more" id="about-more" data-expanded={expanded}>
            <p data-testid="text-about-supporting">From everyday repairs to essential maintenance, we focus on practical solutions, careful workmanship and clear communication. We treat your home with respect and explain what your appliance needs, so you can make an informed decision.</p>
          </div>
          <button type="button" className="rz-about-read-more" aria-expanded={expanded} aria-controls="about-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Read less' : 'Read more'}<ChevronDown size={15} aria-hidden="true" /></button>
        </div>
        <PhotoGallery />
        <div className="rz-about-actions"><a href="#contact-us" className="rz-button rz-button-primary" data-testid="link-about-contact">Book a repair <ArrowRight size={18} aria-hidden="true" /></a></div>
      </div>
    </section>
  );
}
