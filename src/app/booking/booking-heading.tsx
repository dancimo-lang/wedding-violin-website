'use client';

import { useSearchParams } from 'next/navigation';

export const GENERIC_HEADING = {
  title: 'Book Daniel',
  text: "Ready to make your event unforgettable? Fill out the form below and I'll get back to you within 24-48 hours.",
};

const PROPOSAL_HEADING = {
  title: 'Plan Your Proposal',
  text: "Tell me about the moment you have in mind, and we'll plan it together. Fill out the form below and I'll get back to you within 24-48 hours.",
};

export function BookingHeadingText({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 md:mb-4 drop-shadow-lg">{title}</h1>
      <p className="text-base md:text-xl text-amber-100 max-w-2xl mx-auto drop-shadow-lg">{text}</p>
    </>
  );
}

/** Swaps the hero heading for proposal bookings (?service=proposal). */
export default function BookingHeading() {
  const service = useSearchParams().get('service');
  return <BookingHeadingText {...(service === 'proposal' ? PROPOSAL_HEADING : GENERIC_HEADING)} />;
}
