export default function ContributionWeekEmbed({ site }: { site: string }) {
  return (
    <>
      <style>{`
        .eco-contribution-widget-shell { display: none !important; }
        @media (min-width: 1200px) {
          .eco-contribution-widget-shell {
            display: block !important;
            width: min(940px, calc(100% - 48px));
            margin: 28px auto;
          }
          .eco-contribution-widget-frame {
            display: block;
            width: 100%;
            height: 224px;
            border: 0;
            border-radius: 16px;
          }
        }
      `}</style>
      <div className="eco-contribution-widget-shell">
        <iframe
          className="eco-contribution-widget-frame"
          src={`https://0661619230.com/contribution-widget/${encodeURIComponent(site)}`}
          title={`Last seven days of contributions for ${site}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </>
  );
}
