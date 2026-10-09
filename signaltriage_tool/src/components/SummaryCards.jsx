export function SummaryCards({ data }) {
  const cards = [
    { label: "Drug analyzed", value: data.drug.charAt(0).toUpperCase() + data.drug.slice(1) },
    { label: "Reports analyzed", value: data.total_reports.toLocaleString() },
    { label: "Distinct reactions", value: data.distinct_reactions },
    { label: "Review-priority events", value: data.review_priority_count, emphasis: data.review_priority_count > 0 },
  ];

  return (
    <div className="summary-cards">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`summary-card${card.emphasis ? " summary-card--emphasis" : ""}`}
        >
          <span className="summary-card__label">{card.label}</span>
          <span className="summary-card__value mono">{card.value}</span>
        </div>
      ))}
    </div>
  );
}
