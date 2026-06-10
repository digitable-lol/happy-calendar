import { DtBadge, DtButton, DtCard, DtHeader, DtTag } from '../../shared/digitable/DigitableUI';
import { buildDemoSessionPreview } from '../../widgets/session-preview/sessionPreview';
import { features, principles } from './content';
import './landing.css';

const preview = buildDemoSessionPreview();

export const LandingPage = () => (
  <main className="dt-canvas landing">
    <DtHeader logo={<a className="brand" href="#top"><span>HC</span><strong>Happy Calendar</strong></a>} nav={[{label:'Идея',href:'#idea'},{label:'Хеш-сессии',href:'#hash'},{label:'Roadmap',href:'#roadmap'}]} actions={<a className="dt-btn dt-btn--primary dt-btn--sm" href="#demo">Демо</a>} />
    <section className="hero" id="top">
      <div><DtBadge>no backend calendar</DtBadge><h1>Совместные праздники, подарки и вишлисты — одним приватным хешем.</h1><p>Happy Calendar помогает маленьким группам договориться о мероприятиях, бюджете подарков и формате участия без регистрации, серверов, баз данных и сбора персональных данных.</p><div className="actions"><DtButton size="lg">Начать с payload</DtButton><DtButton variant="secondary" size="lg">Собрать профиль</DtButton></div><div className="tags">{principles.map((x)=><DtTag key={x}>{x}</DtTag>)}</div></div>
      <aside className="hash" id="demo" aria-label="Демо хеш-сессии"><strong>{preview.groupName}</strong><div className="party"><span>🦊</span><span>🐱</span><span>🦉</span></div><p>{preview.participantsCount} участника · {preview.eventsCount} событие</p><code>{preview.payloadSample}</code><p>Новый хеш публикуется в чате. Участники видят, чья версия свежее по дате обновления.</p></aside>
    </section>
    <section className="section" id="idea"><p className="eyebrow">Что планируем</p><h2>Один сценарий для пар, семей и друзей.</h2><div className="grid">{features.map(([title,text])=><DtCard key={title} title={title}>{text}</DtCard>)}</div></section>
    <section className="section split" id="hash"><div><p className="eyebrow">Hash-first синхронизация</p><h2>Сессия как колода: скопировал строку — получил состояние.</h2><p>Каждый апдейт формирует новый payload и fingerprint. Landing-версия ничего не сохраняет и показывает архитектурный принцип.</p></div><DtCard title="Functional core"><ol><li>canonical JSON</li><li>payload</li><li>password-bound fingerprint</li><li>date-based freshness check</li></ol></DtCard></section>
    <section className="section" id="roadmap"><p className="eyebrow">Дальше</p><h2>От лендинга к приложениям.</h2><div className="grid">{['Web MVP','React Native shell','Electron shell','Steam-ready build'].map((x)=><DtCard key={x} title={x}>Платформенный слой поверх общего функционального ядра.</DtCard>)}</div></section>
  </main>
);
