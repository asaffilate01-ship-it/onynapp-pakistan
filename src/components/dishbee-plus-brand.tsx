type DishbeePlusBrandProps = {
  compact?: boolean;
  inverse?: boolean;
  context?: string;
  className?: string;
};

export function DishbeePlusBrand({
  compact = false,
  inverse = false,
  context,
  className = "",
}: DishbeePlusBrandProps) {
  const classes = [
    "dishbee-plus-brand",
    compact ? "dishbee-plus-brand--compact" : "",
    inverse ? "dishbee-plus-brand--inverse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (compact) {
    return (
      <span className={classes} aria-label="Dishbee Plus">
        <img className="dishbee-plus-mark" src="/dishbee-plus-mark.svg" alt="" />
      </span>
    );
  }

  return (
    <span className={classes} aria-label={`Dishbee Plus${context ? ` ${context}` : ""}`}>
      <img className="dishbee-plus-mark" src="/dishbee-plus-mark.svg" alt="" />
      <span className="dishbee-plus-wordmark" aria-hidden="true">
        <span>dish</span>
        <span>bee</span>
        <b>+</b>
      </span>
      {context && <small>{context}</small>}
    </span>
  );
}
