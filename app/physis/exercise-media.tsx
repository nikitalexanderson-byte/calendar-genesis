"use client";
/* eslint-disable @next/next/no-img-element -- Vite serves local lazy WebP previews without the Next image server. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DialogCloseButton } from '../DialogCloseButton';
import { ExperimentalIcon } from '../ExperimentalIcon';
import { useDialogAccessibility } from '../use-dialog-accessibility';
import type { ExerciseChoice, ExerciseDefinition } from './training-domain';
import { EXERCISE_GUIDES } from './exercise-library-data';
import mediaData from './exercise-media-data.json';
import './exercise-media.css';

const media: Record<string, { src: string; poster: string; split: number; width: number; height: number }> = mediaData;
const tr = (en: boolean, ru: string, english: string) => en ? english : ru;
const sequence = [0, 1, 2, 1];
const guideFor = (id: string, data: ExerciseDefinition) => EXERCISE_GUIDES.find(guide => `genesis:${guide.id}` === (data.catalogId || id));
const labels: Record<string, [string, string]> = {
  legs: ['Ноги', 'Legs'], posterior: ['Задняя поверхность тела', 'Posterior chain'], chest: ['Грудь', 'Chest'], back: ['Спина', 'Back'], core: ['Корпус', 'Core'], whole: ['Всё тело', 'Full body'], shoulders: ['Плечи', 'Shoulders'], arms: ['Руки', 'Arms'],
  bodyweight: ['Собственный вес', 'Bodyweight'], barbell: ['Штанга', 'Barbell'], dumbbell: ['Гантели', 'Dumbbells'], machine: ['Тренажёр', 'Machine'], cable: ['Блочный тренажёр', 'Cable machine'], bench: ['Скамья', 'Bench'], home: ['Дома', 'At home'], gym: ['В зале', 'At the gym'],
  squat: ['Приседание', 'Squat'], hinge: ['Наклон / тяга', 'Hip hinge'], push: ['Жим', 'Push'], pull: ['Тяга', 'Pull'], lunge: ['Выпад', 'Lunge'], hold: ['Удержание', 'Hold'], brace: ['Стабилизация', 'Stability'], locomotion: ['Передвижение', 'Locomotion'], flexion: ['Сгибание', 'Flexion'], extension: ['Разгибание', 'Extension'], abduction: ['Отведение', 'Abduction'],
  quadriceps: ['Квадрицепсы', 'Quadriceps'], glutes: ['Ягодичные', 'Glutes'], hamstrings: ['Задняя поверхность бедра', 'Hamstrings'], calves: ['Икроножные', 'Calves'], pectorals: ['Грудные', 'Pectorals'], triceps: ['Трицепсы', 'Triceps'], biceps: ['Бицепсы', 'Biceps'], lats: ['Широчайшие', 'Lats'], rhomboids: ['Ромбовидные', 'Rhomboids'], deltoids: ['Дельтовидные', 'Deltoids'], 'anterior-deltoids': ['Передние дельты', 'Anterior deltoids'], 'lateral-deltoids': ['Средние дельты', 'Lateral deltoids'], 'rear-deltoids': ['Задние дельты', 'Rear deltoids'], abs: ['Мышцы живота', 'Abdominals'], obliques: ['Косые мышцы живота', 'Obliques'], erectors: ['Разгибатели спины', 'Spinal erectors'], brachialis: ['Плечевая мышца', 'Brachialis'], brachioradialis: ['Плечелучевая мышца', 'Brachioradialis'],
  quads: ['Квадрицепсы', 'Quadriceps'], 'front-delts': ['Передние дельты', 'Anterior deltoids'], 'side-delts': ['Средние дельты', 'Lateral deltoids'], 'rear-delts': ['Задние дельты', 'Rear deltoids'], 'mid-back': ['Средняя часть спины', 'Mid back'], forearms: ['Мышцы предплечья', 'Forearms'],
  step: ['Зашагивание', 'Step-up'], 'elbow-extension': ['Разгибание рук', 'Elbow extension'], 'elbow-flexion': ['Сгибание рук', 'Elbow flexion'], 'knee-extension': ['Разгибание ног', 'Knee extension'], 'knee-flexion': ['Сгибание ног', 'Knee flexion'], 'horizontal-abduction': ['Разведение рук', 'Horizontal abduction'], 'plantar-flexion': ['Подъём на носки', 'Calf raise'],
};
export const exerciseTagLabel = (value: string, en: boolean) => labels[value]?.[en ? 1 : 0] || value;

function ExercisePlayer({ id, en }: { id: string; en: boolean }) {
  const asset = media[id];
  const clipPrefix = useId();
  const stage = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<'both' | 'male' | 'female'>('both');
  const [playing, setPlaying] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const frame = sequence[step];
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (preference.matches) setPlaying(false); };
    preference.addEventListener('change', reduce);
    return () => preference.removeEventListener('change', reduce);
  }, []);
  useEffect(() => {
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: .1 });
    if (stage.current) observer.observe(stage.current);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    let active = true; const image = new Image();
    image.onload = () => { if (active) setLoadState('ready'); };
    image.onerror = () => { if (active) setLoadState('error'); };
    image.src = asset.src;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [asset.src, retry]);
  const running = playing && inView && pageVisible && loadState === 'ready';
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setStep(value => (value + 1) % sequence.length), 700);
    return () => window.clearInterval(timer);
  }, [running]);
  return <div className="physis-exercise-player" data-running={running} data-frame={frame}>
    <nav className="physis-tabs physis-demo-models" aria-label={tr(en, 'Модель демонстрации', 'Demonstration model')}>
      {(['both', 'male', 'female'] as const).map((value, i) => <button key={value} type="button" aria-pressed={model === value} onClick={() => setModel(value)}>{[tr(en, 'Вместе', 'Both'), tr(en, 'Мужчина', 'Man'), tr(en, 'Женщина', 'Woman')][i]}</button>)}
    </nav>
    <div ref={stage} className={`physis-demo-stage ${model === 'both' ? 'is-pair' : ''}`} aria-busy={loadState === 'loading'}>
      {loadState === 'error' ? <div className="physis-demo-error" role="alert"><p>{tr(en, 'Не удалось загрузить демонстрацию.', 'Could not load the demonstration.')}</p><button type="button" onClick={() => { setLoadState('loading'); setRetry(value => value + 1); }}>{tr(en, 'Повторить загрузку', 'Retry loading')}</button></div> : <>
        {loadState === 'loading' && <p className="physis-demo-loading" role="status">{tr(en, 'Загружаем демонстрацию…', 'Loading demonstration…')}</p>}
        {(['male', 'female'] as const).filter(value => model === 'both' || model === value).map(value => {
          const y = value === 'male' ? 0 : asset.split;
          const height = value === 'male' ? asset.split : asset.height - asset.split;
          const x = frame * asset.width / 3 + 3; const clipId = `${clipPrefix}-${value}`;
          return <figure key={value}><svg viewBox={`${x} ${y + 3} ${asset.width / 3 - 6} ${height - 6}`} aria-hidden="true" focusable="false"><defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y + 3} width={asset.width / 3 - 6} height={height - 6} /></clipPath></defs><image href={asset.src} width={asset.width} height={asset.height} clipPath={`url(#${clipId})`} /></svg><figcaption>{value === 'male' ? tr(en, 'Мужчина', 'Man') : tr(en, 'Женщина', 'Woman')}</figcaption></figure>;
        })}
      </>}
    </div>
    <div className="physis-demo-controls">
      <button type="button" className="physis-primary physis-demo-play" disabled={loadState !== 'ready'} aria-pressed={playing} onClick={() => setPlaying(value => !value)}>
        {playing ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg> : <ExperimentalIcon name="play" />}{playing ? tr(en, 'Пауза', 'Pause') : tr(en, 'Воспроизвести', 'Play')}
      </button>
      <div className="physis-demo-phases" role="group" aria-label={tr(en, 'Фазы движения', 'Movement phases')}>
        {[0, 1, 2].map(value => <button type="button" key={value} aria-label={`${tr(en, 'Фаза', 'Phase')} ${value + 1}`} aria-pressed={frame === value} onClick={() => { setPlaying(false); setStep(value); }}>{value + 1}</button>)}
      </div>
    </div>
  </div>;
}

function ExerciseDemoDialog({ choice, en, onClose, actions }: { choice: ExerciseChoice; en: boolean; onClose: () => void; actions?: ReactNode }) {
  const titleId = useId(); const guide = guideFor(choice.id, choice.data);
  const setDialogRef = useDialogAccessibility<HTMLDivElement>(onClose);
  const name = en ? choice.data.nameEn || choice.data.name : choice.data.name;
  return <div className="modal-backdrop physis-demo-backdrop"><div ref={setDialogRef} className="modal physis-demo-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
    <header className="physis-demo-heading"><div><h2 id={titleId}>{name}</h2><p className="physis-muted">{exerciseTagLabel(choice.data.muscles, en)} · {exerciseTagLabel(choice.data.equipment, en)}</p></div><DialogCloseButton aria-label={tr(en, 'Закрыть упражнение', 'Close exercise')} onClick={onClose} /></header>
    <div className="physis-demo-content">
      {guide && media[guide.id] && <><ExercisePlayer key={guide.id} id={guide.id} en={en} /><p className="physis-muted physis-demo-legend"><span aria-hidden="true" />{tr(en, 'Красным показаны основные рабочие мышцы. Подсветка условная, без оценки процентов активности.', 'Red marks the main working muscles. This is an illustration, not a measurement of muscle activation.')}</p></>}
      <div className="physis-demo-guide"><section><h3>{tr(en, 'Как выполнять', 'How to perform')}</h3>{guide ? <ol>{(en ? guide.stepsEn : guide.steps).map((text, index) => <li key={text}><strong>{index + 1}</strong><span>{text}</span></li>)}</ol> : <p>{choice.data.technique}</p>}</section>
        <section><h3>{tr(en, 'На что обратить внимание', 'What to watch for')}</h3><p>{guide && en ? guide.mistakesEn : choice.data.mistakes}</p>{guide && <><h3>{tr(en, 'Основные мышцы', 'Main muscles')}</h3><p>{guide.primary.map(value => exerciseTagLabel(value, en)).join(', ')}</p></>}{choice.data.notes && <><h3>{tr(en, 'Личные заметки', 'Personal notes')}</h3><p>{choice.data.notes}</p></>}</section>
      </div>
      {actions && <div className="physis-actions physis-demo-actions">{actions}</div>}
      <details className="physis-demo-sources"><summary>{tr(en, 'Источники и иллюстрации', 'Sources and illustrations')}</summary><p>{tr(en, 'Описание техники: ACE Exercise Library и NSCA. Иллюстрации созданы для GENESIS; три ключевые фазы показывают движение по кругу.', 'Technique references: ACE Exercise Library and NSCA. Original GENESIS illustrations loop through three key movement phases.')}</p><a href="https://www.acefitness.org/resources/everyone/exercise-library/" target="_blank" rel="noreferrer">ACE Exercise Library</a>{guide?.id === 'hinge' && <a href="https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/" target="_blank" rel="noreferrer">NSCA: Romanian deadlift</a>}</details>
    </div>
  </div></div>;
}

export function ExerciseDemoButton({ exerciseId, definition, en }: { exerciseId: string; definition: ExerciseDefinition; en: boolean }) {
  const [open, setOpen] = useState(false); const guide = guideFor(exerciseId, definition);
  if (!guide || !media[guide.id]) return null;
  return <><button type="button" className="physis-exercise-demo-button" aria-haspopup="dialog" onClick={() => setOpen(true)}><ExperimentalIcon name="play" />{tr(en, 'Посмотреть движение', 'View movement')}</button>{open && <ExerciseDemoDialog choice={{ id: exerciseId, data: definition, personal: false }} en={en} onClose={() => setOpen(false)} />}</>;
}

export function ExerciseGallery({ choices, en, actions }: { choices: ExerciseChoice[]; en: boolean; actions: (choice: ExerciseChoice, close: () => void) => ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = choices.find(choice => choice.id === selectedId);
  const close = () => setSelectedId(null);
  return <><div className="physis-exercise-gallery">{choices.map(choice => {
    const guide = guideFor(choice.id, choice.data); const asset = guide && media[guide.id];
    const name = en ? choice.data.nameEn || choice.data.name : choice.data.name;
    return <article key={choice.id} className="physis-exercise-card"><button type="button" className="physis-exercise-card-open" aria-label={`${tr(en, 'Открыть упражнение', 'Open exercise')}: ${name}`} aria-haspopup="dialog" onClick={() => setSelectedId(choice.id)}>
      <div className="physis-exercise-poster">{asset ? <img src={asset.poster} width="640" height="360" loading="lazy" decoding="async" alt="" /> : <ExperimentalIcon name="physis" />}{asset && <span className="physis-exercise-play-mark"><ExperimentalIcon name="play" /></span>}</div>
      <div className="physis-exercise-card-copy"><h3>{name}</h3><p>{exerciseTagLabel(choice.data.muscles, en)} · {exerciseTagLabel(choice.data.equipment, en)}</p><span>{choice.data.favorite ? tr(en, 'В избранном', 'In favorites') : asset ? tr(en, 'Смотреть движение', 'View movement') : tr(en, 'Личное упражнение', 'Personal exercise')}</span></div>
    </button></article>;
  })}</div>{selected && <ExerciseDemoDialog choice={selected} en={en} onClose={close} actions={actions(selected, close)} />}</>;
}
