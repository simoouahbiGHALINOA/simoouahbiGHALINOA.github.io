import TimelineVideo from './components/TimelineVideo';

const timelineItems = [
  { date: '2026-11-05', displayDate: 'November 5, 2026', time: '18:52', image: 'Capture%20d%27%C3%A9cran%202026-11-05%20185251.png' },
  { date: '2026-11-05', displayDate: 'November 5, 2026', time: '22:06', image: 'Capture%20d%27%C3%A9cran%202026-11-05%20220645.png' },
  { date: '2026-11-06', displayDate: 'November 6, 2026', time: '04:08', image: 'Capture%20d%27%C3%A9cran%202026-11-06%20040851.png' },
  { date: '2026-11-06', displayDate: 'November 6, 2026', time: '04:14', image: 'Capture%20d%27%C3%A9cran%202026-11-06%20041432.png' },
  { date: '2026-11-06', displayDate: 'November 6, 2026', time: '20:28', image: 'Capture%20d%27%C3%A9cran%202026-11-06%20202824.png' },
  { date: '2026-11-06', displayDate: 'November 6, 2026', time: '20:39', image: 'Capture%20d%27%C3%A9cran%202026-11-06%20203931.png' },
  { date: '2026-11-07', displayDate: 'November 7, 2026', time: '04:07', image: 'Capture%20d%27%C3%A9cran%202026-11-07%20040743.png' },
  { date: '2026-11-07', displayDate: 'November 7, 2026', time: '21:01', image: 'Capture%20d%27%C3%A9cran%202026-11-07%20210121.png' },
  { date: '2026-11-09', displayDate: 'November 9, 2026', time: '01:59', image: 'Capture%20d%27%C3%A9cran%202026-11-09%20015909.png' },
  { date: '2026-11-09', displayDate: 'November 9, 2026', time: '12:00', image: 'Capture%20d%27%C3%A9cran%202026-11-09%20120052.png' },
  { date: '2026-11-09', displayDate: 'November 9, 2026', time: '12:02', image: 'Capture%20d%27%C3%A9cran%202026-11-09%20120236.png' },
  { date: '2026-11-09', displayDate: 'November 9, 2026', time: '14:41', image: 'Capture%20d%27%C3%A9cran%202026-11-09%20144123.png' },
  { date: '2026-11-12', displayDate: 'November 12, 2026', time: '00:44', image: 'Capture%20d%27%C3%A9cran%202026-11-12%20004409.png' },
];

export default function TimelinePage() {
  return (
    <main id="main" className="page-main timeline-page" tabIndex={-1}>
      <section className="timeline-hero">
        <span className="eyebrow">BUILT IN PUBLIC</span>
        <h1>Work <span className="gradient-text">timeline</span></h1>
        <p>A visual timeline of ECOS-SYS work, with a video preview and screenshots captured along the way.</p>
      </section>

      <TimelineVideo />

      <section className="content-section timeline-screenshots" aria-labelledby="timeline-screenshots-heading">
        <div className="section-heading">
          <span className="eyebrow">SCREENSHOT ARCHIVE</span>
          <h2 id="timeline-screenshots-heading">Snapshots through time.</h2>
          <p>{timelineItems.length} screenshots, ordered by capture date.</p>
        </div>
        <ol className="timeline-list">
          {timelineItems.map((item) => (
            <li className="timeline-item" key={`${item.date}-${item.time}`}>
              <time className="timeline-date" dateTime={`${item.date}T${item.time}:00`}>
                <strong>{item.displayDate}</strong>
                <span>{item.time}</span>
              </time>
              <figure className="timeline-figure">
                <img
                  src={`/assets/${item.image}`}
                  alt={`ECOS-SYS work screenshot captured ${item.displayDate} at ${item.time}`}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>{item.displayDate} · {item.time}</figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
