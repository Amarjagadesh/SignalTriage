import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnalysisStatus } from "./AnalysisStatus";

const PRETESTED_DRUGS = ["metformin", "ibuprofen", "atorvastatin"];

/*
 * One search field instead of a dropdown plus a text box.
 *
 * The two controls always did the same job -- name a drug -- and splitting
 * them made you decide which one you needed before you could type anything.
 * A combobox collapses that: the three pre-tested drugs are offered as
 * suggestions, and anything else you type goes straight to openFDA. The
 * "pre-tested" tag is what carries the distinction the old select used to,
 * since those three are the ones with a guaranteed offline fallback.
 *
 * This component still only collects input and reports it upward via
 * onAnalyze -- it does not call the API itself.
 */
export function DrugSearch({ onAnalyze, loading }) {
  const [query, setQuery] = useState(PRETESTED_DRUGS[0]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [useLive, setUseLive] = useState(true);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  // Colons in React's generated ids are legal in HTML but break querySelector.
  const listId = `drug-options-${useId().replace(/:/g, "")}`;

  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();

  const options = useMemo(() => {
    const matches = PRETESTED_DRUGS.filter((drug) =>
      lowered ? drug.includes(lowered) : true
    ).map((drug) => ({ type: "pretested", value: drug }));

    // A free-text row so it stays obvious that the field is not limited to
    // the three suggestions -- that affordance used to be a separate input.
    if (lowered && !PRETESTED_DRUGS.includes(lowered)) {
      matches.push({ type: "custom", value: trimmed });
    }
    return matches;
  }, [lowered, trimmed]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const commit = (value) => {
    setQuery(value);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const submit = () => {
    const drug = query.trim();
    if (!drug || loading) return;
    setOpen(false);
    setActiveIndex(-1);
    onAnalyze(drug, { live: useLive, limit: 100 });
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + options.length) % options.length);
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0 && options[activeIndex]) {
      // Taking a highlighted suggestion should not also submit the form.
      event.preventDefault();
      commit(options[activeIndex].value);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit();
  };

  return (
    <form className="drug-search" onSubmit={handleSubmit}>
      <div className="drug-search__row">
        <div className="drug-search__field" ref={wrapperRef}>
          <label htmlFor={`${listId}-input`}>Search a medicine</label>

          <div className="drug-search__combo">
            <svg
              className="drug-search__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>

            <input
              id={`${listId}-input`}
              ref={inputRef}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
              }
              placeholder="e.g. metformin, amoxicillin"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
            />

            {query && (
              <button
                type="button"
                className="drug-search__clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setOpen(true);
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}

            {open && options.length > 0 && (
              <ul className="drug-search__options" id={listId} role="listbox">
                {options.map((option, index) => (
                  <li
                    key={`${option.type}-${option.value}`}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`drug-search__option${
                      index === activeIndex ? " drug-search__option--active" : ""
                    }`}
                    // onMouseDown, not onClick: the input's blur would close the
                    // list before a click ever landed.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      commit(option.value);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {option.type === "pretested" ? (
                      <>
                        <span className="drug-search__option-name">
                          {option.value.charAt(0).toUpperCase() + option.value.slice(1)}
                        </span>
                        <span className="drug-search__option-tag mono">pre-tested</span>
                      </>
                    ) : (
                      <>
                        <span className="drug-search__option-name">
                          Search openFDA for &ldquo;{option.value}&rdquo;
                        </span>
                        <span className="drug-search__option-tag drug-search__option-tag--live mono">
                          live
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="drug-search__row drug-search__row--controls">
        <label className="drug-search__toggle">
          <input
            type="checkbox"
            checked={useLive}
            onChange={(event) => setUseLive(event.target.checked)}
          />
          <span>Try live openFDA API first</span>
        </label>

        {loading && <AnalysisStatus />}

        <button
          type="submit"
          className="drug-search__button"
          disabled={loading || !trimmed}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {loading && (
        <div className="drug-search__progress" role="progressbar" aria-label="Analyzing">
          <span />
        </div>
      )}
    </form>
  );
}
