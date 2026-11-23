"use client";

import { useId, useState } from "react";
import { convertCurrency, formatCurrencyAmount } from "@/lib/landing-currency";

const PRESETS = [12.5, 38.2, 84] as const;

export function FoldDemo() {
  const [amount, setAmount] = useState<number>(38.2);
  const [foldKey, setFoldKey] = useState(0);
  const sliderId = useId();

  const homeAmount = convertCurrency(amount, "EUR", "INR");
  const localText = formatCurrencyAmount(amount, "EUR");
  const homeText = formatCurrencyAmount(homeAmount, "INR");

  function setAmountAndFold(next: number) {
    setAmount(next);
    setFoldKey((key) => key + 1);
  }

  return (
    <div className="fm-demo">
      <div className="fm-spread" aria-label="Illustrative conversion from euro to rupees">
        <div className="fm-leaf fm-leaf--outer">
          <div className="fm-leaf__head">
            <span className="fm-folio">Outer margin</span>
            <span className="fm-place">München · EUR</span>
          </div>
          <div className="fm-leaf__body">
            <p className="fm-leaf__label">You paid</p>
            <strong className="fm-figure">{localText}</strong>
            <p className="fm-leaf__note">The price on the tag, in the currency of the country you are in.</p>
          </div>
          <div className="fm-leaf__foot" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="fm-gutter" aria-hidden="true">
          <span className="fm-stitch" />
          <span className="fm-rate">1 EUR = ₹90.00</span>
          <span className="fm-rate-kind">Sample ECB rate</span>
          <svg viewBox="0 0 44 26" className="fm-arrow" role="presentation">
            <path d="M2 13h34M27 4l9 9-9 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
          </svg>
          <span className="fm-fold-tab">Fold here</span>
        </div>

        <div className="fm-leaf fm-leaf--home">
          <div className="fm-fold-panel" key={foldKey}>
            <div className="fm-leaf__head">
              <span className="fm-folio">Folded margin</span>
              <span className="fm-place">Home · INR</span>
            </div>
            <div className="fm-leaf__body">
              <p className="fm-leaf__label">At home</p>
              <strong className="fm-figure">{homeText}</strong>
              <p className="fm-leaf__note">The same purchase, in the money you think in.</p>
            </div>
            <div className="fm-leaf__foot" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      <div className="fm-controls">
        <div className="fm-presets" role="group" aria-label="Try a foreign amount">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="fm-preset"
              aria-pressed={amount === preset}
              onClick={() => setAmountAndFold(preset)}
            >
              {formatCurrencyAmount(preset, "EUR")}
            </button>
          ))}
        </div>
        <div className="fm-slider">
          <label htmlFor={sliderId}>Amount abroad</label>
          <input
            id={sliderId}
            type="range"
            min="0"
            max="200"
            step="0.5"
            value={amount}
            aria-valuetext={localText}
            onChange={(event) => setAmount(Number(event.target.value))}
            onPointerUp={() => setFoldKey((key) => key + 1)}
            onKeyUp={() => setFoldKey((key) => key + 1)}
          />
          <output htmlFor={sliderId}>{localText}</output>
        </div>
      </div>
      <p className="fm-demo-note">Illustrative figures. In the app, Pluto converts with the European Central Bank’s daily reference rate.</p>
    </div>
  );
}
