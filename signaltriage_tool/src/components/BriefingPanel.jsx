import brainHologram from '../assets/ai-brain.jpg'

/*
 * The reviewer briefing, with its provenance stated rather than implied.
 *
 * Whether a sentence was written by a model or by a template changes how much
 * scrutiny it deserves, so the chip is not decoration -- it is the piece of
 * information that lets someone decide how to read the paragraph beneath it.
 *
 * The hologram beside the text is purely decorative: aria-hidden, empty alt,
 * and lazily loaded. It sits in the gutter the measured prose leaves behind.
 */

const SOURCES = {
  gemini: {
    variant: 'ai',
    label: 'AI-generated summary (Gemini) — narrates computed statistics only',
  },
  template: {
    variant: 'auto',
    label: 'Auto-generated summary',
  },
}

export function BriefingPanel({ briefing, source }) {
  if (!briefing) return null

  const meta = SOURCES[source] ?? SOURCES.template

  return (
    <section className="briefing-card">
      <div className="briefing-card__head">
        <h2 className="briefing-card__title">Reviewer briefing</h2>
        <span className={`briefing-card__chip briefing-card__chip--${meta.variant}`}>
          <span className="briefing-card__chip-dot" aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      <div className="briefing-card__body">
        <figure className="briefing-card__visual" aria-hidden="true">
          <img src={brainHologram} alt="" loading="lazy" decoding="async" />
        </figure>

        <p className="briefing-card__text">{briefing}</p>
      </div>

      <p className="briefing-card__note">
        Written from the computed PRR / &chi;&sup2; / trend values below. It does not
        add external drug knowledge or assess causation.
      </p>
    </section>
  )
}
