import { ShieldCheck, Star } from 'lucide-react';
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

export function CurrentReviews() {
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
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <article
              className="flex min-h-[16rem] min-w-0 flex-col rounded-[1.7rem] border border-[hsl(215_25%_30%)] bg-[hsl(215_42%_19%)] p-6 transition duration-300 hover:-translate-y-1 hover:border-[hsl(184_85%_64%/0.58)] sm:p-7"
              data-testid={`card-public-review-${review.id}`}
              key={review.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span aria-label={`${review.rating} out of 5 stars`} className="inline-flex gap-0.5 text-[hsl(39_86%_60%)]">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star aria-hidden="true" className={`size-4 ${value <= review.rating ? 'fill-current' : 'text-[hsl(215_25%_36%)]'}`} key={value} />
                  ))}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(174_54%_28%)] px-2.5 py-1.5 text-[0.62rem] font-extrabold text-[hsl(174_54%_86%)]">
                  <ShieldCheck aria-hidden="true" className="size-3.5" /> Verified Customer
                </span>
              </div>
              <blockquote className="mt-6 text-[1rem] font-semibold leading-[1.65] text-[hsl(210_40%_98%)]">“{review.message}”</blockquote>
              <div className="mt-auto border-t border-[hsl(215_25%_30%)] pt-5">
                <p className="text-[0.78rem] font-extrabold text-[hsl(184_85%_72%)]">{review.name}</p>
                <p className="mt-1 text-[0.72rem] text-[hsl(215_24%_72%)]">{review.appliance}</p>
              </div>
            </article>
          ))}
        </div>
        <a className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-[hsl(184_85%_64%)] px-4 text-[0.78rem] font-extrabold text-[hsl(184_85%_78%)] transition hover:bg-[hsl(184_85%_64%)] hover:text-[hsl(215_74%_20%)]" href="#">
          View All Reviews
        </a>
      </div>
    </section>
  );
}