import React, { FC } from "react";
import { Link } from "react-router-dom";
interface CallToActionProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
}
const CallToAction: React.FC<CallToActionProps> = ({ title, description, ctaLabel, ctaTo }) => {
  return (
    <section className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-20 text-center replica-cta-section"
      style={{ background: "linear-gradient(to right, var(--c-gradient-from), var(--c-gradient-to))" }}>
      <div className="container mx-auto px-4">
        <h2 className="text-4xl md:text-5xl font-bold mb-4 replica-heading" style={{ color: "var(--c-on-primary)" }}>{title}</h2>
        <p className="text-lg md:text-xl mb-8 replica-text" style={{ color: "var(--c-on-primary-muted)" }}>{description}</p>
        <Link
          to={ctaTo}
          className="inline-block px-10 py-4 rounded-full text-xl font-semibold shadow-lg transition-transform duration-300 hover:scale-105 replica-button"
          style={{ backgroundColor: "var(--c-button-cta-bg)", color: "var(--c-button-cta-fg)" }}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
};
export default CallToAction;