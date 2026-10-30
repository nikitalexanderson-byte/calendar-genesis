"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { futureModelingCopy } from "./future-modeling";
import olympians from "./olympian-isopsephy.json";
import { DialogCloseButton } from "./DialogCloseButton";
import { ExperimentalIcon } from "./ExperimentalIcon";
import { useDialogAccessibility } from "./use-dialog-accessibility";
import "./future-modeling.css";

type Figure = {
  id: string; greek: string; number: number; name: Record<string, string>;
  calculationNote?: Record<string, string>;
};
const figures = new Map<string, Figure>([...olympians.deities, ...olympians.references].map(figure => [figure.id, figure]));

export function FutureModelingGuideDialog({ language, onClose }: { language: string; onClose: () => void }) {
  const copy = futureModelingCopy(language);
  const locale = copy.language;
  const dialogRef = useDialogAccessibility<HTMLElement>(onClose);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const figureLabel = (id: string) => {
    const figure = figures.get(id);
    const note = figure?.calculationNote;
    return figure ? <span key={id} data-modeling-deity={id}>
      {figure.name[locale] ?? figure.name.en} <span lang="el">{figure.greek}</span> · <b>{figure.number}</b>
      {note ? <small className="future-modeling-number-note">{note[locale] ?? note.en}</small> : null}
    </span> : null;
  };

  return <div className="modal-backdrop future-modeling-backdrop" role="presentation">
    <section className="future-modeling-dialog" ref={dialogRef} role="dialog" aria-modal="true"
      aria-labelledby="future-modeling-title" aria-describedby="future-modeling-intro" tabIndex={-1}
      lang={locale} data-no-translate>
      <DialogCloseButton className="future-modeling-close" aria-label={copy.close} onClick={onClose} />
      <header><h2 id="future-modeling-title">{copy.title}</h2><p>{copy.subtitle}</p></header>
      <p id="future-modeling-intro">{copy.intro}</p>
      {copy.sections.map((section, index) => <section className="future-modeling-step" data-modeling-step={index + 1} key={section.title}>
        <h3>{section.title}</h3>
        {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {index === 0 ? <div className="future-modeling-sectors">
          {copy.sectors.map(sector => <article key={sector.id} data-modeling-sector={sector.id}>
            <h4>{sector.title}</h4>
            <div className="future-modeling-figures">{sector.deities.map(figureLabel)}</div>
            <p>{sector.meaning}</p>
          </article>)}
        </div> : null}
        {index === 1 ? <dl className="future-modeling-goals">
          {copy.goals.map(goal => <div key={goal.deityId} data-modeling-goal={goal.deityId}>
            <dt>{figureLabel(goal.deityId)}</dt><dd>{goal.goal}</dd>
          </div>)}
        </dl> : null}
      </section>)}
      <footer><button type="button" className="secondary-button" onClick={onClose}>{copy.close}</button></footer>
    </section>
  </div>;
}

export function FutureModelingGuide({ language }: { language: string }) {
  const [open, setOpen] = useState(false);
  const copy = futureModelingCopy(language);
  return <div className="future-modeling" lang={copy.language} data-no-translate>
    <button type="button" className="year-details-button future-modeling-trigger" data-testid="future-modeling-open"
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span aria-hidden="true"><ExperimentalIcon name="stoicheion" /></span>
      <span><strong>{copy.title}</strong><small>{copy.subtitle}</small></span>
      <ExperimentalIcon name="chevron" />
    </button>
    {open ? createPortal(<FutureModelingGuideDialog language={language} onClose={() => setOpen(false)} />, document.body) : null}
  </div>;
}
